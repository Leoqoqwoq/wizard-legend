import type { EnemyKind } from "./createAnims";

/** Capítulos: 6 reinos (boss 10…60) + Ultra Boss no 61. */
export type KingdomId =
  | "doce"
  | "animal"
  | "gelo"
  | "trovao"
  | "sombrio"
  | "inferno"
  | "ultra";

export interface KingdomEnemySlot {
  kind: EnemyKind;
  /** Nome exibido */
  name: string;
  tint: number;
}

export interface KingdomDef {
  id: KingdomId;
  name: string;
  /** Cor de atmosfera (chão / HUD) */
  accent: number;
  floorTint: number;
  enemies: KingdomEnemySlot[];
  boss: {
    kind: EnemyKind;
    name: string;
    tint: number;
    scale: number;
  };
}

/**
 * Ordem dos reinos por capítulo (0 = floors 1–10, …, 5 = 51–60).
 * Dentro do capítulo o unlock é progressivo (ver enemiesForFloor).
 */
export const KINGDOMS: KingdomDef[] = [
  {
    id: "doce",
    name: "Reino Doce",
    accent: 0xff9ff3,
    floorTint: 0xffe6f7,
    enemies: [
      { kind: "pop", name: "Pudim", tint: 0xffc8e8 },
      { kind: "kernel", name: "Pirulito", tint: 0xff6bcb },
      { kind: "bug", name: "Bala Azeda", tint: 0xff9f68 },
      { kind: "eye", name: "Marshmallow", tint: 0xffeaa7 }
    ],
    boss: {
      kind: "pop",
      name: "Rei Pudim",
      tint: 0xff6bcb,
      scale: 3.4
    }
  },
  {
    id: "animal",
    name: "Reino Animal",
    accent: 0x82e0aa,
    floorTint: 0xd5f5e3,
    enemies: [
      { kind: "bug", name: "Esquilo", tint: 0xc4a484 },
      { kind: "eye", name: "Coruja Maligna", tint: 0xa3e4d7 },
      { kind: "bot", name: "Javali", tint: 0xd2b48c },
      { kind: "pop", name: "Sapo Doce", tint: 0x58d68d }
    ],
    boss: {
      kind: "bug",
      name: "Urso Guardião",
      tint: 0x1e8449,
      scale: 3.5
    }
  },
  {
    id: "gelo",
    name: "Reino Gelo",
    accent: 0x74b9ff,
    floorTint: 0xd6eaf8,
    enemies: [
      { kind: "eye", name: "Floco", tint: 0xaed6f1 },
      { kind: "kernel", name: "Granizo", tint: 0x85c1e9 },
      { kind: "bot", name: "Golem de Gelo", tint: 0x5dade2 },
      { kind: "bug", name: "Pinguim", tint: 0xd5dbdb }
    ],
    boss: {
      kind: "bot",
      name: "Rainha do Gelo",
      tint: 0x2874a6,
      scale: 3.5
    }
  },
  {
    id: "trovao",
    name: "Reino Trovão",
    accent: 0xf1c40f,
    floorTint: 0xfcf3cf,
    enemies: [
      { kind: "bot", name: "Robô Raio", tint: 0xf7dc6f },
      { kind: "eye", name: "Orbe Elétrico", tint: 0xf4d03f },
      { kind: "pop", name: "Nuvem Tempestade", tint: 0xf9e79f },
      { kind: "bug", name: "Besouro Volt", tint: 0xd4ac0d }
    ],
    boss: {
      kind: "bot",
      name: "Titã Trovão",
      tint: 0xb7950b,
      scale: 3.6
    }
  },
  {
    id: "sombrio",
    name: "Reino Sombrio",
    accent: 0x9b59b6,
    floorTint: 0xe8daef,
    enemies: [
      { kind: "eye", name: "Olho das Sombras", tint: 0xaf7ac5 },
      { kind: "bug", name: "Aranha Umbral", tint: 0x7d3c98 },
      { kind: "bot", name: "Autômato Negro", tint: 0x5b2c6f },
      { kind: "kernel", name: "Fragmento", tint: 0xd2b4de }
    ],
    boss: {
      kind: "eye",
      name: "Senhor das Trevas",
      tint: 0x4a235a,
      scale: 3.7
    }
  },
  {
    id: "inferno",
    name: "Reino Infernal",
    accent: 0xe74c3c,
    floorTint: 0xfadbd8,
    enemies: [
      { kind: "pop", name: "Brasa Viva", tint: 0xe67e22 },
      { kind: "bot", name: "Golem de Magma", tint: 0xcb4335 },
      { kind: "bug", name: "Escorpião Flamejante", tint: 0xd35400 },
      { kind: "eye", name: "Olho do Inferno", tint: 0xc0392b }
    ],
    boss: {
      kind: "pop",
      name: "Demoninho Chefão",
      tint: 0x922b21,
      scale: 3.8
    }
  }
];

export const ULTRA_BOSS = {
  id: "ultra" as const,
  name: "Ultra Boss",
  kingdomName: "Núcleo Final",
  kind: "bot" as EnemyKind,
  tint: 0xffd700,
  scale: 4.6,
  accent: 0xffd700
};

export const FINAL_CHAPTER_BOSS_FLOOR = 60;
export const ULTRA_BOSS_FLOOR = 61;

/**
 * Capítulo do reino.
 * Campanha: 0–5 (trava no último). Infinito: cicla 0–5 pra sempre.
 */
export function chapterIndex(floor: number, endless = false) {
  if (!endless && floor >= ULTRA_BOSS_FLOOR) return 6;
  const raw = Math.floor((Math.max(1, floor) - 1) / 10);
  return endless ? raw % KINGDOMS.length : Math.min(5, raw);
}

export function kingdomForFloor(floor: number, endless = false): KingdomDef {
  const idx = Math.min(5, chapterIndex(floor, endless));
  return KINGDOMS[idx];
}

/** Andar local no capítulo (1–10). */
export function localFloor(floor: number, endless = false) {
  if (!endless && floor >= ULTRA_BOSS_FLOOR) return 11;
  return ((Math.max(1, floor) - 1) % 10) + 1;
}

/**
 * Unlock progressivo no reino:
 * 1–2: só 1º · 3–4: +2º · 5–6: +3º · 7–9: todos · 10: boss
 */
export function enemiesForFloor(
  floor: number,
  endless = false
): KingdomEnemySlot[] {
  if (!endless && floor >= ULTRA_BOSS_FLOOR) return [];
  const k = kingdomForFloor(floor, endless);
  const local = localFloor(floor, endless);
  if (local >= 10) return [];
  let count = 1;
  if (local >= 3) count = 2;
  if (local >= 5) count = 3;
  if (local >= 7) count = 4;
  return k.enemies.slice(0, count);
}

export function isUltraBossFloor(floor: number) {
  return floor === ULTRA_BOSS_FLOOR;
}

export function isCampaignBossFloor(floor: number) {
  return floor > 0 && floor <= FINAL_CHAPTER_BOSS_FLOOR && floor % 10 === 0;
}
