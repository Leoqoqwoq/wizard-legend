import type { SkillId } from "./skills";
import {
  FINAL_CHAPTER_BOSS_FLOOR,
  ULTRA_BOSS_FLOOR,
  isCampaignBossFloor,
  isUltraBossFloor as isUltraFloorNum
} from "./kingdoms";

export type RunMode = "campaign" | "endless";

/** Estado persistente da run (entre salas / skill select). */
export interface RunState {
  mode: RunMode;
  floor: number;
  coins: number;
  hp: number;
  maxHp: number;
  skills: Partial<Record<SkillId, number>>;
  pendingSkillPick: boolean;
  clearedFloor: boolean;
  /** Derrotou o Ultra Boss — vitória da campanha */
  campaignWon: boolean;
}

export function createRunState(mode: RunMode = "campaign"): RunState {
  return {
    mode,
    floor: 1,
    coins: 0,
    hp: 4,
    maxHp: 4,
    skills: {},
    pendingSkillPick: false,
    clearedFloor: false,
    campaignWon: false
  };
}

export const runState: RunState = createRunState();

export function resetRun(mode: RunMode = "campaign") {
  Object.assign(runState, createRunState(mode));
}

/** Boss: campanha 10–60 + ultra 61 · infinito a cada 10 sem fim. */
export function isBossFloor(floor: number) {
  if (runState.mode === "endless") {
    return floor > 0 && floor % 10 === 0;
  }
  return isCampaignBossFloor(floor) || isUltraFloorNum(floor);
}

export function isFinalCampaignFloor(floor: number) {
  return runState.mode === "campaign" && floor === ULTRA_BOSS_FLOOR;
}

export function isUltraBossFloor(floor: number) {
  return runState.mode === "campaign" && isUltraFloorNum(floor);
}

export { FINAL_CHAPTER_BOSS_FLOOR, ULTRA_BOSS_FLOOR };
