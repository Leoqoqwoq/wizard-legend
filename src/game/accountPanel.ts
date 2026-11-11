import {
  getAccountInfo,
  isFirebaseConfigured,
  registerWithEmail,
  signInWithEmail,
  signOutToGuest,
  type AccountInfo
} from "./cloudSave";
import { applyPersistedMeta, metaState } from "./MetaState";

const ROOT_ID = "wl-account-root";

export type AccountPanelCallbacks = {
  onApplied?: () => void;
  onClose?: () => void;
};

function ensureRoot(): HTMLDivElement {
  let root = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (root) return root;
  root = document.createElement("div");
  root.id = ROOT_ID;
  document.body.appendChild(root);
  return root;
}

function injectStyles() {
  if (document.getElementById("wl-account-css")) return;
  const style = document.createElement("style");
  style.id = "wl-account-css";
  style.textContent = `
#wl-account-root { position: fixed; inset: 0; z-index: 9999; pointer-events: none; font-family: "Segoe UI", Arial, sans-serif; }
#wl-account-root .wl-veil {
  position: absolute; inset: 0; background: rgba(10,6,18,0.78);
  pointer-events: auto; display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
#wl-account-root .wl-card {
  width: min(340px, 100%); background: linear-gradient(180deg, #f5e6c8 0%, #e8d4a8 100%);
  border: 3px solid #3b2414; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.45);
  padding: 18px 16px 14px; color: #2c1a0a; pointer-events: auto;
}
#wl-account-root h2 { margin: 0 0 4px; font-size: 20px; text-align: center; color: #3b2414; }
#wl-account-root .wl-sub { margin: 0 0 14px; font-size: 12px; text-align: center; color: #5c4030; line-height: 1.35; }
#wl-account-root label { display: block; font-size: 12px; font-weight: 700; margin: 8px 0 4px; }
#wl-account-root input {
  width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
  border: 2px solid #8b6b4a; background: #fffaf0; font-size: 14px; outline: none;
}
#wl-account-root input:focus { border-color: #8e44ad; }
#wl-account-root .wl-msg { min-height: 18px; margin: 8px 0 4px; font-size: 12px; text-align: center; color: #8b1a1a; }
#wl-account-root .wl-msg.ok { color: #1b6b3a; }
#wl-account-root .wl-row { display: flex; gap: 8px; margin-top: 10px; }
#wl-account-root button {
  flex: 1; border: none; border-radius: 8px; padding: 10px 8px; font-weight: 800;
  font-size: 13px; cursor: pointer; color: #fff;
}
#wl-account-root .wl-primary { background: #8e44ad; }
#wl-account-root .wl-secondary { background: #5d6d7e; }
#wl-account-root .wl-danger { background: #922b21; }
#wl-account-root .wl-ghost { background: transparent; color: #3b2414; border: 2px solid #8b6b4a; }
#wl-account-root button:disabled { opacity: 0.55; cursor: wait; }
#wl-account-root .wl-status {
  text-align: center; font-size: 13px; margin-bottom: 10px; padding: 8px;
  background: rgba(142,68,173,0.12); border-radius: 8px;
}
`;
  document.head.appendChild(style);
}

export function closeAccountPanel() {
  const root = document.getElementById(ROOT_ID);
  if (root) root.innerHTML = "";
}

