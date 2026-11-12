import Phaser from "phaser";
import {
  accountLabel,
  closeAccountPanel,
  openAccountPanel
} from "../game/accountPanel";
import { getAccountInfo, isFirebaseConfigured } from "../game/cloudSave";
import { Joystick } from "../game/Joystick";
import { playerAnimKey, type Facing } from "../game/createAnims";
import {
  CAPES,
  OWL_AD_REWARD_GEMS,
  claimOwlAdReward,
  metaState,
  owlAdReady
} from "../game/MetaState";
import { saveLobbyReturn, takeLobbyReturn } from "../game/equipUi";
import { followBrowserFrame } from "../game/followBrowser";
import { updatePlayerMotion } from "../game/playerMotion";
import { resetRun, type RunMode } from "../game/RunState";

/**
 * Hub estilo Wizard Legend: sala com mago andável,
 * lojista, coruja (anúncio), saída pra batalha e barra inferior.
 */
export class LobbyScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private joystick!: Joystick;
  private facing: Facing = "down";
  private room!: Phaser.Geom.Rectangle;
  private shopZone!: Phaser.Geom.Rectangle;
  private battleZone!: Phaser.Geom.Rectangle;
  private owlZone!: Phaser.Geom.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private gemHud!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private battleHold = 0;
  private adWatching = false;
  private savedPlayerX = 0;
  private savedPlayerY = 0;
  /** Evita reabrir armário/porta no mesmo frame do spawn. */
  private interactLock = 0;
  private readonly speed = 160;
  private accountBtnLabel!: Phaser.GameObjects.Text;
  private accountOpen = false;

  constructor() {
    super("Lobby");
  }

  create() {
    const { width, height } = this.scale;
    const margin = 28;
    this.room = new Phaser.Geom.Rectangle(margin, 70, width - margin * 2, height - 200);
    // scene.restart reaproveita a instância — limpa trava do anúncio/movimento
    this.adWatching = false;
    this.battleHold = 0;
    this.interactLock = 0.75;
    this.accountOpen = false;
    closeAccountPanel();

    this.drawRoom();
    this.spawnDecor();
    this.spawnNpcs();
    this.spawnPlayer();
    this.buildHud();
    this.buildBottomNav();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      closeAccountPanel();
      this.accountOpen = false;
    });

    this.joystick = new Joystick(this);
    followBrowserFrame(
      this,
      () => this.joystick?.destroy(),
      (w, h) => this.reflowLayout(w, h)
    );
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D") as Record<
        string,
        Phaser.Input.Keyboard.Key
      >;
    }

    this.shopZone = new Phaser.Geom.Rectangle(
      this.room.x + 20,
      this.room.y + 40,
      110,
      90
    );
    this.battleZone = new Phaser.Geom.Rectangle(
      this.room.centerX - 48,
      this.room.y + 4,
      96,
      70
    );
    this.owlZone = new Phaser.Geom.Rectangle(
      this.room.right - 88,
      this.room.y + 100,
      80,
      70
    );

    this.prompt = this.add
      .text(width / 2, height - 175, "", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#fff8dc",
        backgroundColor: "#2c1a40aa",
        padding: { x: 10, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setAlpha(0);
  }

  private drawRoom() {
    const { width, height } = this.scale;
    const r = this.room;
    const TS = 32;

    this.add.rectangle(width / 2, height / 2, width, height, 0x2a1838).setDepth(0);

    // Fundo merchant (parede + chão esticado)
    this.add
      .image(r.centerX, r.y + 50, "lobby_wall_bg")
      .setDisplaySize(r.width + 20, 120)
      .setDepth(0)
      .setAlpha(0.95);
    this.add
      .image(r.centerX, r.centerY + 40, "lobby_floor_bg")
      .setDisplaySize(r.width, r.height - 40)
      .setDepth(0)
      .setAlpha(0.85);

    // Madeira tiled por cima (tiles dungeon)
    for (let y = r.y + 60; y < r.bottom; y += TS) {
      for (let x = r.x; x < r.right; x += TS) {
        const cx = Math.floor((x - r.x) / TS);
        const cy = Math.floor((y - r.y) / TS);
        const key =
          (cx + cy) % 2 === 0 ? "tile_floor_plain" : "tile_floor_light";
        this.add
          .image(x + TS / 2, y + TS / 2, key)
          .setDisplaySize(TS, TS)
          .setTint(0xc4a574)
          .setDepth(1)
          .setAlpha(0.9);
      }
    }

    // Tapete roxo central
    const rug = this.add.graphics().setDepth(2);
    rug.fillStyle(0x6b3fa0, 0.95);
    rug.fillRoundedRect(r.centerX - 70, r.centerY - 20, 140, 100, 8);
    rug.lineStyle(3, 0xd4a5ff, 0.8);
    rug.strokeRoundedRect(r.centerX - 70, r.centerY - 20, 140, 100, 8);
    rug.lineStyle(2, 0xb388eb, 0.5);
    rug.strokeRoundedRect(r.centerX - 55, r.centerY - 5, 110, 70, 6);

    // Moldura parede
    for (let x = r.x; x < r.right; x += TS) {
      this.add
        .image(x + TS / 2, r.y + 16, "tile_Wall_front")
        .setDisplaySize(TS, TS)
        .setDepth(3);
    }

    // Portal de batalha (CC0 RodHak) — combina melhor com o mapa pixel
    const lobbyPortal = this.add
      .sprite(r.centerX, r.y + 40, "portal_fx", 0)
      .setDisplaySize(56, 72)
      .setDepth(4)
      .setName("lobbyDoor");
    if (this.anims.exists("portal-spin")) lobbyPortal.play("portal-spin");
    this.add
      .text(r.centerX, r.y + 80, "BATALHA", {
        fontFamily: "Arial Black, Arial",
        fontSize: "12px",
        color: "#f1c40f",
        stroke: "#000",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setName("lobbyDoorLabel");
  }

  private spawnDecor() {
    const r = this.room;
    // Balcão / prateleiras (lojista)
    this.add
      .image(r.x + 70, r.y + 70, "lobby_shelf")
      .setDisplaySize(90, 36)
      .setDepth(5);
    this.add
      .image(r.x + 70, r.y + 100, "lobby_table")
      .setDisplaySize(100, 40)
      .setDepth(5);
    this.add
      .image(r.right - 55, r.y + 85, "lobby_stand")
      .setDisplaySize(40, 56)
      .setDepth(5);
    this.add
      .image(r.x + 50, r.bottom - 50, "tile_boxes_stacked")
      .setDisplaySize(36, 36)
      .setDepth(5);
    this.add
      .image(r.right - 50, r.bottom - 50, "tile_box")
      .setDisplaySize(32, 32)
      .setDepth(5);
  }

  private spawnNpcs() {
    const r = this.room;

    // Coelho lojista (spritesheet Critters)
    const shop = this.add
      .sprite(r.x + 72, r.y + 118, "lobby_shopkeeper", 0)
      .setScale(2.2)
      .setDepth(8);
    if (!this.anims.exists("shop-idle")) {
      this.anims.create({
        key: "shop-idle",
        frames: this.anims.generateFrameNumbers("lobby_shopkeeper", {
          start: 0,
          end: 5
        }),
        frameRate: 6,
        repeat: -1
      });
    }
    shop.play("shop-idle");

    // Bang ! amarelo
    const bang = this.add
      .text(shop.x, shop.y - 42, "!", {
        fontFamily: "Arial Black, Arial",
        fontSize: "22px",
        color: "#2c3e50",
        backgroundColor: "#f1c40f",
        padding: { x: 8, y: 2 }
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: bang,
      y: bang.y - 4,
      yoyo: true,
      repeat: -1,
      duration: 500
    });

    // Corujinha 16×16 (pixel fofa): anúncio → gemas — canto direito
    const owlX = r.right - 42;
    const owlY = r.y + 132;
    const branch = this.add.graphics().setDepth(6);
    branch.lineStyle(3, 0x6d4c2f, 1);
    branch.beginPath();
    branch.moveTo(owlX - 22, owlY + 10);
    branch.lineTo(owlX + 18, owlY + 8);
    branch.strokePath();
    branch.fillStyle(0x6d4c2f, 1);
    branch.fillCircle(owlX - 22, owlY + 10, 3);

    const owl = this.add
      .sprite(owlX, owlY, "lobby_owl", 0)
      .setScale(2.4)
      .setDepth(8);
    owl.play("owl-idle");

    const adTag = this.add
      .text(owlX, owlY - 22, "▶ AD", {
        fontFamily: "Arial Black, Arial",
        fontSize: "10px",
        color: "#1a1028",
        backgroundColor: "#82e0aa",
        padding: { x: 4, y: 1 }
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: owl,
      y: owlY - 3,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: adTag,
      y: owlY - 25,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: "Sine.easeInOut"
    });
  }

  private spawnPlayer() {
    const r = this.room;
    const ret = takeLobbyReturn();
    let px = ret.x ?? r.centerX;
    let py = ret.y ?? r.bottom - 70;
    this.facing = (ret.facing as Facing) || "up";
    // Sempre nasce na faixa inferior livre (fora loja / coruja / porta)
    px = Phaser.Math.Clamp(px, r.x + 40, r.right - 40);
    py = Phaser.Math.Clamp(Math.max(py, r.centerY + 20), r.centerY + 10, r.bottom - 36);

    this.player = this.physics.add.sprite(px, py, "wizard", 0);
    this.player.setDepth(10);
    this.player.setScale(2.2);
    this.player.setRotation(0);
    this.player.setSize(14, 18).setOffset(17, 22);
    {
      const b = this.player.body as Phaser.Physics.Arcade.Body;
      b.enable = true;
      b.moves = true;
      b.setAllowGravity(false);
      b.setVelocity(0, 0);
    }
    const idleKey = playerAnimKey("idle", this.facing);
    if (this.anims.exists(idleKey)) this.player.play(idleKey);
    else this.player.setFrame(0);

    const cape = CAPES[metaState.equippedCape];
    if (cape.tint !== 0xffffff) this.player.setTint(cape.tint);

    const shadow = this.add.image(this.player.x, this.player.y + 28, "shadow").setDepth(9);
    this.player.setData("shadow", shadow);
  }

  private openEquipFromLobby() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    // Guarda um pouco abaixo da loja — senão ao voltar reabre o armário na hora
    saveLobbyReturn(
      this.player.x,
      Math.min(this.player.y + 60, this.room.bottom - 40),
      this.facing
    );
    this.joystick.destroy();
    this.scene.start("Equip");
  }

  private buildHud() {
    const { width } = this.scale;
    const pauseBg = this.add
      .circle(30, 30, 20, 0x566573, 0.88)
      .setDepth(100)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setInteractive({ useHandCursor: true });
    this.add
      .image(30, 30, "icon_pause")
      .setDisplaySize(18, 18)
      .setDepth(101);
    pauseBg.on("pointerdown", () => this.flashPrompt("Pause"));

    // Conta (opcional) — à direita do pause
    const accountBg = this.add
      .rectangle(108, 30, 92, 34, 0x5a3a7a, 0.92)
      .setDepth(100)
      .setStrokeStyle(2, 0xd4a5ff, 0.45)
      .setInteractive({ useHandCursor: true });
    this.accountBtnLabel = this.add
      .text(108, 30, accountLabel(getAccountInfo()), {
        fontFamily: "Arial Black, Arial",
        fontSize: "12px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(101);
    accountBg.on("pointerdown", () => this.openAccount());

    // Gemas (ícone real)
    this.add
      .image(width - 78, 28, "gem")
      .setDisplaySize(26, 26)
      .setDepth(100);
    this.gemHud = this.add
      .text(width - 60, 28, String(metaState.gems), {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#ffffff"
      })
      .setOrigin(0, 0.5)
      .setDepth(100);

    this.add
      .text(width / 2, 28, "LOBBY", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0.75);
  }

  private openAccount() {
    if (this.accountOpen) return;
    if (!isFirebaseConfigured()) {
      this.flashPrompt("Cloud save offline neste build");
      return;
    }
    this.accountOpen = true;
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    openAccountPanel({
      onApplied: () => {
        this.gemHud?.setText(String(metaState.gems));
        this.accountBtnLabel?.setText(accountLabel(getAccountInfo()));
        const cape = CAPES[metaState.equippedCape];
        if (this.player?.active) {
          if (cape.tint !== 0xffffff) this.player.setTint(cape.tint);
          else this.player.clearTint();
        }
      },
      onClose: () => {
        this.accountOpen = false;
        this.accountBtnLabel?.setText(accountLabel(getAccountInfo()));
      }
    });
  }

  private buildBottomNav() {
    const { width, height } = this.scale;
    const y = height - 42;
    this.add
      .rectangle(width / 2, y, width, 84, 0x3d2460, 0.95)
      .setDepth(150)
      .setStrokeStyle(2, 0x9b7ed9, 0.4);

    const openEquip = () => this.openEquipFromLobby();

    const tabs: {
      icon: string;
      action: () => void;
      active?: boolean;
      tint?: number;
    }[] = [
      { icon: "icon_wardrobe", action: openEquip, tint: 0xffe0b2 },
      {
        icon: "icon_infinity",
        action: () => this.confirmEndless(),
        tint: 0x7fdbff
      },
      { icon: "icon_swords", action: () => this.startBattle("campaign"), active: true },
      {
        icon: "icon_trophy",
        action: () => this.showRanking(),
        tint: 0xffd54f
      },
      { icon: "icon_book", action: openEquip, tint: 0xce93d8 }
    ];

    const gap = width / tabs.length;
    tabs.forEach((tab, i) => {
      const x = gap * i + gap / 2;
      const r = tab.active ? 26 : 22;
      const bg = this.add
        .circle(x, y, r, tab.active ? 0x8e44ad : 0x5a3a7a, 0.95)
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

  private flashPrompt(msg: string) {
    this.prompt.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.prompt);
    this.tweens.add({
      targets: this.prompt,
      alpha: 0,
      delay: 1400,
      duration: 400
    });
  }

  private startBattle(mode: RunMode = "campaign") {
    this.joystick.destroy();
    resetRun(mode);
    this.scene.start("Game");
  }

  /** Aviso antes do modo infinito (sem fim, ranking por floor). */
  private confirmEndless() {
    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0a0612, 0.78)
      .setDepth(280)
      .setInteractive();
    const panel = this.add
      .image(width / 2, height / 2, "ui_panel_card")
      .setDisplaySize(300, 250)
      .setDepth(281);
    const title = this.add
      .text(width / 2, height / 2 - 92, "Modo Infinito", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#3b2414"
      })
      .setOrigin(0.5)
      .setDepth(282);
    const body = this.add
      .text(
        width / 2,
        height / 2 - 18,
        "Sem fim — só para quando morrer.\nBoss a cada 10 andares.\nRanking pelo floor mais alto.\n\nTem certeza?",
        {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#2c1a0a",
          align: "center",
          lineSpacing: 4
        }
      )
      .setOrigin(0.5)
      .setDepth(282);

    const cancelBg = this.add
      .rectangle(width / 2 - 70, height / 2 + 88, 110, 40, 0x5d6d7e)
      .setDepth(282)
      .setInteractive({ useHandCursor: true });
    const cancelTxt = this.add
      .text(width / 2 - 70, height / 2 + 88, "Cancelar", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(283);

    const okBg = this.add
      .rectangle(width / 2 + 70, height / 2 + 88, 110, 40, 0x8e44ad)
      .setDepth(282)
      .setInteractive({ useHandCursor: true });
    const okTxt = this.add
      .text(width / 2 + 70, height / 2 + 88, "Começar", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(283);

    const kill = () => {
      [veil, panel, title, body, cancelBg, cancelTxt, okBg, okTxt].forEach((o) =>
        o.destroy()
      );
    };
    cancelBg.on("pointerdown", kill);
    veil.on("pointerdown", kill);
    okBg.on("pointerdown", () => {
      kill();
      this.startBattle("endless");
    });
  }

  /** Ranking: infinito (recorde principal) + campanha. */
  private showRanking() {
    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0a0612, 0.75)
      .setDepth(280)
      .setInteractive();
    const panel = this.add
      .image(width / 2, height / 2, "ui_panel_card")
      .setDisplaySize(280, 220)
      .setDepth(281);
    const title = this.add
      .text(width / 2, height / 2 - 78, "Ranking", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#3b2414"
      })
      .setOrigin(0.5)
      .setDepth(282);
    const body = this.add
      .text(
        width / 2,
        height / 2 - 10,
        `∞ Infinito\nRecorde: floor ${metaState.bestFloor}\n\n⚔ Campanha\nMelhor: floor ${metaState.bestCampaignFloor}`,
        {
          fontFamily: "Arial Black, Arial",
          fontSize: "15px",
          color: "#2c1a0a",
          align: "center"
        }
      )
      .setOrigin(0.5)
      .setDepth(282);
    const close = this.add
      .image(width / 2, height / 2 + 78, "ui_btn")
      .setDisplaySize(120, 36)
      .setDepth(282)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.add
      .text(width / 2, height / 2 + 78, "Fechar", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#2c1a0a"
      })
      .setOrigin(0.5)
      .setDepth(283);
    const kill = () => {
      [veil, panel, title, body, close, closeTxt].forEach((o) => o.destroy());
    };
    veil.on("pointerdown", kill);
    close.on("pointerdown", kill);
  }

  /** Atualiza área jogável / stick sem reiniciar a cena. */
  private reflowLayout(width: number, height: number) {
    const margin = 28;
    this.room.setTo(margin, 70, width - margin * 2, height - 200);
    this.shopZone.setTo(this.room.x + 20, this.room.y + 40, 110, 90);
    this.battleZone.setTo(this.room.centerX - 48, this.room.y + 4, 96, 70);
    this.owlZone.setTo(this.room.right - 88, this.room.y + 100, 80, 70);
    this.prompt?.setPosition(width / 2, height - 175);
    this.joystick?.reflow();
    if (this.player?.active) {
      this.player.x = Phaser.Math.Clamp(
        this.player.x,
        this.room.x + 18,
        this.room.right - 18
      );
      this.player.y = Phaser.Math.Clamp(
        this.player.y,
        this.room.y + 40,
        this.room.bottom - 18
      );
      const body = this.player.body as Phaser.Physics.Arcade.Body | null;
      if (body && !this.adWatching) body.moves = true;
    }
  }

  /** Simula anúncio recompensado (placeholder até AdMob real). */
  private watchOwlAd() {
    if (this.adWatching || !owlAdReady()) return;
    this.adWatching = true;

    // Congela o mago no lugar (senão a velocity continua e ele “voa”)
    this.savedPlayerX = this.player.x;
    this.savedPlayerY = this.player.y;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.moves = false;
    this.player.setPosition(this.savedPlayerX, this.savedPlayerY);
    this.player.play(playerAnimKey("idle", this.facing), true);
    const shadow = this.player.getData("shadow") as Phaser.GameObjects.Image | undefined;
    shadow?.setPosition(this.savedPlayerX, this.savedPlayerY + 26);

    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0a0612, 0.82)
      .setDepth(300);
    const label = this.add
      .text(width / 2, height / 2 - 20, "Assistindo anúncio…", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(301);
    const sub = this.add
      .text(width / 2, height / 2 + 18, `+${OWL_AD_REWARD_GEMS} gemas`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#82e0aa"
      })
      .setOrigin(0.5)
      .setDepth(301);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const gained = claimOwlAdReward();
      try {
        veil.destroy();
        label.destroy();
        sub.destroy();
      } catch {
        /* ignore */
      }

      if (body && body.world) body.moves = true;
      if (this.player?.active) {
        this.player.setPosition(this.savedPlayerX, this.savedPlayerY);
        shadow?.setPosition(this.savedPlayerX, this.savedPlayerY + 26);
      }
      this.battleHold = 0;
      this.adWatching = false;

      this.gemHud?.setText(String(metaState.gems));
      this.flashPrompt(
        gained > 0 ? `+${gained} gemas!` : "Anúncio em cooldown"
      );
    };

    // Phaser timer + fallback real: se o loop dormir, o mago não fica preso
    this.time.delayedCall(2200, finish);
    window.setTimeout(finish, 2400);
  }

  update(_t: number, dtMs: number) {
    if (!this.player?.active) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;

    // Painel de conta (DOM) aberto: congela o mago
    if (this.accountOpen) {
      body.setVelocity(0, 0);
      return;
    }

    // Durante o anúncio: mantém parado no ponto salvo
    if (this.adWatching) {
      body.setVelocity(0, 0);
      this.player.setPosition(this.savedPlayerX, this.savedPlayerY);
      const shadow = this.player.getData("shadow") as Phaser.GameObjects.Image | undefined;
      shadow?.setPosition(this.savedPlayerX, this.savedPlayerY + 26);
      return;
    }

    const dt = dtMs / 1000;

    if (!this.joystick) return;
    if (!body.enable) body.enable = true;
    if (!body.moves) body.moves = true;

    const v = this.joystick.getVector().clone();
    if (this.cursors?.left.isDown || this.wasd?.A?.isDown) v.x = -1;
    if (this.cursors?.right.isDown || this.wasd?.D?.isDown) v.x = 1;
    if (this.cursors?.up.isDown || this.wasd?.W?.isDown) v.y = -1;
    if (this.cursors?.down.isDown || this.wasd?.S?.isDown) v.y = 1;
    if (v.lengthSq() > 1) v.normalize();

    this.facing = updatePlayerMotion({
      sprite: this.player,
      shadow: this.player.getData("shadow") as Phaser.GameObjects.Image,
      velocity: v,
      facing: this.facing,
      speed: this.speed,
      timeMs: this.time.now
    });

    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.room.x + 18,
      this.room.right - 18
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.room.y + 40,
      this.room.bottom - 18
    );

    const door = this.children.getByName("lobbyDoor") as
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Image
      | null;

    if (this.interactLock > 0) {
      this.interactLock -= dt;
      this.battleHold = 0;
      return;
    }

    // Interações por proximidade
    if (Phaser.Geom.Rectangle.Contains(this.battleZone, this.player.x, this.player.y)) {
      this.battleHold += dt;
      if (door) door.setDisplaySize(56, 72);
      this.prompt.setText("↑ Campanha (6 reinos)…").setAlpha(1);
      if (this.battleHold > 0.4) this.startBattle("campaign");
    } else if (Phaser.Geom.Rectangle.Contains(this.shopZone, this.player.x, this.player.y)) {
      this.battleHold += dt;
      this.prompt.setText("👕 Abrir armário…").setAlpha(1);
      if (this.battleHold > 0.35) {
        this.battleHold = 0;
        this.openEquipFromLobby();
      }
    } else if (Phaser.Geom.Rectangle.Contains(this.owlZone, this.player.x, this.player.y)) {
      this.battleHold += dt;
      const ready = owlAdReady();
      this.prompt
        .setText(
          ready
            ? `▶ Assistir anúncio (+${OWL_AD_REWARD_GEMS} gemas)`
            : "⏳ Anúncio em cooldown…"
        )
        .setAlpha(1);
      if (ready && this.battleHold > 0.35) {
        this.battleHold = 0;
        this.watchOwlAd();
      }
    } else {
      this.battleHold = 0;
      this.prompt.setAlpha(0);
    }
  }
}
