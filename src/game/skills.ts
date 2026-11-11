export type SkillId =
  | "front_arrow"
  | "dark_missile"
  | "thorns"
  | "fury_of_thor"
  | "flame_elf"
  | "ricochet"
  | "multishot"
  | "diagonal"
  | "attack_speed"
  | "hp_boost"
  | "wall_bounce"
  | "freeze";

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  color: number;
  /** Índice legado (Critters); ícone real vem de skill_gen_* */
  iconIndex: number;
  maxStacks: number;
}

export function skillIconKey(def: SkillDef) {
  // Prefer ícones baixados estilo WL; fallback procedural
  return `skill_wl_${def.id}`;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  front_arrow: {
    id: "front_arrow",
    name: "Front Arrow",
    description: "Dispara +1 projétil à frente",
    color: 0xe74c3c,
    iconIndex: 0,
    maxStacks: 3
  },
  dark_missile: {
    id: "dark_missile",
    name: "Dark Missile",
    description: "Mísseis escuros teleguiados",
    color: 0x8e44ad,
    iconIndex: 1,
    maxStacks: 3
  },
  thorns: {
    id: "thorns",
    name: "Thorns",
    description: "Reflete parte do dano recebido",
    color: 0x27ae60,
    iconIndex: 2,
    maxStacks: 2
  },
  fury_of_thor: {
    id: "fury_of_thor",
    name: "Fury of Thor",
    description: "Raios atingem inimigos próximos",
    color: 0xf1c40f,
    iconIndex: 3,
    maxStacks: 3
  },
  flame_elf: {
    id: "flame_elf",
    name: "Flame Elf",
    description: "Espírito de fogo que ataca sozinho",
    color: 0xe67e22,
    iconIndex: 4,
    maxStacks: 2
  },
  ricochet: {
    id: "ricochet",
    name: "Ricochet",
    description: "Projéteis saltam entre inimigos",
    color: 0x3498db,
    iconIndex: 5,
    maxStacks: 2
  },
  multishot: {
    id: "multishot",
    name: "Multishot",
    description: "Dispara rajadas extras",
    color: 0x1abc9c,
    iconIndex: 6,
    maxStacks: 3
  },
  diagonal: {
    id: "diagonal",
    name: "Diagonal Arrows",
    description: "Dispara na diagonal",
    color: 0x9b59b6,
    iconIndex: 7,
    maxStacks: 2
  },
  attack_speed: {
    id: "attack_speed",
    name: "Attack Speed",
    description: "Ataques mais rápidos",
    color: 0x2ecc71,
    iconIndex: 8,
    maxStacks: 5
  },
  hp_boost: {
    id: "hp_boost",
    name: "HP Recovery",
    description: "+1 vida máxima e cura",
    color: 0xff6b81,
    iconIndex: 9,
    maxStacks: 5
  },
  wall_bounce: {
    id: "wall_bounce",
    name: "Wall Bounce",
    description: "Projéteis ricocheteiam nas paredes",
    color: 0x95a5a6,
    iconIndex: 10,
    maxStacks: 2
  },
  freeze: {
    id: "freeze",
    name: "Freeze",
    description: "Chance de congelar inimigos",
    color: 0x74b9ff,
    iconIndex: 11,
    maxStacks: 2
  }
};

export function randomSkillChoices(
  owned: Partial<Record<SkillId, number>>,
  count = 3,
  bias: SkillId[] = []
): SkillId[] {
  const pool = (Object.keys(SKILLS) as SkillId[]).filter(
    (id) => (owned[id] ?? 0) < SKILLS[id].maxStacks
  );
  // Libro equipado: duplica chance das skills do bias
  const weighted: SkillId[] = [...pool];
  bias.forEach((id) => {
    if (pool.includes(id)) weighted.push(id, id);
  });
  const shuffled = [...weighted].sort(() => Math.random() - 0.5);
  const picked: SkillId[] = [];
  for (const id of shuffled) {
    if (!picked.includes(id)) picked.push(id);
    if (picked.length >= Math.min(count, pool.length)) break;
  }
  return picked;
}
