import Phaser from "phaser";
import { Joystick } from "../game/Joystick";
import { playerAnimKey, type Facing } from "../game/createAnims";
import { CAPES, metaState } from "../game/MetaState";
import { updatePlayerMotion } from "../game/playerMotion";
import { resetRun } from "../game/RunState";

/**
 * Hub estilo Wizard Legend: sala com mago andável,
 * lojista, coruja, saída pra batalha e barra inferior.
 */
export class LobbyScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private joystick!: Joystick;
  private facing: Facing = "down";
  private room!: Phaser.Geom.Rectangle;
  private shopZone!: Phaser.Geom.Rectangle;
  private battleZone!: Phaser.Geom.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private battleHold = 0;
  private readonly speed = 160;

  constructor() {
    super("Lobby");
  }

  create() {
    const { width, height } = this.scale;
    const margin = 28;
    this.room = new Phaser.Geom.Rectangle(margin, 70, width - margin * 2, height - 200);

    this.drawRoom();
    this.spawnDecor();
    this.spawnNpcs();
    this.spawnPlayer();
    this.buildHud();
    this.buildBottomNav();

    this.joystick = new Joystick(this);
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
      this.room.centerX - 40,
      this.room.y + 8,
      80,
      50
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

    // Porta de batalha — fixa (sem tween/pulse)
    this.add
      .image(r.centerX, r.y + 28, "tile_door_closed")
      .setDisplaySize(48, 48)
      .setDepth(4)
      .setName("lobbyDoor");
    this.add
      .text(r.centerX, r.y + 56, "BATALHA", {
        fontFamily: "Arial Black, Arial",
        fontSize: "11px",
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

    // Coruja no galho (estilo WL hub)
    const owlX = r.centerX + 48;
    const owlY = r.centerY - 8;
    const branch = this.add.graphics().setDepth(6);
    branch.lineStyle(5, 0x6d4c2f, 1);
    branch.beginPath();
    branch.moveTo(owlX - 36, owlY + 14);
    branch.lineTo(owlX + 28, owlY + 10);
    branch.strokePath();
    branch.fillStyle(0x6d4c2f, 1);
    branch.fillCircle(owlX - 36, owlY + 14, 4);

    const owl = this.add.container(owlX, owlY).setDepth(7);
    const body = this.add.ellipse(0, 4, 28, 32, 0x6c3483);
    const belly = this.add.ellipse(0, 8, 16, 18, 0xe8daef);
    const wingL = this.add.ellipse(-14, 6, 10, 18, 0x5b2c6f);
    const wingR = this.add.ellipse(14, 6, 10, 18, 0x5b2c6f);
    const head = this.add.circle(0, -10, 12, 0x7d3c98);
    const hat = this.add.triangle(0, -26, 0, 0, -11, 12, 11, 12, 0xf8f9f9);
    const hatBand = this.add.rectangle(0, -20, 18, 3, 0xe74c3c);
    const earL = this.add.triangle(-10, -18, 0, 0, -6, 10, 4, 8, 0x6c3483);
    const earR = this.add.triangle(10, -18, 0, 0, -4, 8, 6, 10, 0x6c3483);
    const eyeL = this.add.circle(-4, -10, 3.5, 0xffffff);
    const eyeR = this.add.circle(4, -10, 3.5, 0xffffff);
    const pupilL = this.add.circle(-4, -10, 1.6, 0x111111);
    const pupilR = this.add.circle(4, -10, 1.6, 0x111111);
    const beak = this.add.triangle(0, -4, 0, 0, -3, 5, 3, 5, 0xf5b041);
    const phones = this.add.rectangle(0, -12, 26, 4, 0x2c3e50);
    owl.add([
      wingL,
      wingR,
      body,
      belly,
      earL,
      earR,
      head,
      phones,
      hat,
      hatBand,
      eyeL,
      eyeR,
      pupilL,
      pupilR,
      beak
    ]);
    this.tweens.add({
      targets: owl,
      y: owlY - 5,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: "Sine.easeInOut"
    });
  }

  private spawnPlayer() {
    const r = this.room;
    this.facing = "up";
    this.player = this.physics.add.sprite(r.centerX, r.bottom - 70, "wizard", 0);
    this.player.setDepth(10);
    this.player.setScale(2.2);
    this.player.setRotation(0);
    this.player.setSize(14, 18).setOffset(17, 22);
    this.player.play(playerAnimKey("idle", this.facing));

    const cape = CAPES[metaState.equippedCape];
    if (cape.tint !== 0xffffff) this.player.setTint(cape.tint);

    const shadow = this.add.image(this.player.x, this.player.y + 28, "shadow").setDepth(9);
    this.player.setData("shadow", shadow);
  }

  private buildHud() {
    const { width } = this.scale;
    const pauseBg = this.add
      .rectangle(28, 28, 36, 36, 0x566573, 0.85)
      .setDepth(100)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true });
    this.add
      .image(28, 28, "icon_pause")
      .setDisplaySize(18, 18)
      .setDepth(101);
    pauseBg.on("pointerdown", () => this.flashPrompt("Pause"));

    // Gemas (ícone real)
    this.add
      .image(width - 78, 28, "gem")
      .setDisplaySize(26, 26)
      .setDepth(100);
    this.add
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

  private buildBottomNav() {
    const { width, height } = this.scale;
    const y = height - 42;
    this.add
      .rectangle(width / 2, y, width, 84, 0x3d2460, 0.95)
      .setDepth(150)
      .setStrokeStyle(2, 0x9b7ed9, 0.4);

    const openEquip = () => {
      this.joystick.destroy();
      this.scene.start("Equip");
    };

    const tabs: {
      icon: string;
      action: () => void;
      active?: boolean;
      tint?: number;
    }[] = [
      { icon: "icon_wardrobe", action: openEquip, tint: 0xffe0b2 },
      {
        icon: "icon_infinity",
        action: () => this.flashPrompt("Modo infinito — em breve")
      },
      { icon: "icon_swords", action: () => this.startBattle(), active: true },
      {
        icon: "icon_trophy",
        action: () => this.flashPrompt(`Recorde: floor ${metaState.bestFloor}`),
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

  private startBattle() {
    this.joystick.destroy();
    resetRun();
    this.scene.start("Game");
  }

  update(_t: number, dtMs: number) {
    if (!this.player?.active) return;
    const dt = dtMs / 1000;

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

    const door = this.children.getByName("lobbyDoor") as Phaser.GameObjects.Image | null;

    // Interações por proximidade
    if (Phaser.Geom.Rectangle.Contains(this.battleZone, this.player.x, this.player.y)) {
      this.battleHold += dt;
      if (door && door.texture.key !== "tile_door_open") {
        door.setTexture("tile_door_open").setDisplaySize(48, 48);
      }
      this.prompt.setText("↑ Entrar na batalha…").setAlpha(1);
      if (this.battleHold > 0.4) this.startBattle();
    } else if (Phaser.Geom.Rectangle.Contains(this.shopZone, this.player.x, this.player.y)) {
      this.battleHold += dt;
      if (door && door.texture.key !== "tile_door_closed") {
        door.setTexture("tile_door_closed").setDisplaySize(48, 48);
      }
      this.prompt.setText("👕 Abrir armário…").setAlpha(1);
      if (this.battleHold > 0.35) {
        this.joystick.destroy();
        this.scene.start("Equip");
      }
    } else {
      this.battleHold = 0;
      this.prompt.setAlpha(0);
      if (door && door.texture.key !== "tile_door_closed") {
        door.setTexture("tile_door_closed").setDisplaySize(48, 48);
      }
    }
  }
}
