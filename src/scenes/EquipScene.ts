import Phaser from "phaser";
import {
  bookIconKey,
  capeIconKey,
  ensureEquipIcons
} from "../game/equipIcons";
import { uiSel, type EquipTab } from "../game/equipUi";
import {
  BOOKS,
  CAPES,
  buyBook,
  buyCape,
  metaState,
  ownBook,
  ownCape,
  type BookId,
  type CapeId
} from "../game/MetaState";

/** Armário estilo WL: abas Capa / Libro, preview do mago, compra em gemas. */
export class EquipScene extends Phaser.Scene {
  private detailTitle!: Phaser.GameObjects.Text;
  private detailBonus!: Phaser.GameObjects.Text;
  private detailBtnLabel!: Phaser.GameObjects.Text;
  private detailBtn!: Phaser.GameObjects.Image;
  private gemText!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Sprite;

  constructor() {
    super("Equip");
  }

  create() {
    const { width, height } = this.scale;
    ensureEquipIcons(this);

    uiSel.cape = metaState.equippedCape;
    if (metaState.equippedBook !== "none") uiSel.book = metaState.equippedBook;

    // fundo lavanda
    this.add.rectangle(width / 2, height / 2, width, height, 0x3b2460);
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2a1848, 0.55);
    g.fillCircle(40, 120, 90);
    g.fillCircle(width - 20, 280, 70);
    g.fillStyle(0x5b3a8c, 0.35);
    g.fillCircle(width / 2, height - 160, 120);

