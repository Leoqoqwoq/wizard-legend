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
    const cardY = Math.min(height * 0.56, height - 220);

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

    const gap = Math.min(168, width / (this.choices.length + 0.35));
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
    const stacks = runState.skills[id] ?? 0;
    const isNew = stacks === 0;
    const nextLv = stacks + 1;

    const wrap = this.add.container(x, y).setAlpha(0).setScale(0.68);
    const glow = this.add
      .ellipse(0, 8, 132, 198, def.color, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);

    const card = this.add
      .image(0, 0, panelKey)
      .setDisplaySize(132, 198)
      .setInteractive({ useHandCursor: true });

    const title = this.add
      .text(0, -78, def.name, {
        fontFamily: "Arial Black, Arial",
        fontSize: "12px",
        color: "#2e1a0c",
        align: "center",
        wordWrap: { width: 108 }
      })
      .setOrigin(0.5);

    const iconRing = this.add
      .circle(0, -18, 34, 0xffffff, 0.12)
      .setStrokeStyle(2, def.color, 0.55);
    const icon = this.add
      .image(0, -18, skillIconKey(def))
      .setDisplaySize(52, 52);

    const desc = this.add
      .text(0, 42, def.description, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#4a2e18",
        align: "center",
        wordWrap: { width: 104 },
        lineSpacing: 2
      })
      .setOrigin(0.5);

    const badgeKey = isNew ? "ui_soft_badge_new" : "ui_soft_badge";
    const badge = this.add.image(0, 78, badgeKey).setDisplaySize(78, 28);
    const badgeTxt = this.add
      .text(0, 78, isNew ? "NOVA" : `Nv. ${nextLv}`, {
        fontFamily: "Arial Black, Arial",
        fontSize: "12px",
        color: isNew ? "#1e4a12" : "#4a2e08",
        stroke: "#fff8e0",
        strokeThickness: 2
      })
      .setOrigin(0.5);

    wrap.add([glow, card, title, iconRing, icon, desc, badge, badgeTxt]);
    root.add(wrap);

    this.tweens.add({
      targets: wrap,
      alpha: 1,
      scale: 1,
      delay: 70 + index * 95,
      duration: 360,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: wrap,
          y: y - 5,
          duration: 1400 + index * 120,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    });

    card.on("pointerover", () => {
      card.setTint(0xfff8e8);
      glow.setAlpha(0.42);
      this.tweens.add({
        targets: wrap,
        scale: 1.1,
        duration: 130,
        ease: "Back.easeOut"
      });
      this.tweens.add({
        targets: icon,
        angle: { from: -6, to: 6 },
        duration: 220,
        yoyo: true
      });
    });
    card.on("pointerout", () => {
      card.clearTint();
      glow.setAlpha(0.22);
      icon.setAngle(0);
      this.tweens.add({ targets: wrap, scale: 1, duration: 120 });
    });
    card.on("pointerdown", () => {
      this.tweens.killTweensOf(wrap);
      this.tweens.add({
        targets: wrap,
        scale: 1.2,
        alpha: 0.15,
        y: y - 24,
        duration: 160,
        ease: "Cubic.easeIn",
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
