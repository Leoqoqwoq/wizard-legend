import Phaser from "phaser";
import { runState } from "../game/RunState";
import { BOOKS, metaState } from "../game/MetaState";
import {
  SKILLS,
  randomSkillChoices,
  skillIconKey,
  type SkillId
} from "../game/skills";

export class SkillSelectScene extends Phaser.Scene {
  private choices: SkillId[] = [];

  constructor() {
    super("SkillSelect");
  }

  create() {
    const { width, height } = this.scale;
    const bias = BOOKS[metaState.equippedBook].skillBias as SkillId[];
    this.choices = randomSkillChoices(runState.skills, 3, bias);

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1028, 0.94);

    this.drawSkillBook(width / 2, 155);

    // Banner Choose one
    const banner = this.add
      .image(width / 2, 285, "ui_btn_blue")
      .setDisplaySize(200, 40)
      .setDepth(5);
    this.add
      .text(width / 2, 285, "Choose one", {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(6);
    void banner;

    // Cartas (Kenney panels + Critters icons)
    const startX = width / 2 - 112;
    this.choices.forEach((id, i) => {
      this.createCard(startX + i * 112, 430, id, i);
    });

    const giveCoins = 5 + runState.floor * 2;
    this.makeButton(width / 2, height - 70, 230, 46, "ui_btn_brown", `Give up +${giveCoins} Coins`, () => {
      runState.coins += giveCoins;
      this.finish();
    });

    this.makeButton(width / 2, height - 130, 170, 42, "ui_btn", "↻ Refresh", () => {
      this.scene.restart();
    });
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    key: string,
    label: string,
    onClick: () => void
  ) {
    const img = this.add
      .image(x, y, key)
      .setDisplaySize(w, h)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    this.add
      .text(x, y, label, {
        fontFamily: "Arial Black, Arial",
        fontSize: "15px",
        color: "#2c1a0a",
        stroke: "#fff8e7",
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(11);
    img.on("pointerdown", onClick);
    img.on("pointerover", () => img.setTint(0xffe0a0));
    img.on("pointerout", () => img.clearTint());
  }

  private drawSkillBook(x: number, y: number) {
    // Duas páginas (painéis Kenney) + faixa Critters
    this.add
      .image(x - 82, y, "ui_panel_card")
      .setDisplaySize(160, 175)
      .setDepth(2);
    this.add
      .image(x + 82, y, "ui_panel_card_alt")
      .setDisplaySize(160, 175)
      .setDepth(2);

    this.add
      .image(x, y - 92, "ui_book_strip")
      .setDisplaySize(310, 30)
      .setDepth(3);

    this.add
      .text(x, y - 92, "Skill Book", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#4a3020"
      })
      .setOrigin(0.5)
      .setDepth(4);

    const ids = Object.keys(runState.skills) as SkillId[];
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const page = col < 2 ? -1 : 1;
      const localCol = col % 2;
      const sx = x + page * 82 + (localCol - 0.5) * 56;
      const sy = y - 32 + row * 56;

      const ownedId = ids[i];
      this.add
        .image(sx, sy, ownedId ? "ui_slot_filled" : "ui_slot")
        .setDisplaySize(46, 46)
        .setDepth(4);

      if (ownedId) {
        const def = SKILLS[ownedId];
        this.add
          .image(sx, sy - 2, skillIconKey(def))
          .setDisplaySize(28, 28)
          .setDepth(5);
        const stacks = runState.skills[ownedId] ?? 1;
        this.add
          .text(sx + 14, sy + 14, String(stacks), {
            fontFamily: "Arial Black, Arial",
            fontSize: "12px",
            color: "#fff",
            stroke: "#000",
            strokeThickness: 3
          })
          .setOrigin(0.5)
          .setDepth(6);
      }
    }
  }

  private createCard(x: number, y: number, id: SkillId, index: number) {
    const def = SKILLS[id];
    const panelKey = index % 2 === 0 ? "ui_panel_card" : "ui_panel_card_alt";

    const card = this.add
      .image(x, y, panelKey)
      .setDisplaySize(100, 148)
      .setInteractive({ useHandCursor: true })
      .setDepth(8);

    this.add
      .image(x, y - 28, "ui_slot")
      .setDisplaySize(52, 52)
      .setDepth(9);

    this.add
      .image(x, y - 28, skillIconKey(def))
      .setDisplaySize(36, 36)
      .setDepth(10);

    this.add
      .text(x, y - 68, def.name, {
        fontFamily: "Arial Black, Arial",
        fontSize: "11px",
        color: "#3b2414",
        align: "center",
        wordWrap: { width: 88 }
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(x, y + 28, def.description, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#2c1a0a",
        align: "center",
        wordWrap: { width: 84 }
      })
      .setOrigin(0.5)
      .setDepth(10);

    const stacks = runState.skills[id] ?? 0;
    this.add
      .text(x, y + 58, `Lv ${stacks + 1}`, {
        fontFamily: "Arial Black, Arial",
        fontSize: "12px",
        color: "#6b3a1f"
      })
      .setOrigin(0.5)
      .setDepth(10);

    card.on("pointerover", () => {
      card.setTint(0xfff0c8);
      card.setDisplaySize(108, 158);
    });
    card.on("pointerout", () => {
      card.clearTint();
      card.setDisplaySize(100, 148);
    });
    card.on("pointerdown", () => {
      runState.skills[id] = (runState.skills[id] ?? 0) + 1;
      if (id === "hp_boost") {
        runState.maxHp += 1;
        runState.hp = Math.min(runState.maxHp, runState.hp + 1);
      }
      this.finish();
    });
  }

  private finish() {
    runState.pendingSkillPick = false;
    runState.clearedFloor = false;
    runState.floor += 1;
    this.scene.start("Game");
  }
}
