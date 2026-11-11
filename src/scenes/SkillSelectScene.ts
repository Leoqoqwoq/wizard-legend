import Phaser from "phaser";
import { runState } from "../game/RunState";
import { BOOKS, metaState } from "../game/MetaState";
import {
  SKILLS,
  randomSkillChoices,
  skillIconKey,
  type SkillId
} from "../game/skills";
import { isBossFloor } from "../game/RunState";
import { followBrowserFrame } from "../game/followBrowser";

const CARD_KEYS = ["ui_soft_card", "ui_soft_card_alt", "ui_soft_card_warm"] as const;

export class SkillSelectScene extends Phaser.Scene {
  private choices: SkillId[] = [];
  private cardsRoot?: Phaser.GameObjects.Container;
  private bias: SkillId[] = [];

  constructor() {
    super("SkillSelect");
  }

  create() {
    const { width, height } = this.scale;
    followBrowserFrame(this);
    this.bias = BOOKS[metaState.equippedBook].skillBias as SkillId[];
    this.choices = randomSkillChoices(runState.skills, 3, this.bias);

    // Fundo suave com vinheta
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1028, 1);
    const veil = this.add.graphics().setDepth(0);
    veil.fillStyle(0x2d1b4e, 0.55);
    veil.fillCircle(width * 0.2, height * 0.25, Math.min(width, height) * 0.35);
    veil.fillStyle(0x4a2868, 0.35);
    veil.fillCircle(width * 0.8, height * 0.7, Math.min(width, height) * 0.3);

    this.drawSkillBook(width / 2, Math.min(150, height * 0.2));

    this.add
      .text(width / 2, Math.min(268, height * 0.34), "Escolha uma habilidade", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#f8e9ff",
        stroke: "#1a1028",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.cardsRoot = this.add.container(0, 0).setDepth(8);
    this.renderCards();

    const giveCoins = 5 + runState.floor * 2;
    this.makeSoftButton(
      width / 2,
      height - 64,
      250,
      50,
      "ui_soft_btn_brown",
      `Desistir  ·  +${giveCoins} coins`,
      () => {
        runState.coins += giveCoins;
        this.finish();
      }
    );

    this.makeSoftButton(
      width / 2,
      height - 124,
      180,
      46,
      "ui_soft_btn",
      "Atualizar",
      () => {
        this.choices = randomSkillChoices(runState.skills, 3, this.bias);
        this.renderCards();
      }
    );
  }

  private renderCards() {
    this.cardsRoot?.removeAll(true);
    const { width, height } = this.scale;
    const cardY = Math.min(height * 0.55, height - 210);

    if (this.choices.length === 0) {
      this.cardsRoot?.add(
        this.add
          .text(width / 2, cardY, "Skills no máximo", {
            fontFamily: "Arial Black, Arial",
            fontSize: "18px",
            color: "#f5e6ff"
          })
          .setOrigin(0.5)
      );
      return;
    }

    const gap = Math.min(150, width / (this.choices.length + 0.5));
    const startX = width / 2 - ((this.choices.length - 1) * gap) / 2;
    this.choices.forEach((id, i) => {
      this.createCard(startX + i * gap, cardY, id, i);
    });
  }

  private makeSoftButton(
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
        color: "#ffffff",
        stroke: "#2a1038",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(11);
    img.on("pointerdown", onClick);
    img.on("pointerover", () => {
      img.setTint(0xffe8ff);
      img.setScale(img.scaleX * 1.04, img.scaleY * 1.04);
    });
    img.on("pointerout", () => {
      img.clearTint();
      img.setDisplaySize(w, h);
    });
  }

  private drawSkillBook(x: number, y: number) {
    const book = this.add
      .image(x, y, "ui_soft_book")
      .setDisplaySize(Math.min(380, this.scale.width - 40), 200)
      .setDepth(2)
      .setAlpha(0)
      .setScale(0.86);

    this.add
      .text(x, y - 118, "Livro de Skills", {
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
      const sx = x + page * 88 + (localCol - 0.5) * 58;
      const sy = y - 22 + row * 56;

      const ownedId = ids[i];
      slots.add(
        this.add
          .image(sx, sy, "ui_soft_slot")
          .setDisplaySize(46, 46)
          .setAlpha(ownedId ? 1 : 0.55)
      );

      if (ownedId) {
        const def = SKILLS[ownedId];
        slots.add(
          this.add.image(sx, sy - 1, skillIconKey(def)).setDisplaySize(36, 36)
        );
        const stacks = runState.skills[ownedId] ?? 1;
        slots.add(
          this.add
            .text(sx + 14, sy + 14, String(stacks), {
              fontFamily: "Arial Black, Arial",
              fontSize: "12px",
              color: "#fff",
              stroke: "#000",
              strokeThickness: 3
            })
            .setOrigin(0.5)
        );
      }
    }

    this.tweens.add({
      targets: book,
      alpha: 1,
      scale: 1,
      duration: 380,
      ease: "Back.easeOut"
    });
    this.tweens.add({
      targets: slots,
      alpha: 1,
      delay: 160,
      duration: 280
    });
  }

  private createCard(x: number, y: number, id: SkillId, index: number) {
    const def = SKILLS[id];
    const panelKey = CARD_KEYS[index % CARD_KEYS.length];
    const root = this.cardsRoot!;

    const wrap = this.add.container(x, y).setAlpha(0).setScale(0.72);
    const card = this.add
      .image(0, 0, panelKey)
      .setDisplaySize(118, 176)
      .setInteractive({ useHandCursor: true });
    const iconGlow = this.add.image(0, -28, "ui_soft_slot").setDisplaySize(58, 58);
    const icon = this.add.image(0, -28, skillIconKey(def)).setDisplaySize(48, 48);
    const title = this.add
      .text(0, -72, def.name, {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#3b2414",
        align: "center",
        wordWrap: { width: 96 }
      })
      .setOrigin(0.5);
    const desc = this.add
      .text(0, 36, def.description, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#4a2e18",
        align: "center",
        wordWrap: { width: 92 }
      })
      .setOrigin(0.5);
    const stacks = runState.skills[id] ?? 0;
    const lv = this.add
      .text(0, 68, `Nv. ${stacks + 1}`, {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#6b3a1f"
      })
      .setOrigin(0.5);

    wrap.add([card, iconGlow, icon, title, desc, lv]);
    root.add(wrap);

    this.tweens.add({
      targets: wrap,
      alpha: 1,
      scale: 1,
      delay: 80 + index * 90,
      duration: 340,
      ease: "Back.easeOut"
    });

    card.on("pointerover", () => {
      card.setTint(0xfff6d8);
      this.tweens.add({ targets: wrap, scale: 1.08, duration: 120 });
    });
    card.on("pointerout", () => {
      card.clearTint();
      this.tweens.add({ targets: wrap, scale: 1, duration: 120 });
    });
    card.on("pointerdown", () => {
      this.tweens.add({
        targets: wrap,
        scale: 1.16,
        alpha: 0.25,
        duration: 140,
        onComplete: () => {
          runState.skills[id] = (runState.skills[id] ?? 0) + 1;
          if (id === "hp_boost") {
            runState.maxHp += 1;
            runState.hp = Math.min(runState.maxHp, runState.hp + 1);
          }
          this.finish();
        }
      });
    });
  }

  private finish() {
    runState.pendingSkillPick = false;
    runState.clearedFloor = false;
    runState.floor += 1;
    if (isBossFloor(runState.floor)) this.scene.start("PrepRoom");
    else this.scene.start("Game");
  }
}
