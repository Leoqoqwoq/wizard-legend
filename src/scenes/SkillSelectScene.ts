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
  private cardsRoot?: Phaser.GameObjects.Container;

  constructor() {
    super("SkillSelect");
  }

  create() {
    const { width, height } = this.scale;
    const bias = BOOKS[metaState.equippedBook].skillBias as SkillId[];
    this.choices = randomSkillChoices(runState.skills, 3, bias);

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1028, 0.94);

    this.drawSkillBook(width / 2, 168);

    const banner = this.add
      .image(width / 2, 300, "ui_btn_blue")
      .setDisplaySize(200, 40)
      .setDepth(5);
    this.add
      .text(width / 2, 300, "Choose one", {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(6);
    void banner;

    this.cardsRoot = this.add.container(0, 0).setDepth(8);
    this.renderCards();

    const giveCoins = 5 + runState.floor * 2;
    this.makeButton(width / 2, height - 70, 230, 46, "ui_btn_brown", `Give up +${giveCoins} Coins`, () => {
      runState.coins += giveCoins;
      this.finish();
    });

    this.makeButton(width / 2, height - 130, 170, 42, "ui_btn", "↻ Refresh", () => {
      this.choices = randomSkillChoices(runState.skills, 3, bias);
      this.renderCards();
    });
  }

  private renderCards() {
    this.cardsRoot?.removeAll(true);
    const { width } = this.scale;

    if (this.choices.length === 0) {
      this.cardsRoot?.add(
        this.add
          .text(width / 2, 430, "Skills no máximo", {
            fontFamily: "Arial Black, Arial",
            fontSize: "16px",
            color: "#f5e6ff"
          })
          .setOrigin(0.5)
      );
      return;
    }

    const startX = width / 2 - (this.choices.length - 1) * 56;
    this.choices.forEach((id, i) => {
      this.createCard(startX + i * 112, 430, id, i);
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
    // Livro real (Critters) em vez de dois painéis + faixa esticada errada
    const bookBg = this.add
      .image(x, y, "ui_book")
      .setDisplaySize(340, 192)
      .setDepth(2)
      .setAlpha(0);

    const opener = this.add
      .sprite(x, y, "ui_book_strip", 0)
      .setDisplaySize(200, 112)
      .setDepth(3);

    this.add
      .text(x, y - 112, "Skill Book", {
        fontFamily: "Arial Black, Arial",
        fontSize: "16px",
        color: "#f5e6ff",
        stroke: "#1a1028",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(4);

    const slots = this.add.container(0, 0).setDepth(5).setAlpha(0);
    const ids = Object.keys(runState.skills) as SkillId[];

    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const page = col < 2 ? -1 : 1;
      const localCol = col % 2;
      // Páginas do ui_book: centro da lombada em x, páginas ~±70
      const sx = x + page * 78 + (localCol - 0.5) * 52;
      const sy = y - 18 + row * 52;

      const ownedId = ids[i];
      slots.add(
        this.add
          .image(sx, sy, ownedId ? "ui_slot_filled" : "ui_slot")
          .setDisplaySize(44, 44)
      );

      if (ownedId) {
        const def = SKILLS[ownedId];
        slots.add(
          this.add.image(sx, sy - 2, skillIconKey(def)).setDisplaySize(26, 26)
        );
        const stacks = runState.skills[ownedId] ?? 1;
        slots.add(
          this.add
            .text(sx + 13, sy + 13, String(stacks), {
              fontFamily: "Arial Black, Arial",
              fontSize: "11px",
              color: "#fff",
              stroke: "#000",
              strokeThickness: 3
            })
            .setOrigin(0.5)
        );
      }
    }

    opener.play("book-open");
    opener.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.tweens.add({
        targets: opener,
        alpha: 0,
        duration: 160,
        onComplete: () => opener.destroy()
      });
      this.tweens.add({
        targets: [bookBg, slots],
        alpha: 1,
        duration: 180
      });
    });
  }

  private createCard(x: number, y: number, id: SkillId, index: number) {
    const def = SKILLS[id];
    const panelKey = index % 2 === 0 ? "ui_panel_card" : "ui_panel_card_alt";
    const root = this.cardsRoot!;

    const card = this.add
      .image(x, y, panelKey)
      .setDisplaySize(100, 148)
      .setInteractive({ useHandCursor: true });

    root.add(card);
    root.add(this.add.image(x, y - 28, "ui_slot").setDisplaySize(52, 52));
    root.add(this.add.image(x, y - 28, skillIconKey(def)).setDisplaySize(36, 36));
    root.add(
      this.add
        .text(x, y - 68, def.name, {
          fontFamily: "Arial Black, Arial",
          fontSize: "11px",
          color: "#3b2414",
          align: "center",
          wordWrap: { width: 88 }
        })
        .setOrigin(0.5)
    );
    root.add(
      this.add
        .text(x, y + 28, def.description, {
          fontFamily: "Arial",
          fontSize: "10px",
          color: "#2c1a0a",
          align: "center",
          wordWrap: { width: 84 }
        })
        .setOrigin(0.5)
    );

    const stacks = runState.skills[id] ?? 0;
    root.add(
      this.add
        .text(x, y + 58, `Lv ${stacks + 1}`, {
          fontFamily: "Arial Black, Arial",
          fontSize: "12px",
          color: "#6b3a1f"
        })
        .setOrigin(0.5)
    );

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
