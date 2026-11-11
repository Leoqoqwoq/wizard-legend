import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore
} from "firebase/firestore";
import type { BookId, CapeId, MetaState } from "./MetaState";

const LOCAL_KEY = "wl_meta_v1";
const SAVE_DEBOUNCE_MS = 800;

export type PersistedMeta = MetaState & { updatedAt: number };

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let currentUser: User | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let configured = false;

function readEnvConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
  const messagingSenderId = import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket || undefined,
    messagingSenderId: messagingSenderId || undefined,
    appId
  };
}

export function isFirebaseConfigured() {
  return configured;
}

export function initFirebase(): boolean {
  if (app) return configured;
  const cfg = readEnvConfig();
  if (!cfg) {
    console.warn(
      "[WL] Firebase não configurado — save só local (.env com VITE_FIREBASE_*)"
    );
    configured = false;
    return false;
  }
  try {
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
    configured = true;
    return true;
  } catch (e) {
    console.warn("[WL] Falha ao iniciar Firebase", e);
    configured = false;
    return false;
  }
}

function snapshotMeta(meta: MetaState): PersistedMeta {
  return {
    gems: meta.gems,
    coinsBank: meta.coinsBank,
    ownedCapes: [...meta.ownedCapes],
    ownedBooks: [...meta.ownedBooks],
    equippedCape: meta.equippedCape,
    equippedBook: meta.equippedBook,
    bestFloor: meta.bestFloor,
    bestCampaignFloor: meta.bestCampaignFloor,
    lastOwlAdAt: meta.lastOwlAdAt,
    updatedAt: Date.now()
  };
}

function sanitizeMeta(raw: Partial<PersistedMeta> | null | undefined): PersistedMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const capes = Array.isArray(raw.ownedCapes)
    ? (raw.ownedCapes.filter(Boolean) as CapeId[])
    : (["default"] as CapeId[]);
  const books = Array.isArray(raw.ownedBooks)
    ? (raw.ownedBooks.filter(Boolean) as BookId[])
    : (["none"] as BookId[]);
  return {
    gems: Math.max(0, Number(raw.gems) || 0),
    coinsBank: Math.max(0, Number(raw.coinsBank) || 0),
    ownedCapes: capes.length ? capes : (["default"] as CapeId[]),
    ownedBooks: books.length ? books : (["none"] as BookId[]),
    equippedCape: (raw.equippedCape as CapeId) || "default",
    equippedBook: (raw.equippedBook as BookId) || "none",
    bestFloor: Math.max(1, Number(raw.bestFloor) || 1),
    bestCampaignFloor: Math.max(1, Number(raw.bestCampaignFloor) || 1),
    lastOwlAdAt: Math.max(0, Number(raw.lastOwlAdAt) || 0),
    updatedAt: Math.max(0, Number(raw.updatedAt) || 0)
  };
}

export function persistMetaLocal(meta: MetaState) {
  try {
    const data = snapshotMeta(meta);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function hydrateMetaFromLocal(): PersistedMeta | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return sanitizeMeta(JSON.parse(raw) as Partial<PersistedMeta>);
  } catch {
    return null;
  }
}

function pickNewer(
  a: PersistedMeta | null,
  b: PersistedMeta | null
): PersistedMeta | null {
  if (!a) return b;
  if (!b) return a;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  // Empate: quem tem mais progresso de campanha / gemas
  if (a.bestCampaignFloor !== b.bestCampaignFloor) {
    return a.bestCampaignFloor > b.bestCampaignFloor ? a : b;
  }
  return a.gems >= b.gems ? a : b;
}

async function ensureAuth(): Promise<User | null> {
  if (!auth || !configured) return null;
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return currentUser;
  }
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth!, async (user) => {
      unsub();
      if (user) {
        currentUser = user;
        resolve(user);
        return;
      }
      try {
        const cred = await signInAnonymously(auth!);
        currentUser = cred.user;
        resolve(cred.user);
      } catch (e) {
        console.warn("[WL] Auth anônima falhou", e);
        resolve(null);
      }
    });
  });
}

async function loadCloudMeta(uid: string): Promise<PersistedMeta | null> {
  if (!db) return null;
  try {
    const ref = doc(db, "players", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return sanitizeMeta(snap.data() as Partial<PersistedMeta>);
  } catch (e) {
    console.warn("[WL] Leitura Firestore falhou", e);
    return null;
  }
}

async function saveCloudMeta(uid: string, meta: PersistedMeta) {
  if (!db) return;
  try {
    await setDoc(doc(db, "players", uid), meta, { merge: true });
  } catch (e) {
    console.warn("[WL] Escrita Firestore falhou", e);
  }
}

/**
 * Hidrata progresso: local + cloud (se Firebase ok).
 * Retorna o meta a aplicar (sem mutar metaState).
 */
export async function hydratePlayerSave(
  current: MetaState
): Promise<PersistedMeta> {
  const local = hydrateMetaFromLocal();
  const fresh = snapshotMeta(current);
  let best = pickNewer(local, fresh) ?? fresh;

  initFirebase();
  if (!configured) {
    persistMetaLocal(best);
    return best;
  }

  const user = await ensureAuth();
  if (!user) {
    persistMetaLocal(best);
    return best;
  }

  const cloud = await loadCloudMeta(user.uid);
  best = pickNewer(best, cloud) ?? best;

  // Garante doc na nuvem
  if (!cloud || cloud.updatedAt < best.updatedAt) {
    await saveCloudMeta(user.uid, best);
  }
  persistMetaLocal(best);
  return best;
}

/** Debounce: grava local na hora e cloud após ~800ms. */
export function queueCloudSave(meta: MetaState) {
  const data = snapshotMeta(meta);
  persistMetaLocal(data);

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushCloudSave(data);
  }, SAVE_DEBOUNCE_MS);
}

