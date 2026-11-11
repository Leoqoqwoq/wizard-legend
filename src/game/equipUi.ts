import type { BookId, CapeId } from "./MetaState";

export type EquipTab = "cape" | "book";

/** Seleção temporária da UI do armário (sobrevive a restart da scene). */
export const uiSel = {
  tab: "cape" as EquipTab,
  cape: "default" as CapeId,
  book: "fire" as BookId
};

/** Posição do mago no lobby ao abrir o armário (evita respawn no início). */
export const lobbyReturn = {
  x: null as number | null,
  y: null as number | null,
  facing: "up" as string
};

export function saveLobbyReturn(x: number, y: number, facing: string) {
  lobbyReturn.x = x;
  lobbyReturn.y = y;
  lobbyReturn.facing = facing;
}

export function clearLobbyReturn() {
  lobbyReturn.x = null;
  lobbyReturn.y = null;
}

export function takeLobbyReturn() {
  const pos = { x: lobbyReturn.x, y: lobbyReturn.y, facing: lobbyReturn.facing };
  lobbyReturn.x = null;
  lobbyReturn.y = null;
  return pos;
}
