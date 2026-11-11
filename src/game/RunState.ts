import type { SkillId } from "./skills";

/** Estado persistente da run (entre salas / skill select). */
export interface RunState {
  floor: number;
  coins: number;
  hp: number;
  maxHp: number;
  skills: Partial<Record<SkillId, number>>;
  pendingSkillPick: boolean;
  clearedFloor: boolean;
}

export function createRunState(): RunState {
  return {
    floor: 1,
    coins: 0,
    hp: 4,
    maxHp: 4,
    skills: {},
    pendingSkillPick: false,
    clearedFloor: false
  };
}

export const runState: RunState = createRunState();

export function resetRun() {
  Object.assign(runState, createRunState());
}
