import Phaser from "phaser";
import {
  ENEMY_KINDS,
  generateTexturesAndAnims,
  registerEnemyPackAnims,
  registerWizardPackAnims
} from "../game/createAnims";
import { uiSel } from "../game/equipUi";
import { tuneWizardAnimRates } from "../game/playerMotion";
import { runState } from "../game/RunState";

/** Respeita base do Vite (ex.: /wizard-legend/ no GitHub Pages). */
function asset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    this.load.spritesheet("wizard", asset("assets/wizard_sheet.png"), {
      frameWidth: 48,
      frameHeight: 48
    });

    for (const kind of ENEMY_KINDS) {
      this.load.spritesheet(`enemy_${kind}`, asset(`assets/enemies/${kind}.png`), {
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
      this.load.image(`tile_${t}`, asset(`assets/tiles/${t}.png`));
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
      "book_mini"
    ];
    for (const u of ui) {
      this.load.image(`ui_${u}`, asset(`assets/ui/${u}.png`));
    }
    // Faixa de 4 frames (fechado → aberto), 160×90 cada
    this.load.spritesheet("ui_book_strip", asset("assets/ui/book_strip.png"), {
      frameWidth: 160,
      frameHeight: 90
    });
    for (let i = 0; i <= 11; i++) {
      this.load.image(`ui_skill_${i}`, asset(`assets/ui/skills/skill_${i}.png`));
    }

    // Lobby / merchant
    this.load.spritesheet("lobby_shopkeeper", asset("assets/lobby/shopkeeper.png"), {
      frameWidth: 48,
      frameHeight: 48
    });
    this.load.spritesheet("lobby_owl", asset("assets/lobby/owl.png"), {
      frameWidth: 16,
      frameHeight: 16
    });
    this.load.image("lobby_table", asset("assets/lobby/table.png"));
    this.load.image("lobby_shelf", asset("assets/lobby/shelf.png"));
    this.load.image("lobby_stand", asset("assets/lobby/stand.png"));
    this.load.image("lobby_floor_bg", asset("assets/lobby/floor_bg.png"));
    this.load.image("lobby_wall_bg", asset("assets/lobby/wall_bg.png"));

    // Gemas / moedas (OpenGameArt CC0)
    this.load.image("gem", asset("assets/gems/gem_green.png"));
    this.load.image("gem_blue", asset("assets/gems/gem_blue.png"));
    this.load.image("gem_red", asset("assets/gems/gem_red.png"));
    this.load.image("gem_violet", asset("assets/gems/gem_violet.png"));
    this.load.image("gem_yellow", asset("assets/gems/gem_yellow.png"));
    this.load.image("gem_diamond", asset("assets/gems/gem_diamond.png"));
    this.load.image("gem_ruby", asset("assets/gems/gem_ruby.png"));
    this.load.spritesheet("gem_spin", asset("assets/gems/gem_spin_sheet.png"), {
      frameWidth: 8,
      frameHeight: 8
    });
    this.load.spritesheet("coin_spin", asset("assets/gems/coin_spin_sheet.png"), {
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
      this.load.image(`icon_${icon}`, asset(`assets/icons/lobby/${icon}.png`));
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
    if (!this.anims.exists("book-open")) {
      this.anims.create({
        key: "book-open",
        frames: this.anims.generateFrameNumbers("ui_book_strip", {
          start: 0,
          end: 3
        }),
        frameRate: 12,
        repeat: 0
      });
    }
    if (!this.anims.exists("owl-idle")) {
      this.anims.create({
        key: "owl-idle",
        frames: this.anims.generateFrameNumbers("lobby_owl", { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1
      });
    }

    const q = typeof location !== "undefined" ? location.search : "";
    const floorMatch = q.match(/[?&]floor=(\d+)/);
    if (floorMatch) {
      runState.floor = Math.max(1, Number(floorMatch[1]) || 1);
    }
    if (/[?&]skills=1/.test(q)) this.scene.start("SkillSelect");
    else if (/[?&]book=1/.test(q)) {
      uiSel.tab = "book";
      this.scene.start("Equip");
    } else if (/[?&]equip=1/.test(q)) this.scene.start("Equip");
    else if (/[?&]game=1/.test(q) || floorMatch) this.scene.start("Game");
    else this.scene.start("Lobby");
  }
}
