import Phaser from "phaser";
import {
  ENEMY_KINDS,
  generateTexturesAndAnims,
  registerEnemyPackAnims,
  registerWizardPackAnims
} from "../game/createAnims";
import { uiSel } from "../game/equipUi";
import { tuneWizardAnimRates } from "../game/playerMotion";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    this.load.spritesheet("wizard", "/assets/wizard_sheet.png", {
      frameWidth: 48,
      frameHeight: 48
    });

    for (const kind of ENEMY_KINDS) {
      this.load.spritesheet(`enemy_${kind}`, `/assets/enemies/${kind}.png`, {
        frameWidth: 48,
        frameHeight: 48
      });
    }

    const tiles = [
      "floor_plain",
      "floor_light",
      "floor_edge_1",
      "floor_edge_2",
      "floor_edge_3",
      "Wall_front",
      "Wall_front_left",
      "Wall_front_right",
      "wall_center",
      "Wall_inner_e",
      "Wall_inner_ne",
      "column",
      "column_wall",
      "box",
      "boxes_stacked",
      "door_closed",
      "door_open",
      "chest_closed",
      "wall_flag_red",
      "wall_flag_blue"
    ];
    for (const t of tiles) {
      this.load.image(`tile_${t}`, `/assets/tiles/${t}.png`);
    }

    const ui = [
      "panel_card",
      "panel_card_alt",
      "slot",
      "slot_filled",
      "btn",
      "btn_pressed",
      "btn_blue",
      "btn_brown",
      "book",
      "book_mini",
      "book_strip"
    ];
    for (const u of ui) {
      this.load.image(`ui_${u}`, `/assets/ui/${u}.png`);
    }
    for (let i = 0; i <= 11; i++) {
      this.load.image(`ui_skill_${i}`, `/assets/ui/skills/skill_${i}.png`);
    }

    // Lobby / merchant
    this.load.spritesheet("lobby_shopkeeper", "/assets/lobby/shopkeeper.png", {
      frameWidth: 48,
      frameHeight: 48
    });
    this.load.image("lobby_table", "/assets/lobby/table.png");
    this.load.image("lobby_shelf", "/assets/lobby/shelf.png");
    this.load.image("lobby_stand", "/assets/lobby/stand.png");
    this.load.image("lobby_floor_bg", "/assets/lobby/floor_bg.png");
    this.load.image("lobby_wall_bg", "/assets/lobby/wall_bg.png");

    // Gemas / moedas (OpenGameArt CC0)
    this.load.image("gem", "/assets/gems/gem_green.png");
    this.load.image("gem_blue", "/assets/gems/gem_blue.png");
    this.load.image("gem_red", "/assets/gems/gem_red.png");
    this.load.image("gem_violet", "/assets/gems/gem_violet.png");
    this.load.image("gem_yellow", "/assets/gems/gem_yellow.png");
    this.load.image("gem_diamond", "/assets/gems/gem_diamond.png");
    this.load.image("gem_ruby", "/assets/gems/gem_ruby.png");
    this.load.spritesheet("gem_spin", "/assets/gems/gem_spin_sheet.png", {
      frameWidth: 8,
      frameHeight: 8
    });
    this.load.spritesheet("coin_spin", "/assets/gems/coin_spin_sheet.png", {
      frameWidth: 8,
      frameHeight: 8
    });

    // Ícones do lobby / HUD (Kenney CC0)
    const lobbyIcons = [
      "wardrobe",
      "infinity",
      "swords",
      "trophy",
      "book",
      "pause",
      "star",
      "exclamation",
      "home",
      "loop"
    ];
    for (const icon of lobbyIcons) {
      this.load.image(`icon_${icon}`, `/assets/icons/lobby/${icon}.png`);
    }
  }

  create() {
    generateTexturesAndAnims(this);
    registerWizardPackAnims(this);
    tuneWizardAnimRates(this);
    registerEnemyPackAnims(this);

    if (!this.anims.exists("gem-spin")) {
      this.anims.create({
        key: "gem-spin",
        frames: this.anims.generateFrameNumbers("gem_spin", {
          start: 0,
          end: 30
        }),
        frameRate: 10,
        repeat: -1
      });
    }
    if (!this.anims.exists("coin-spin")) {
      this.anims.create({
        key: "coin-spin",
        frames: this.anims.generateFrameNumbers("coin_spin", {
          start: 0,
          end: 17
        }),
        frameRate: 12,
        repeat: -1
      });
    }

    const q = typeof location !== "undefined" ? location.search : "";
    if (/[?&]skills=1/.test(q)) this.scene.start("SkillSelect");
    else if (/[?&]book=1/.test(q)) {
      uiSel.tab = "book";
      this.scene.start("Equip");
    } else if (/[?&]equip=1/.test(q)) this.scene.start("Equip");
    else if (/[?&]game=1/.test(q)) this.scene.start("Game");
    else this.scene.start("Lobby");
  }
}
