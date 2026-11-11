import type { BookId, CapeId } from "./MetaState";

export type EquipTab = "cape" | "book";

/** Seleção temporária da UI do armário (sobrevive a restart da scene). */
export const uiSel = {
  tab: "cape" as EquipTab,
  cape: "default" as CapeId,
  book: "fire" as BookId
};