export function openAccountPanel(cbs: AccountPanelCallbacks = {}) {
  if (!isFirebaseConfigured()) {
    cbs.onClose?.();
    return;
  }
  injectStyles();
  const root = ensureRoot();
  closeAccountPanel();

  const info = getAccountInfo();
  const veil = document.createElement("div");
  veil.className = "wl-veil";
  const card = document.createElement("div");
  card.className = "wl-card";

  const title = document.createElement("h2");
  title.textContent = "Conta";
  const sub = document.createElement("p");
  sub.className = "wl-sub";
  sub.textContent =
    "Opcional — você já joga como convidado. Crie login só se quiser guardar o progresso na nuvem com e-mail.";

  card.appendChild(title);
  card.appendChild(sub);

  const msg = document.createElement("div");
  msg.className = "wl-msg";

  const setBusy = (busy: boolean, buttons: HTMLButtonElement[]) => {
    buttons.forEach((b) => {
      b.disabled = busy;
    });
  };

  const finishClose = () => {
    closeAccountPanel();
    cbs.onClose?.();
  };

  veil.addEventListener("click", (ev) => {
    if (ev.target === veil) finishClose();
  });

  if (info.kind === "email") {
    const status = document.createElement("div");
    status.className = "wl-status";
    status.textContent = `Logado: ${info.email ?? "conta"}`;
    card.appendChild(status);
    card.appendChild(msg);

    const row = document.createElement("div");
    row.className = "wl-row";
    const outBtn = document.createElement("button");
    outBtn.className = "wl-danger";
    outBtn.textContent = "Sair (voltar a convidado)";
    const closeBtn = document.createElement("button");
    closeBtn.className = "wl-ghost";
    closeBtn.textContent = "Fechar";
    row.appendChild(outBtn);
    row.appendChild(closeBtn);
    card.appendChild(row);

    closeBtn.onclick = finishClose;
    outBtn.onclick = async () => {
      setBusy(true, [outBtn, closeBtn]);
      msg.className = "wl-msg";
      msg.textContent = "Saindo…";
      const res = await signOutToGuest(metaState);
      if (!res.ok) {
        msg.textContent = res.error;
        setBusy(false, [outBtn, closeBtn]);
        return;
      }
      msg.className = "wl-msg ok";
      msg.textContent = "Agora está como convidado.";
      cbs.onApplied?.();
      setTimeout(finishClose, 700);
    };
  } else {
    const status = document.createElement("div");
    status.className = "wl-status";
    status.textContent = "Modo convidado (sem e-mail)";
    card.appendChild(status);

    const emailLab = document.createElement("label");
    emailLab.textContent = "E-mail";
    const email = document.createElement("input");
    email.type = "email";
    email.autocomplete = "email";
    email.placeholder = "voce@email.com";

    const passLab = document.createElement("label");
    passLab.textContent = "Senha (mín. 6)";
    const pass = document.createElement("input");
    pass.type = "password";
    pass.autocomplete = "new-password";
    pass.placeholder = "••••••••";

    card.appendChild(emailLab);
    card.appendChild(email);
    card.appendChild(passLab);
    card.appendChild(pass);
    card.appendChild(msg);

    const row = document.createElement("div");
    row.className = "wl-row";
    const createBtn = document.createElement("button");
    createBtn.className = "wl-primary";
    createBtn.textContent = "Criar conta";
    const loginBtn = document.createElement("button");
    loginBtn.className = "wl-secondary";
    loginBtn.textContent = "Entrar";
    row.appendChild(createBtn);
    row.appendChild(loginBtn);
    card.appendChild(row);

    const skip = document.createElement("div");
    skip.className = "wl-row";
    const skipBtn = document.createElement("button");
    skipBtn.className = "wl-ghost";
    skipBtn.textContent = "Continuar sem login";
    skip.appendChild(skipBtn);
    card.appendChild(skip);

    skipBtn.onclick = finishClose;

    createBtn.onclick = async () => {
      setBusy(true, [createBtn, loginBtn, skipBtn]);
      msg.className = "wl-msg";
      msg.textContent = "Criando…";
      const res = await registerWithEmail(email.value, pass.value, metaState);
      if (!res.ok) {
        msg.textContent = res.error;
        setBusy(false, [createBtn, loginBtn, skipBtn]);
        return;
      }
      msg.className = "wl-msg ok";
      msg.textContent = "Conta criada! Progresso vinculado.";
      cbs.onApplied?.();
      setTimeout(finishClose, 800);
    };

    loginBtn.onclick = async () => {
      setBusy(true, [createBtn, loginBtn, skipBtn]);
      msg.className = "wl-msg";
      msg.textContent = "Entrando…";
      const res = await signInWithEmail(email.value, pass.value, metaState);
      if (!res.ok) {
        msg.textContent = res.error;
        setBusy(false, [createBtn, loginBtn, skipBtn]);
        return;
      }
      applyPersistedMeta(res.meta);
      msg.className = "wl-msg ok";
      msg.textContent = "Login ok — save sincronizado.";
      cbs.onApplied?.();
      setTimeout(finishClose, 800);
    };
  }

  veil.appendChild(card);
  root.appendChild(veil);
  // Evita que o Phaser capture o teclado enquanto o form está aberto
  emailFocusSafe(card);
}

function emailFocusSafe(card: HTMLElement) {
  const first = card.querySelector("input") as HTMLInputElement | null;
  first?.focus();
}

export function accountLabel(info: AccountInfo = getAccountInfo()): string {
  if (!info.configured) return "Conta";
  if (info.kind === "email") return "Conta ✓";
  return "Conta";
}