    // faixa título
    this.add
      .rectangle(width / 2, 34, 160, 36, 0x7d3c98)
      .setStrokeStyle(2, 0xd2b4de)
      .setDepth(2);
    this.add
      .text(width / 2, 34, uiSel.tab === "cape" ? "Capa" : "Libro", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#fff8ff"
      })
      .setOrigin(0.5)
      .setDepth(3);

    // gemas
    this.add.image(width - 78, 34, "gem").setDisplaySize(26, 26).setDepth(20);
    this.gemText = this.add
      .text(width - 60, 34, String(metaState.gems), {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#fff"
      })
      .setOrigin(0, 0.5)
      .setDepth(20);

    // preview mago
    this.add
      .ellipse(88, 168, 70, 18, 0x000000, 0.25)
      .setDepth(4);
    this.preview = this.add
      .sprite(88, 128, "wizard", 0)
      .setScale(2.8)
      .setDepth(5);
    this.preview.play("player-idle-down");
    this.applyPreviewTint();

    // painel pergaminho detalhe
    this.add
      .image(250, 118, "ui_panel_card")
      .setDisplaySize(210, 118)
      .setDepth(4);

    this.detailTitle = this.add
      .text(250, 78, "", {
        fontFamily: "Arial Black, Arial",
        fontSize: "15px",
        color: "#3b2414",
        wordWrap: { width: 180 }
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.detailBonus = this.add
      .text(250, 108, "", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#2c1a0a",
        align: "center",
        wordWrap: { width: 180 },
        lineSpacing: 2
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.detailBtn = this.add
      .image(250, 152, "ui_btn")
      .setDisplaySize(130, 34)
      .setDepth(5)
      .setTint(0x58d68d)
      .setInteractive({ useHandCursor: true });
    this.detailBtnLabel = this.add
      .text(250, 152, "Comprar", {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#143d1a"
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.detailBtn.on("pointerdown", () => this.onAction());

    // abas
    this.makeTab(width / 2 - 72, 210, "Capa", "cape");
    this.makeTab(width / 2 + 72, 210, "Libro", "book");

    // container grade
    this.add
      .rectangle(width / 2, 390, width - 28, 300, 0x4a2f75, 0.55)
      .setStrokeStyle(2, 0x9b7ed9, 0.45)
      .setDepth(2);

    this.buildGrid();
    this.buildBottomNav();
    this.refreshDetail();
  }

  private makeTab(x: number, y: number, label: string, tab: EquipTab) {
    const active = tab === uiSel.tab;
    const img = this.add
      .image(x, y, active ? "ui_btn_blue" : "ui_btn")
      .setDisplaySize(124, 38)
      .setInteractive({ useHandCursor: true })
      .setDepth(8);
    if (!active) img.setTint(0xb8a0d8);
    this.add
      .text(x, y, label, {
        fontFamily: "Arial Black, Arial",
        fontSize: "15px",
        color: active ? "#1a1028" : "#3b2460"
      })
      .setOrigin(0.5)
      .setDepth(9);
    img.on("pointerdown", () => {
      if (uiSel.tab === tab) return;
      uiSel.tab = tab;
      this.scene.restart();
    });
  }

  private buildGrid() {
    const { width } = this.scale;
    const startY = 275;

    if (uiSel.tab === "cape") {
      (Object.keys(CAPES) as CapeId[]).forEach((id, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        this.addCapeCell(width / 2 - 105 + col * 105, startY + row * 100, id);
      });
    } else {
      (Object.keys(BOOKS) as BookId[])
        .filter((id) => id !== "none")
        .forEach((id, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          this.addBookCell(width / 2 - 105 + col * 105, startY + row * 100, id);
        });
    }
  }

  private addCapeCell(x: number, y: number, id: CapeId) {
    const def = CAPES[id];
    const selected = uiSel.cape === id;
    const owned = ownCape(id);
    const equipped = metaState.equippedCape === id;

    const slot = this.add
      .image(x, y, selected ? "ui_slot_filled" : "ui_slot")
      .setDisplaySize(88, 88)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    if (selected) {
      slot.setTint(0xa8e4ff);
      this.add
        .rectangle(x, y, 92, 92)
        .setStrokeStyle(3, 0x5dade2, 1)
        .setDepth(10);
    }

    this.add
      .image(x, y - 6, capeIconKey(id))
      .setDisplaySize(52, 52)
      .setDepth(11)
      .setAlpha(owned ? 1 : 0.55);

    let footer = "";
    let color = "#f5e6ff";
    if (!owned) footer = `${def.price}◆`;
    else if (equipped) {
      footer = "ON";
      color = "#82e0aa";
    }
    if (footer) {
      this.add
        .text(x, y + 34, footer, {
          fontSize: "12px",
          color,
          fontFamily: "Arial Black, Arial",
          stroke: "#1a1028",
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(12);
    }

    slot.on("pointerdown", () => {
      uiSel.cape = id;
      this.scene.restart();
    });
  }

  private addBookCell(x: number, y: number, id: BookId) {
    const def = BOOKS[id];
    const selected = uiSel.book === id;
    const owned = ownBook(id);
    const equipped = metaState.equippedBook === id;

    const slot = this.add
      .image(x, y, selected ? "ui_slot_filled" : "ui_slot")
      .setDisplaySize(88, 88)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    if (selected) {
      this.add
        .rectangle(x, y, 92, 92)
        .setStrokeStyle(3, 0xf7dc6f, 1)
        .setDepth(10);
    }

    this.add
      .image(x, y - 6, bookIconKey(id))
      .setDisplaySize(48, 48)
      .setDepth(11)
      .setAlpha(owned ? 1 : 0.55);

    let footer = "";
    let color = "#f5e6ff";
    if (!owned) footer = `${def.price}◆`;
    else if (equipped) {
      footer = "ON";
      color = "#82e0aa";
    }
    if (footer) {
      this.add
        .text(x, y + 34, footer, {
          fontSize: "12px",
          color,
          fontFamily: "Arial Black, Arial",
          stroke: "#1a1028",
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(12);
    }

    slot.on("pointerdown", () => {
      uiSel.book = id;
      this.scene.restart();
    });
  }

  private buildBottomNav() {
    const { width, height } = this.scale;
    const y = height - 42;
    this.add
      .rectangle(width / 2, y, width, 84, 0x3d2460, 0.98)
      .setDepth(150)
      .setStrokeStyle(2, 0x9b7ed9, 0.4);

    const tabs: {
      icon: string;
      action: () => void;
      active?: boolean;
      tint?: number;
    }[] = [
      { icon: "icon_wardrobe", action: () => undefined, active: true, tint: 0xffe0b2 },
      {
        icon: "icon_infinity",
        action: () => this.flash("Modo infinito — em breve")
      },
      { icon: "icon_swords", action: () => this.scene.start("Lobby") },
      {
        icon: "icon_trophy",
        action: () => this.flash(`Recorde: floor ${metaState.bestFloor}`),
        tint: 0xffd54f
      },
      {
        icon: "icon_book",
        action: () => {
          uiSel.tab = "book";
          this.scene.restart();
        },
        tint: 0xce93d8
      }
    ];

    const gap = width / tabs.length;
    tabs.forEach((tab, i) => {
      const x = gap * i + gap / 2;
      const bg = this.add
        .circle(x, y, tab.active ? 26 : 22, tab.active ? 0x8e44ad : 0x5a3a7a, 0.95)
        .setDepth(151)
        .setInteractive({ useHandCursor: true });
      const icon = this.add
        .image(x, y, tab.icon)
        .setDisplaySize(tab.active ? 28 : 24, tab.active ? 28 : 24)
        .setDepth(152);
      if (tab.tint) icon.setTint(tab.tint);
      bg.on("pointerdown", tab.action);
    });
  }

  private flash(msg: string) {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height - 110, msg, {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#fff8dc",
        backgroundColor: "#2c1a40cc",
        padding: { x: 10, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1200,
      duration: 350,
      onComplete: () => t.destroy()
    });
  }

  private applyPreviewTint() {
    const cape = CAPES[uiSel.tab === "cape" ? uiSel.cape : metaState.equippedCape];
    if (cape.tint === 0xffffff) this.preview.clearTint();
    else this.preview.setTint(cape.tint);
  }

  private refreshDetail() {
    if (uiSel.tab === "cape") {
      const def = CAPES[uiSel.cape];
      this.detailTitle.setText(def.name);
      this.detailBonus.setText(def.bonus);
      if (!ownCape(def.id)) {
        this.detailBtnLabel.setText(`Comprar ${def.price}`);
        this.detailBtn.setTint(0x58d68d);
      } else if (metaState.equippedCape === def.id) {
        this.detailBtnLabel.setText("Equipado");
        this.detailBtn.clearTint();
      } else {
        this.detailBtnLabel.setText("Equipar");
        this.detailBtn.setTint(0x5dade2);
      }
    } else {
      const def = BOOKS[uiSel.book];
      this.detailTitle.setText(def.name);
      this.detailBonus.setText(def.bonus);
      if (!ownBook(def.id)) {
        this.detailBtnLabel.setText(`Comprar ${def.price}`);
        this.detailBtn.setTint(0x58d68d);
      } else if (metaState.equippedBook === def.id) {
        this.detailBtnLabel.setText("Equipado");
        this.detailBtn.clearTint();
      } else {
        this.detailBtnLabel.setText("Equipar");
        this.detailBtn.setTint(0x5dade2);
      }
    }
    this.gemText.setText(String(metaState.gems));
  }

  private onAction() {
    if (uiSel.tab === "cape") {
      const id = uiSel.cape;
      if (!ownCape(id)) {
        if (!buyCape(id)) {
          this.flash("Gemas insuficientes");
          return;
        }
      } else {
        metaState.equippedCape = id;
      }
    } else {
      const id = uiSel.book;
      if (!ownBook(id)) {
        if (!buyBook(id)) {
          this.flash("Gemas insuficientes");
          return;
        }
      } else {
        metaState.equippedBook = id;
      }
    }
    this.scene.restart();
  }
}
