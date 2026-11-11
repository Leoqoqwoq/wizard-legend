/** Progressão meta (lobby) — sobrevive entre runs. */

export type CapeId =
  | "default"
  | "heart"
  | "star"
  | "swirl"
  | "crimson"
  | "frost"
  | "leaf";

export type BookId =
  | "none"
  | "fire"
  | "ice"
  | "thunder"
  | "shield"
  | "wind"
  | "arcane";

export interface CapeDef {
  id: CapeId;
  name: string;
  tint: number;
  price: number;
  /** bônus simples */
  bonus: string;
}

export interface BookDef {
  id: BookId;
  name: string;
  tint: number;
  price: number;
  bonus: string;
  /** bias no pool de skills (ids parciais) */
  skillBias: string[];
}

export const CAPES: Record<CapeId, CapeDef> = {
  default: {
    id: "default",
    name: "Capa básica",
    tint: 0xffffff,
    price: 0,
    bonus: "Capa padrão do mago"
  },
  heart: {
    id: "heart",
    name: "Corazón",
    tint: 0xff9ec8,
    price: 150,
    bonus: "Gana +1 HP máximo"
  },
  star: {
    id: "star",
    name: "Estrella",
    tint: 0xc29bff,
    price: 180,
    bonus: "Gana más oro [+10%]"
  },
  swirl: {
    id: "swirl",
    name: "Abundancia",
    tint: 0xffe08a,
    price: 200,
    bonus: "Gana más diamantes [+20%]"
  },
  crimson: {
    id: "crimson",
    name: "Rubí",
    tint: 0xff6b6b,
    price: 160,
    bonus: "Daño mágico [+5%]"
  },
  frost: {
    id: "frost",
    name: "Escarcha",
    tint: 0xa8e4ff,
    price: 170,
    bonus: "Congelación más frecuente"
  },
  leaf: {
    id: "leaf",
    name: "Bosque",
    tint: 0x8fd19e,
    price: 140,
    bonus: "Velocidad de movimiento +"
  }
};

export const BOOKS: Record<BookId, BookDef> = {
  none: {
    id: "none",
    name: "Sin libro",
    tint: 0xffffff,
    price: 0,
    bonus: "—",
    skillBias: []
  },
  fire: {
    id: "fire",
    name: "Libro de fuego",
    tint: 0xff6b3d,
    price: 100,
    bonus: "Posibilidad de aparición de hechizos de Fuego [+5%]\nNo hay humo sin fuego.",
    skillBias: ["flame_elf", "fury_of_thor", "attack_speed"]
  },
  ice: {
    id: "ice",
    name: "Libro de hielo",
    tint: 0x74b9ff,
    price: 100,
    bonus: "Posibilidad de Freeze [+5%]\nFrío que quema.",
    skillBias: ["freeze", "dark_missile"]
  },
  thunder: {
    id: "thunder",
    name: "Libro de rayo",
    tint: 0xf1c40f,
    price: 120,
    bonus: "Posibilidad de Rayo [+5%]\nTrueno del cielo.",
    skillBias: ["fury_of_thor", "multishot"]
  },
  shield: {
    id: "shield",
    name: "Libro escudo",
    tint: 0x9b59b6,
    price: 110,
    bonus: "Posibilidad de Defensa [+5%]\nMuro arcano.",
    skillBias: ["thorns", "hp_boost", "wall_bounce"]
  },
  wind: {
    id: "wind",
    name: "Libro viento",
    tint: 0x2ecc71,
    price: 100,
    bonus: "Posibilidad de Proyectiles [+5%]\nViento cortante.",
    skillBias: ["front_arrow", "diagonal", "ricochet"]
  },
  arcane: {
    id: "arcane",
    name: "Libro arcano",
    tint: 0x8e44ad,
    price: 130,
    bonus: "Posibilidad de Misiles [+5%]\nMagia pura.",
    skillBias: ["dark_missile", "multishot", "ricochet"]
  }
};

export interface MetaState {
  gems: number;
  coinsBank: number;
  ownedCapes: CapeId[];
  ownedBooks: BookId[];
  equippedCape: CapeId;
  equippedBook: BookId;
  /** Recorde do modo infinito (ranking) */
  bestFloor: number;
  /** Melhor andar na campanha (1–61) */
  bestCampaignFloor: number;
  /** timestamp ms do último anúncio da coruja */
  lastOwlAdAt: number;
}

export function createMetaState(): MetaState {
  return {
    gems: 80,
    coinsBank: 0,
    ownedCapes: ["default"],
    ownedBooks: ["none"],
    equippedCape: "default",
    equippedBook: "none",
    bestFloor: 1,
    bestCampaignFloor: 1,
    lastOwlAdAt: 0
  };
}

/** Cooldown do anúncio da coruja (ms). */
export const OWL_AD_COOLDOWN_MS = 60_000;
export const OWL_AD_REWARD_GEMS = 25;

export function owlAdReady() {
  return Date.now() - metaState.lastOwlAdAt >= OWL_AD_COOLDOWN_MS;
}

export function claimOwlAdReward(): number {
  if (!owlAdReady()) return 0;
  metaState.lastOwlAdAt = Date.now();
  metaState.gems += OWL_AD_REWARD_GEMS;
  return OWL_AD_REWARD_GEMS;
}

export const metaState: MetaState = createMetaState();

export function ownCape(id: CapeId) {
  return metaState.ownedCapes.includes(id);
}

export function ownBook(id: BookId) {
  return metaState.ownedBooks.includes(id);
}

export function buyCape(id: CapeId): boolean {
  const def = CAPES[id];
  if (ownCape(id) || metaState.gems < def.price) return false;
  metaState.gems -= def.price;
  metaState.ownedCapes.push(id);
  metaState.equippedCape = id;
  return true;
}

export function buyBook(id: BookId): boolean {
  const def = BOOKS[id];
  if (ownBook(id) || metaState.gems < def.price) return false;
  metaState.gems -= def.price;
  metaState.ownedBooks.push(id);
  metaState.equippedBook = id;
  return true;
}
