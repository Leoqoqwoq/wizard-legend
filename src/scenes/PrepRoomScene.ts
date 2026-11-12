import Phaser from "phaser";
import { Joystick } from "../game/Joystick";
import { playerAnimKey, type Facing } from "../game/createAnims";
import { BOOKS, CAPES, metaState } from "../game/MetaState";
import { updatePlayerMotion } from "../game/playerMotion";
import { runState, isBossFloor } from "../game/RunState";
import { SKILLS, type SkillId } from "../game/skills";
import { kingdomForFloor, ULTRA_BOSS } from "../game/kingdoms";
import { isUltraBossFloor } from "../game/RunState";
import { followBrowserFrame } from "../game/followBrowser";

/**
 * Sala de preparo antes do boss (estilo lobby):
 * coelho vende melhorias do livro com moedas da run.
 */
export class PrepRoomScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private joystick!: Joystick;
  private facing: Facing = "up";
  private room!: Phaser.Geom.Rectangle;
  private shopZone!: Phaser.Geom.Rectangle;
  private exitZone!: Phaser.Geom.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private coinHud!: Phaser.GameObjects.Text;
  private shopOpen = false;
  private shopUi: Phaser.GameObjects.GameObject[] = [];
  private hold = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly speed = 160;

  constructor() {
    super("PrepRoom");
  }

  create() {
    const { width, height } = this.scale;
    const margin = 28;
    this.room = new Phaser.Geom.Rectangle(margin, 70, width - margin * 2, height - 200);
    this.shopOpen = false;

    this.drawRoom();
    this.spawnNpcs();
    this.spawnPlayer();
    this.buildHud();

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
      120,
      100
    );
    this.exitZone = new Phaser.Geom.Rectangle(
      this.room.centerX - 40,
      this.room.y + 8,
      80,
      55
    );

    this.prompt = this.add
      .text(width / 2, height - 120, "", {
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

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1028).setDepth(0);
    this.add
      .image(r.centerX, r.y + 20, "lobby_wall_bg")
      .setDisplaySize(r.width + 20, 90)
      .setDepth(1);
    this.add
      .image(r.centerX, r.centerY + 40, "lobby_floor_bg")
      .setDisplaySize(r.width, r.height - 40)
      .setDepth(1);

    for (let y = r.y + 40; y < r.bottom; y += TS) {
      for (let x = r.x; x < r.right; x += TS) {
        const cx = Math.floor((x - r.x) / TS);
        const cy = Math.floor((y - r.y) / TS);
        const key =
          (cx + cy) % 2 === 0 ? "tile_floor_plain" : "tile_floor_light";
        this.add
          .image(x + TS / 2, y + TS / 2, key)
          .setDisplaySize(TS, TS)
          .setDepth(2)
          .setAlpha(0.85);
      }
    }

    const door = this.add
      .sprite(r.centerX, r.y + 40, "portal_fx", 0)
      .setDisplaySize(56, 72)
      .setDepth(5)
      .setName("prepDoor");
    if (this.anims.exists("portal-spin")) door.play("portal-spin");

    const ultra = isUltraBossFloor(runState.floor);
    const kingdom = kingdomForFloor(runState.floor, runState.mode === "endless");
    this.add
      .text(
        r.centerX,
        r.y - 4,
        ultra ? "ULTRA" : isBossFloor(runState.floor) ? "BOSS" : "→",
        {
          fontFamily: "Arial Black, Arial",
          fontSize: "14px",
          color: ultra ? "#ffd700" : "#ff9ff3",
          backgroundColor: "#2c1a40",
          padding: { x: 6, y: 2 }
        }
      )
      .setOrigin(0.5)
      .setDepth(6);
    this.add
      .text(
        r.centerX,
        r.y + 56,
        ultra ? ULTRA_BOSS.kingdomName : kingdom.name,
        {
          fontFamily: "Arial",
          fontSize: "12px",
          color: "#e8daef"
        }
      )
      .setOrigin(0.5)
      .setDepth(6);

    void door;
  }

  private spawnNpcs() {
    const r = this.room;
    const shop = this.add
      .sprite(r.x + 78, r.y + 120, "lobby_shopkeeper", 0)
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

    this.add
      .image(r.x + 78, r.y + 155, "lobby_table")
      .setDisplaySize(56, 28)
      .setDepth(7);

    this.add
      .text(shop.x, shop.y - 44, "!", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#2c3e50",
        backgroundColor: "#f1c40f",
        padding: { x: 7, y: 2 }
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.add
      .text(r.centerX, r.centerY + 70, "PREPARO · BOSS", {
        fontFamily: "Arial Black, Arial",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setAlpha(0.16)
      .setDepth(3);

    const book = BOOKS[metaState.equippedBook];
    this.add
      .text(r.centerX, r.y + 70, `Libro: ${book.name}`, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#e8daef",
        backgroundColor: "#2c1a4088",
        padding: { x: 8, y: 3 }
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  private spawnPlayer() {
    const r = this.room;
    this.facing = "up";
    this.player = this.physics.add.sprite(r.centerX, r.bottom - 70, "wizard", 0);
    this.player.setDepth(10);
    this.player.setScale(2.2);
    this.player.setSize(14, 18).setOffset(17, 22);
    this.player.play(playerAnimKey("idle", this.facing));
    const cape = CAPES[metaState.equippedCape];
    if (cape.tint !== 0xffffff) this.player.setTint(cape.tint);
    const shadow = this.add.image(this.player.x, this.player.y + 28, "shadow").setDepth(9);
    this.player.setData("shadow", shadow);
  }

  private buildHud() {
    const { width } = this.scale;
    this.add
      .text(width / 2, 28, `FLOOR ${runState.floor} · PREP`, {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#ff9ff3"
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .sprite(width - 78, 28, "coin_spin", 0)
      .setDisplaySize(22, 22)
      .setDepth(100)
      .play("coin-spin");
    this.coinHud = this.add
      .text(width - 58, 28, String(runState.coins), {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#ffffff"
      })
      .setOrigin(0, 0.5)
      .setDepth(100);

    for (let i = 0; i < runState.maxHp; i++) {
      const pip = this.add
        .image(18 + i * 22, 28, "hp_pip")
        .setDisplaySize(20, 18)
        .setDepth(100);
      if (i >= runState.hp) pip.setTint(0x555555).setAlpha(0.55);
    }
  }

  private reflowLayout(width: number, height: number) {
    const margin = 28;
    this.room.setTo(margin, 70, width - margin * 2, height - 200);
    this.shopZone?.setTo(this.room.x + 20, this.room.y + 40, 120, 100);
    this.exitZone?.setTo(this.room.centerX - 40, this.room.y + 8, 80, 55);
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
      if (body && !this.shopOpen) body.moves = true;
    }
  }

  private openShop() {
    if (this.shopOpen) return;
    this.shopOpen = true;

    // Congela o mago (mesma lógica da coruja no lobby)
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.moves = false;
    this.player.play(playerAnimKey("idle", this.facing), true);

    const { width, height } = this.scale;
    const bias = BOOKS[metaState.equippedBook].skillBias as SkillId[];

    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0a0612, 0.72)
      .setDepth(250)
      .setInteractive();
    const panel = this.add
      .image(width / 2, height / 2 - 20, "ui_panel_card")
      .setDisplaySize(300, 340)
      .setDepth(251);
    const title = this.add
      .text(width / 2, height / 2 - 160, "Loja do coelho", {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#3b2414"
      })
      .setOrigin(0.5)
      .setDepth(252);

    const offers: { label: string; cost: number; action: () => string }[] = [
      {
        label: "Curar +1 HP",
        cost: 8,
        action: () => {
          if (runState.hp >= runState.maxHp) return "HP cheio";
          if (runState.coins < 8) return "Moedas insuficientes";
          runState.coins -= 8;
          runState.hp = Math.min(runState.maxHp, runState.hp + 1);
          return "Curado!";
        }
      },
      {
        label: "Carta do libro (+1 skill)",
        cost: 18,
        action: () => {
          if (runState.coins < 18) return "Moedas insuficientes";
          const pool =
            bias.length > 0
              ? bias.filter((id) => (runState.skills[id] ?? 0) < (SKILLS[id]?.maxStacks ?? 1))
              : (Object.keys(SKILLS) as SkillId[]).filter(
                  (id) => (runState.skills[id] ?? 0) < SKILLS[id].maxStacks
                );
          if (pool.length === 0) return "Skills no máximo";
          runState.coins -= 18;
          const id = Phaser.Utils.Array.GetRandom(pool);
          runState.skills[id] = (runState.skills[id] ?? 0) + 1;
          if (id === "hp_boost") {
            runState.maxHp += 1;
            runState.hp = Math.min(runState.maxHp, runState.hp + 1);
          }
          return `+1 ${SKILLS[id].name}`;
        }
      },
      {
        label: "Melhorar skill do libro",
        cost: 14,
        action: () => {
          if (runState.coins < 14) return "Moedas insuficientes";
          const ownedBias = bias.filter((id) => (runState.skills[id] ?? 0) > 0);
          const upgradable = (ownedBias.length ? ownedBias : (Object.keys(runState.skills) as SkillId[])).filter(
            (id) => (runState.skills[id] ?? 0) < (SKILLS[id]?.maxStacks ?? 1)
          );
          if (upgradable.length === 0) return "Nada pra melhorar";
          runState.coins -= 14;
          const id = Phaser.Utils.Array.GetRandom(upgradable);
          runState.skills[id] = (runState.skills[id] ?? 0) + 1;
          return `${SKILLS[id].name} Lv ${runState.skills[id]}`;
        }
      }
    ];

    const buttons: Phaser.GameObjects.GameObject[] = [];
    offers.forEach((o, i) => {
      const y = height / 2 - 90 + i * 70;
      const btn = this.add
        .image(width / 2, y, "ui_btn_brown")
        .setDisplaySize(240, 48)
        .setDepth(252)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(width / 2, y, `${o.label}\n${o.cost} moedas`, {
          fontFamily: "Arial Black, Arial",
          fontSize: "13px",
          color: "#2c1a0a",
          align: "center"
        })
        .setOrigin(0.5)
        .setDepth(253);
      btn.on("pointerdown", () => {
        const msg = o.action();
        this.coinHud.setText(String(runState.coins));
        this.flash(msg);
      });
      buttons.push(btn, txt);
    });

    const close = this.add
      .image(width / 2, height / 2 + 130, "ui_btn")
      .setDisplaySize(140, 40)
      .setDepth(252)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.add
      .text(width / 2, height / 2 + 130, "Fechar", {
        fontFamily: "Arial Black, Arial",
        fontSize: "14px",
        color: "#2c1a0a"
      })
      .setOrigin(0.5)
      .setDepth(253);
    close.on("pointerdown", () => this.closeShop());

    this.shopUi = [veil, panel, title, close, closeTxt, ...buttons];
  }

  private closeShop() {
    this.shopUi.forEach((o) => o.destroy());
    this.shopUi = [];
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.moves = true;
    this.shopOpen = false;
    this.hold = 0;
  }

  private flash(msg: string) {
    this.prompt.setText(msg).setAlpha(1).setDepth(400);
    this.tweens.killTweensOf(this.prompt);
    this.tweens.add({
      targets: this.prompt,
      alpha: 0,
      delay: 1200,
      duration: 350
    });
  }

  private goBoss() {
    this.joystick.destroy();
    this.scene.start("Game");
  }

  update(_t: number, dtMs: number) {
    if (!this.player?.active) return;
    if (this.shopOpen) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      return;
    }
    if (!this.joystick) return;
    const moveBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (!moveBody.moves) moveBody.moves = true;
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

    const door = this.children.getByName("prepDoor") as Phaser.GameObjects.Image | null;

    if (Phaser.Geom.Rectangle.Contains(this.exitZone, this.player.x, this.player.y)) {
      this.hold += dt;
      door?.setDisplaySize(56, 72);
      this.prompt.setText("↑ Entrar no BOSS…").setAlpha(1);
      if (this.hold > 0.4) this.goBoss();
    } else if (Phaser.Geom.Rectangle.Contains(this.shopZone, this.player.x, this.player.y)) {
      this.hold += dt;
      door?.setDisplaySize(56, 72);
      this.prompt.setText("🐰 Melhorias do libro…").setAlpha(1);
      if (this.hold > 0.35) {
        this.hold = 0;
        this.openShop();
      }
    } else {
      this.hold = 0;
      this.prompt.setAlpha(0);
      door?.setDisplaySize(56, 72);
    }
  }
}
