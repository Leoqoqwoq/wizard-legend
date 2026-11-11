import Phaser from "phaser";
import {
  ENEMY_KINDS,
  generateTexturesAndAnims,
  registerEnemyPackAnims,
  registerWizardPackAnims
} from "../game/createAnims";
import { clearLobbyReturn, uiSel } from "../game/equipUi";
import { tuneWizardAnimRates } from "../game/playerMotion";
import { runState } from "../game/RunState";
import { ensureHpHeart, ensureSkillIcons } from "../game/skillIcons";

/** Respeita base do Vite (ex.: /wizard-legend/ no GitHub Pages). */
function asset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

export class BootScene extends Phaser.Scene {
  private loaderKick: number | null = null;

  constructor() {
    super("Boot");
  }

  preload() {
    const { width, height } = this.scale;
    const barBg = this.add.rectangle(width / 2, height / 2, 220, 16, 0x2c1a40).setDepth(10);
    const bar = this.add
      .rectangle(width / 2 - 108, height / 2, 4, 10, 0x9b7ed9)
      .setOrigin(0, 0.5)
      .setDepth(11);
    const label = this.add
      .text(width / 2, height / 2 - 28, "Carregando…", {
        fontFamily: "Arial Black, Arial",
        fontSize: "16px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.load.on("progress", (value: number) => {
      bar.width = Math.max(4, 216 * value);
    });
    this.load.on("complete", () => {
      barBg.destroy();
      bar.destroy();
      label.destroy();
    });

    // Evita loader travado (comum se resize/HMR interrompe o Boot)
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn("[Boot] falha ao carregar", file.key, file.url);
      // Não deixa arquivo morto segurar a fila
      try {
        this.load.list.delete(file);
        this.load.inflight.delete(file);
      } catch {
        /* ignore */
      }
    });
    if (this.loaderKick != null) {
      window.clearInterval(this.loaderKick);
      this.loaderKick = null;
    }
    this.loaderKick = window.setInterval(() => {
      if (this.game.registry.get("wlBootReady")) {
        this.clearLoaderKick();
        return;
      }
      const loader = this.load;
      if (!loader || !loader.isLoading()) {
        // Ainda no Boot e sem loading → tenta start de novo
        if (this.sys.settings.key === "Boot" && loader && loader.list.size > 0) {
          try {
            loader.start();
          } catch {
            /* ignore */
          }
        } else if (!loader?.isLoading()) {
          this.clearLoaderKick();
        }
        return;
      }
      // Lista pendente sem nada em voo = loader morto → reinicia
      if (loader.list.size > 0 && loader.inflight.size === 0) {
        console.warn("[Boot] loader parado — reiniciando fila", loader.list.size);
        try {
          loader.start();
        } catch {
          /* ignore */
        }
      }
    }, 350);
    this.events.once("shutdown", () => this.clearLoaderKick());
    this.events.once("destroy", () => this.clearLoaderKick());

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
    // Ícones estilo Wizard Legend (CC0, frame circular)
    const skillIds = [
      "front_arrow",
      "dark_missile",
      "thorns",
      "fury_of_thor",
      "flame_elf",
      "ricochet",
      "multishot",
      "diagonal",
      "attack_speed",
      "hp_boost",
      "wall_bounce",
      "freeze"
    ];
    for (const id of skillIds) {
      this.load.image(`skill_wl_${id}`, asset(`assets/ui/skills_wl/${id}.png`));
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

  private clearLoaderKick() {
    if (this.loaderKick != null) {
      window.clearInterval(this.loaderKick);
      this.loaderKick = null;
    }
  }

  create() {
    this.clearLoaderKick();
    generateTexturesAndAnims(this);
    ensureHpHeart(this);
    ensureSkillIcons(this);
    registerWizardPackAnims(this);
    tuneWizardAnimRates(this);
    registerEnemyPackAnims(this);
    this.softenTextures();

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
    this.game.registry.set("wlBootReady", true);
    this.game.events.emit("wl-boot-ready");
    // Evita spawn “fantasma” na loja após HMR / reload a meio do armário
    if (!/[?&]equip=1/.test(q) && !/[?&]book=1/.test(q)) clearLobbyReturn();

    if (/[?&]skills=1/.test(q)) this.scene.start("SkillSelect");
    else if (/[?&]book=1/.test(q)) {
      uiSel.tab = "book";
      this.scene.start("Equip");
    } else if (/[?&]equip=1/.test(q)) this.scene.start("Equip");
    else if (/[?&]game=1/.test(q) || floorMatch) this.scene.start("Game");
    else this.scene.start("Lobby");
  }

  /** Suaviza sprites (menos “pixel duro”, bordas mais redondas). */
  private softenTextures() {
    for (const key of this.textures.getTextureKeys()) {
      if (key === "__DEFAULT" || key === "__MISSING") continue;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const canvas = this.game.canvas;
    if (canvas) canvas.style.imageRendering = "auto";
  }
}