async function flushCloudSave(data: PersistedMeta) {
  if (!configured && !initFirebase()) return;
  const user = currentUser ?? (await ensureAuth());
  if (!user) return;
  await saveCloudMeta(user.uid, data);
}

/** Flush imediato (ex.: beforeunload). */
export function flushSaveNow(meta: MetaState) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const data = snapshotMeta(meta);
  persistMetaLocal(data);
  void flushCloudSave(data);
}

export type AccountInfo = {
  configured: boolean;
  uid: string | null;
  /** guest = anônimo; email = conta com e-mail; none = sem sessão */
  kind: "guest" | "email" | "none";
  email: string | null;
};

export function getAccountInfo(): AccountInfo {
  if (!configured || !auth) {
    return { configured: false, uid: null, kind: "none", email: null };
  }
  const u = currentUser ?? auth.currentUser;
  if (!u) return { configured: true, uid: null, kind: "none", email: null };
  if (u.isAnonymous) {
    return { configured: true, uid: u.uid, kind: "guest", email: null };
  }
  return {
    configured: true,
    uid: u.uid,
    kind: "email",
    email: u.email
  };
}

export function onAccountChanged(cb: (info: AccountInfo) => void): () => void {
  if (!configured && !initFirebase()) {
    cb(getAccountInfo());
    return () => undefined;
  }
  if (!auth) {
    cb(getAccountInfo());
    return () => undefined;
  }
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    cb(getAccountInfo());
  });
}

function authErrorMessage(e: unknown): string {
  const code =
    e && typeof e === "object" && "code" in e
      ? String((e as { code: string }).code)
      : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já tem conta. Use Entrar.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/weak-password":
      return "Senha fraca (mín. 6 caracteres).";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Espere um pouco.";
    case "auth/network-request-failed":
      return "Sem conexão. Tente de novo.";
    case "auth/credential-already-in-use":
      return "Essa conta já está em uso noutro aparelho.";
    default:
      return "Não deu certo. Tente de novo.";
  }
}

/**
 * Cria conta com e-mail. Se estiver anônimo, vincula e mantém o mesmo uid/progresso.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  meta: MetaState
): Promise<{ ok: true; info: AccountInfo } | { ok: false; error: string }> {
  if (!configured && !initFirebase()) {
    return { ok: false, error: "Firebase não configurado." };
  }
  if (!auth) return { ok: false, error: "Auth indisponível." };
  const em = email.trim();
  if (!em || password.length < 6) {
    return { ok: false, error: "E-mail e senha (mín. 6) são obrigatórios." };
  }

  try {
    const user = currentUser ?? (await ensureAuth());
    if (user?.isAnonymous) {
      const cred = EmailAuthProvider.credential(em, password);
      const linked = await linkWithCredential(user, cred);
      currentUser = linked.user;
      flushSaveNow(meta);
      return { ok: true, info: getAccountInfo() };
    }
    const created = await createUserWithEmailAndPassword(auth, em, password);
    currentUser = created.user;
    const data = snapshotMeta(meta);
    persistMetaLocal(data);
    await saveCloudMeta(created.user.uid, data);
    return { ok: true, info: getAccountInfo() };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}

/**
 * Entra numa conta existente e hidrata o save (local vs cloud da conta).
 */
export async function signInWithEmail(
  email: string,
  password: string,
  meta: MetaState
): Promise<
  | { ok: true; info: AccountInfo; meta: PersistedMeta }
  | { ok: false; error: string }
> {
  if (!configured && !initFirebase()) {
    return { ok: false, error: "Firebase não configurado." };
  }
  if (!auth) return { ok: false, error: "Auth indisponível." };
  const em = email.trim();
  if (!em || !password) {
    return { ok: false, error: "Informe e-mail e senha." };
  }

  try {
    // Guarda progresso do guest antes de trocar de uid
    flushSaveNow(meta);
    const cred = await signInWithEmailAndPassword(auth, em, password);
    currentUser = cred.user;
    const local = hydrateMetaFromLocal();
    const fresh = snapshotMeta(meta);
    let best = pickNewer(local, fresh) ?? fresh;
    const cloud = await loadCloudMeta(cred.user.uid);
    best = pickNewer(best, cloud) ?? best;
    await saveCloudMeta(cred.user.uid, best);
    persistMetaLocal(best);
    return { ok: true, info: getAccountInfo(), meta: best };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}

/** Sai da conta e volta a jogar como convidado (anônimo). */
export async function signOutToGuest(
  meta: MetaState
): Promise<{ ok: true; info: AccountInfo } | { ok: false; error: string }> {
  if (!configured && !initFirebase()) {
    return { ok: false, error: "Firebase não configurado." };
  }
  if (!auth) return { ok: false, error: "Auth indisponível." };
  try {
    flushSaveNow(meta);
    await signOut(auth);
    currentUser = null;
    const anon = await signInAnonymously(auth);
    currentUser = anon.user;
    const data = snapshotMeta(meta);
    persistMetaLocal(data);
    await saveCloudMeta(anon.user.uid, data);
    return { ok: true, info: getAccountInfo() };
  } catch (e) {
    return { ok: false, error: authErrorMessage(e) };
  }
}
