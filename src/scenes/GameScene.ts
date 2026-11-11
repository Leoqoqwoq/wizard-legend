import Phaser from "phaser";
import { Joystick } from "../game/Joystick";
import { CAPES, metaState } from "../game/MetaState";
import { runState, resetRun } from "../game/RunState";
import {
  enemyAnimKey,
  facingFromVector,
  playerAnimKey,
  type EnemyKind,
  type Facing
} from "../game/createAnims";
import { updatePlayerMotion } from "../game/playerMotion";

type EnemyType = EnemyKind;

interface EnemyData {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  shootCd: number;
  shootTimer: number;
  kind: EnemyType;
  frozen: number;
  facing: Facing;
  /** Tocando attack/hurt — não sobrescrever com idle/move */
  busy: boolean;
  isBoss?: boolean;
  /** Alterna ring / laser no boss */
  bossPhase?: number;
}

/** No WL original: boss a cada 10 andares (10, 20, 30…). */
export function isBossFloor(floor: number) {
  return floor > 0 && floor % 10 === 0;
}

const ENEMY_TEX: Record<EnemyType, string> = {
  eye: "enemy_eye",
  bug: "enemy_bug",
  bot: "enemy_bot",
  pop: "enemy_pop",
  kernel: "enemy_kernel"
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private joystick!: Joystick;
  private enemies!: Phaser.Physics.Arcade.Group;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private blocks!: Phaser.Physics.Arcade.StaticGroup;
  private elevator!: Phaser.Physics.Arcade.Sprite;
  private room!: Phaser.Geom.Rectangle;

  private attackTimer = 0;
  private invuln = 0;
  private cleared = false;
  private coinText!: Phaser.GameObjects.Text;
  private hpContainer!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private elves: Phaser.GameObjects.Sprite[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private targetRing!: Phaser.GameObjects.Image;
  private facing: Facing = "down";
  private bossHpGfx?: Phaser.GameObjects.Graphics;
  private bossHpLabel?: Phaser.GameObjects.Text;
  private laserGfx?: Phaser.GameObjects.Graphics;

  private readonly playerSpeed = 180;

  constructor() {
    super("Game");
  }

  create() {
    if (runState.pendingSkillPick) {
      this.scene.start("SkillSelect");
      return;
    }

    const { width, height } = this.scale;
    this.cleared = false;
    this.attackTimer = 0;
    this.invuln = 0;
    this.elves = [];

    // Arena
    const margin = 40;
    this.room = new Phaser.Geom.Rectangle(
      margin,
      80,
      width - margin * 2,
      height - 220
    );
    this.drawArena();

    // Física / grupos
    this.blocks = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.playerBullets = this.physics.add.group({
      defaultKey: "bullet_player",
      maxSize: 80
    });
    this.enemyBullets = this.physics.add.group({
      defaultKey: "bullet_ring",
      maxSize: 80
    });

    this.targetRing = this.add
      .image(0, 0, "target_ring")
      .setDepth(4)
      .setVisible(false)
      .setAlpha(0.9);

    this.spawnBlocks();
    this.spawnPlayer();
    this.spawnEnemies();
    this.spawnElevator();

    this.joystick = new Joystick(this);
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D") as Record<
        string,
        Phaser.Input.Keyboard.Key
      >;
    }

    this.physics.add.collider(this.player, this.blocks);
    this.physics.add.collider(this.enemies, this.blocks);
    this.physics.add.collider(this.enemies, this.enemies);

    this.physics.add.overlap(
      this.playerBullets,
      this.enemies,
      this.onPlayerHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    // Tiro do mago só some na parede / bloco (ou quica com skill)
    this.physics.add.collider(
      this.playerBullets,
      this.blocks,
      this.onPlayerBulletHitWall as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      (
        bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
      ) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Image;
        const spawnAt = (bullet.getData("spawnAt") as number) || 0;
        // Não processa colisão nos primeiros frames (hitbox/spawn)
        return this.time.now - spawnAt >= 80;
      },
      this
    );
    this.physics.add.overlap(
      this.enemyBullets,
      this.player,
      this.onEnemyHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.onTouchEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // HUD
    this.createHud();

    // Hint Release to Hit (só no floor 1)
    this.hintText = this.add
      .text(width / 2, height / 2 - 40, "Release to Hit", {
        fontFamily: "Arial Black, Arial",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(runState.floor === 1 ? 0.85 : 0);

    if (runState.floor === 1) {
      this.time.delayedCall(2500, () => {
        this.tweens.add({
          targets: this.hintText,
          alpha: 0,
          duration: 600
        });
      });
    }

    // Flame elves
    const elfCount = runState.skills.flame_elf ?? 0;
    for (let i = 0; i < elfCount; i++) {
      const elf = this.add
        .sprite(this.player.x + 30, this.player.y, "bullet_fire")
        .setScale(1.4)
        .setDepth(6);
      this.elves.push(elf);
    }
  }

  private drawArena() {
    const g = this.add.graphics().setDepth(0);
    const r = this.room;
    const TS = 32; // tile 16px × scale 2

    // Void fora da sala
    g.fillStyle(0x0d0818, 1);
    g.fillRect(0, 0, this.scale.width, this.scale.height);

    // Chão tiled (0x72 dungeon)
    const floors = ["tile_floor_plain", "tile_floor_light", "tile_floor_edge_1", "tile_floor_edge_2"];
    for (let y = r.y; y < r.bottom; y += TS) {
      for (let x = r.x; x < r.right; x += TS) {
        const cx = Math.floor((x - r.x) / TS);
        const cy = Math.floor((y - r.y) / TS);
        const key =
          floors[(cx * 3 + cy * 5 + runState.floor) % floors.length] ?? floors[0];
        this.add
          .image(x + TS / 2, y + TS / 2, key)
          .setDisplaySize(TS, TS)
          .setDepth(0);
      }
    }

    // Paredes / moldura com tiles
    const wallY = r.y - TS / 2;
    for (let x = r.x; x < r.right; x += TS) {
      const isLeft = x <= r.x;
      const isRight = x + TS >= r.right;
      const key = isLeft
        ? "tile_Wall_front_left"
        : isRight
          ? "tile_Wall_front_right"
          : "tile_Wall_front";
      this.add
        .image(x + TS / 2, wallY, key)
        .setDisplaySize(TS, TS)
        .setDepth(2);
    }
    // laterais
    for (let y = r.y; y < r.bottom; y += TS) {
      this.add
        .image(r.x - TS / 2, y + TS / 2, "tile_wall_center")
        .setDisplaySize(TS, TS)
        .setDepth(2);
      this.add
        .image(r.right + TS / 2, y + TS / 2, "tile_Wall_inner_e")
        .setDisplaySize(TS, TS)
        .setDepth(2);
    }
    // base
    for (let x = r.x; x < r.right; x += TS) {
      this.add
        .image(x + TS / 2, r.bottom + TS / 2, "tile_wall_center")
        .setDisplaySize(TS, TS)
        .setDepth(2);
    }

    // Detalhes: bandeiras no topo
    this.add
      .image(r.x + 48, wallY - 8, "tile_wall_flag_red")
      .setDisplaySize(TS, TS)
      .setDepth(3);
    this.add
      .image(r.right - 48, wallY - 8, "tile_wall_flag_blue")
      .setDisplaySize(TS, TS)
      .setDepth(3);

    // Texto do floor no chão
    this.add
      .text(r.centerX, r.centerY + 40, `${runState.floor} FLOOR`, {
        fontFamily: "Arial Black, Arial",
        fontSize: "42px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setAlpha(0.18)
      .setDepth(1);
  }

  private spawnBlocks() {
    const r = this.room;
    const layout = [
      [r.x + 72, r.y + 80],
      [r.right - 72, r.y + 80],
      [r.x + 72, r.bottom - 96],
      [r.right - 72, r.bottom - 96]
    ];
    if (runState.floor % 2 === 0) {
      layout.push([r.centerX, r.centerY]);
    }
    layout.forEach(([x, y], i) => {
      // Coluna decorativa + caixa como colisão sólida
      this.add
        .image(x, y - 28, "tile_column")
        .setDisplaySize(36, 96)
        .setDepth(4);
      const key = i % 3 === 0 ? "tile_boxes_stacked" : "tile_box";
      const b = this.blocks.create(x, y + 8, key) as Phaser.Physics.Arcade.Sprite;
      b.setDisplaySize(36, 36);
      b.refreshBody();
      b.setDepth(5);
    });
  }

  private spawnPlayer() {
    const r = this.room;
    this.facing = "down";
    this.player = this.physics.add.sprite(r.centerX, r.bottom - 60, "wizard", 0);
    this.player.setCollideWorldBounds(false);
    this.player.setDepth(10);
    this.player.setScale(2.2);
    this.player.setSize(14, 18).setOffset(17, 22);
    this.player.setScale(2.2);
    this.player.setRotation(0);
    (this.player.body as Phaser.Physics.Arcade.Body).setMaxSpeed(this.playerSpeed);
    this.player.play(playerAnimKey("idle", this.facing));
    this.player.setData("attacking", false);

    // Preset de capa do lobby
    const cape = CAPES[metaState.equippedCape];
    if (cape.tint !== 0xffffff) this.player.setTint(cape.tint);
    if (cape.id === "heart" && runState.maxHp < 5) {
      runState.maxHp += 1;
      runState.hp = Math.min(runState.maxHp, runState.hp + 1);
    }

    const shadow = this.add.image(this.player.x, this.player.y + 28, "shadow").setDepth(9);
    this.player.setData("shadow", shadow);

    for (const dir of ["down", "up", "right", "left"] as Facing[]) {
      this.player.on(`animationcomplete-${playerAnimKey("attack", dir)}`, () => {
      this.player.setData("attacking", false);
      const moving = this.joystick?.isMoving();
      this.player.play(
        playerAnimKey(moving ? "run" : "idle", this.facing),
        true
      );
      });
    }
  }

  private spawnElevator() {
    const r = this.room;
    // Porta do tileset como elevador / saída
    this.elevator = this.physics.add.sprite(r.centerX, r.y + 28, "tile_door_closed");
    this.elevator.setImmovable(true);
    this.elevator.setDepth(2);
    this.elevator.setDisplaySize(48, 48);
    this.elevator.setVisible(false);
    this.elevator.body.enable = false;
    this.elevator.setInteractive({ useHandCursor: true });
    this.elevator.on("pointerdown", () => {
      if (!this.cleared) return;
      this.enterElevator();
    });

    this.add
      .text(r.centerX, r.y - 6, String(runState.floor + 1), {
        fontFamily: "Arial Black, Arial",
        fontSize: "16px",
        color: "#f1c40f",
        backgroundColor: "#2c3e50",
        padding: { x: 6, y: 2 }
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setName("nextFloorLabel");
  }

  private enterElevator() {
    runState.pendingSkillPick = true;
    runState.clearedFloor = true;
    this.joystick.destroy();
    this.scene.start("SkillSelect");
  }

  private spawnEnemies() {
    const r = this.room;
    const floor = runState.floor;

    if (isBossFloor(floor)) {
      this.spawnBoss(floor);
      return;
    }

    const count = Math.min(2 + Math.floor(floor / 2), 7);
    // Ordem parecida com o vídeo: olho amarelo → slime verde → relógio → pipoca
    const kinds: EnemyType[] = ["eye", "bug", "bot", "pop"];

    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const x = Phaser.Math.Between(r.x + 50, r.right - 50);
      const y = Phaser.Math.Between(r.y + 80, r.centerY);
      this.createEnemy(kind, x, y, floor);

      // Pipoca vem com grãozinho (como no vídeo)
      if (kind === "pop") {
        this.createEnemy(
          "kernel",
          x + Phaser.Math.Between(-40, 40),
          y + Phaser.Math.Between(30, 60),
          floor
        );
      }
    }
  }

  private spawnBoss(floor: number) {
    const r = this.room;
    // Cicla visual entre bot/pop conforme o “capítulo” (10→bot, 20→pop, …)
    const chapter = floor / 10;
    const kind: EnemyType = chapter % 2 === 0 ? "pop" : "bot";
    const boss = this.createEnemy(kind, r.centerX, r.y + 120, floor, true);
    const data = boss.getData("data") as EnemyData;
    const tier = chapter;
    data.hp = data.maxHp = 28 + tier * 18;
    data.speed = 22 + tier * 2;
    data.damage = 1;
    data.shootCd = Math.max(0.85, 1.6 - tier * 0.08);
    data.shootTimer = 1.2;
    data.isBoss = true;
    data.bossPhase = 0;
    boss.setScale(kind === "pop" ? 3.1 : 3.2);
    boss.setTint(0xff9ff3);
    boss.setDepth(12);
    const shadow = boss.getData("shadow") as Phaser.GameObjects.Image;
    shadow?.setScale(2.4).setAlpha(0.55);

    this.bossHpGfx = this.add.graphics().setDepth(110).setScrollFactor(0);
    this.bossHpLabel = this.add
      .text(this.scale.width / 2, 52, `BOSS · FLOOR ${floor}`, {
        fontFamily: "Arial Black, Arial",
        fontSize: "13px",
        color: "#ffe6f7",
        stroke: "#4a1040",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(111)
      .setScrollFactor(0);
    this.laserGfx = this.add.graphics().setDepth(14);
  }

  private createEnemy(
    kind: EnemyType,
    x: number,
    y: number,
    floor: number,
    isBoss = false
  ) {
    const e = this.enemies.create(x, y, ENEMY_TEX[kind], 64) as Phaser.Physics.Arcade.Sprite;
    e.setDepth(8);
    e.setBounce(0.15);

    const scale =
      kind === "kernel" ? 1.5 : kind === "bot" ? 1.7 : kind === "pop" ? 1.65 : 1.75;
    e.setScale(scale);

    const bodyW = kind === "kernel" ? 16 : kind === "bot" ? 22 : 20;
    const bodyH = kind === "kernel" ? 16 : kind === "pop" ? 22 : 20;
    e.setSize(bodyW, bodyH).setOffset((48 - bodyW) / 2, (48 - bodyH) / 2 + 4);
    if (isBoss) {
      e.setSize(28, 30).setOffset(10, 12);
    }

    const hp =
      (kind === "kernel" ? 1 : 2) +
      Math.floor(floor * 0.8) +
      (kind === "bot" || kind === "pop" ? 2 : 0);

    const data: EnemyData = {
      hp,
      maxHp: hp,
      speed:
        30 +
        floor * 3 +
        (kind === "eye" || kind === "kernel" ? 22 : 0) +
        (kind === "bug" ? 10 : 0),
      damage: 1,
      shootCd:
        kind === "bug" || kind === "kernel"
          ? 999
          : 1.55 - Math.min(floor * 0.05, 0.7),
      shootTimer: Phaser.Math.FloatBetween(0.3, 1.2),
      kind,
      frozen: 0,
      facing: "down",
      busy: false,
      isBoss
    };
    e.setData("data", data);

    const shadow = this.add
      .image(x, y + 22, "shadow")
      .setDepth(7)
      .setScale(scale * 0.7);
    e.setData("shadow", shadow);
    e.play(enemyAnimKey(kind, "idle", "down"));

    for (const state of ["attack", "hurt"] as const) {
      for (const dir of ["down", "up", "right", "left"] as Facing[]) {
        e.on(`animationcomplete-${enemyAnimKey(kind, state, dir)}`, () => {
          const d = e.getData("data") as EnemyData | undefined;
          if (!d || !e.active) return;
          d.busy = false;
          e.play(enemyAnimKey(kind, "idle", d.facing), true);
        });
      }
    }
    this.addEnemyHpBar(e);
    return e;
  }

  private addEnemyHpBar(enemy: Phaser.Physics.Arcade.Sprite) {
    const bar = this.add.graphics().setDepth(20);
    enemy.setData("hpBar", bar);
  }

  private createHud() {
    const { width } = this.scale;

    // Pause fake
    this.add
      .rectangle(28, 28, 36, 36, 0x566573, 0.85)
      .setScrollFactor(0)
      .setDepth(100)
      .setStrokeStyle(2, 0xffffff, 0.3);

    this.add
      .text(28, 28, "❚❚", { fontSize: "14px", color: "#fff" })
      .setOrigin(0.5)
      .setDepth(101)
      .setScrollFactor(0);

    // Coins
    this.add
      .sprite(width - 70, 28, "coin_spin", 0)
      .setDisplaySize(22, 22)
      .setScrollFactor(0)
      .setDepth(100)
      .play("coin-spin");
    this.coinText = this.add
      .text(width - 52, 28, String(runState.coins), {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#ffffff"
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100);

    const floorLabel = isBossFloor(runState.floor)
      ? `BOSS ${runState.floor}`
      : `FLOOR ${runState.floor}`;
    this.add
      .text(width / 2, 28, floorLabel, {
        fontFamily: "Arial Black, Arial",
        fontSize: "16px",
        color: isBossFloor(runState.floor) ? "#ff9ff3" : "#ffffff"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.85);

    this.hpContainer = this.add.container(0, 0).setDepth(100).setScrollFactor(0);
    this.refreshHpHud();
  }

  private refreshHpHud() {
    this.hpContainer.removeAll(true);
    for (let i = 0; i < runState.maxHp; i++) {
      const pip = this.add.image(18 + i * 16, -22, "hp_pip");
      if (i >= runState.hp) pip.setTint(0x444444);
      this.hpContainer.add(pip);
    }
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    if (!this.player?.active) return;

    this.invuln = Math.max(0, this.invuln - dt);

    // Movimento (joystick + WASD/setas no desktop)
    const v = this.joystick.getVector().clone();
    if (this.cursors?.left.isDown || this.wasd?.A?.isDown) v.x = -1;
    if (this.cursors?.right.isDown || this.wasd?.D?.isDown) v.x = 1;
    if (this.cursors?.up.isDown || this.wasd?.W?.isDown) v.y = -1;
    if (this.cursors?.down.isDown || this.wasd?.S?.isDown) v.y = 1;
    if (v.lengthSq() > 1) v.normalize();

    const moving = v.lengthSq() > 0.01;
    const attacking = this.player.getData("attacking") === true;

    this.facing = updatePlayerMotion({
      sprite: this.player,
      shadow: this.player.getData("shadow") as Phaser.GameObjects.Image,
      velocity: v,
      facing: this.facing,
      speed: this.playerSpeed,
      timeMs: this.time.now,
      lockAnim: attacking
    });

    // Clamp na sala
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.room.x + 16,
      this.room.right - 16
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.room.y + 20,
      this.room.bottom - 20
    );

    this.hpContainer.setPosition(this.player.x - 28, this.player.y - 22);

    // Anel de mira no inimigo mais próximo
    const nearest = this.nearestEnemy();
    if (nearest && !this.cleared) {
      this.targetRing.setVisible(true).setPosition(nearest.x, nearest.y + 18);
    } else {
      this.targetRing.setVisible(false);
    }

    // Ataque automático ao parar (só com alvo)
    if (!moving && !this.cleared) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        const target = this.nearestEnemy();
        if (target) {
          this.facing = facingFromVector(
            target.x - this.player.x,
            target.y - this.player.y,
            this.facing
          );
          this.player.setData("attacking", true);
          this.player.play(playerAnimKey("attack", this.facing), true);
          this.firePlayer();
        }
        const speedBonus = runState.skills.attack_speed ?? 0;
        this.attackTimer = Math.max(0.18, 0.55 - speedBonus * 0.06);
      }
    }

    this.updateEnemies(dt);
    this.updateElves(dt);
    this.updateEnemyHpBars();
    this.cullPlayerBulletsAtWalls();
    this.checkRoomClear();
    this.checkElevator();
  }

  private firePlayer() {
    const target = this.nearestEnemy();
    if (!target) return;

    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      target.x,
      target.y
    );

    const front = 1 + (runState.skills.front_arrow ?? 0);
    const multi = 1 + (runState.skills.multishot ?? 0);
    const hasDiag = (runState.skills.diagonal ?? 0) > 0;
    const useDark = (runState.skills.dark_missile ?? 0) > 0;

    for (let m = 0; m < multi; m++) {
      for (let f = 0; f < front; f++) {
        const spread = (f - (front - 1) / 2) * 0.18;
        this.spawnPlayerBullet(angle + spread, useDark ? "bullet_dark" : "bullet_player");
      }
      if (hasDiag) {
        this.spawnPlayerBullet(angle - 0.45, "bullet_player");
        this.spawnPlayerBullet(angle + 0.45, "bullet_player");
      }
    }

    // Fury of Thor
    const thor = runState.skills.fury_of_thor ?? 0;
    if (thor > 0 && Math.random() < 0.25 + thor * 0.1) {
      this.enemies.getChildren().forEach((obj) => {
        const e = obj as Phaser.Physics.Arcade.Sprite;
        if (!e.active) return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < 160) {
          this.damageEnemy(e, 1);
          const bolt = this.add
            .line(0, 0, this.player.x, this.player.y, e.x, e.y, 0xf1c40f)
            .setLineWidth(2)
            .setDepth(15);
          this.tweens.add({
            targets: bolt,
            alpha: 0,
            duration: 200,
            onComplete: () => bolt.destroy()
          });
        }
      });
    }
  }

  private spawnPlayerBullet(angle: number, key: string) {
    const usePackBolt = key === "bullet_player";
    // Nasce um pouco à frente pra não colidir no bloco sob o mago
    const ox = this.player.x + Math.cos(angle) * 18;
    const oy = this.player.y + Math.sin(angle) * 18;
    const b = this.playerBullets.get(
      ox,
      oy,
      usePackBolt ? "wizard" : key
    ) as Phaser.Physics.Arcade.Image | null;
    if (!b) return;

    b.setActive(true).setVisible(true).setDepth(16).clearTint();
    if (usePackBolt) {
      b.setTexture("wizard", 68);
      b.setScale(1.6);
      b.setRotation(angle + Math.PI / 2);
    } else {
      b.setTexture(key);
      b.setScale(1);
      b.setRotation(0);
    }

    // Hitbox pequena — o frame do pack é 48×48 e matava o tiro cedo nos blocos
    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    body.enable = true;
    body.setSize(10, 10);
    body.setOffset((b.width - 10) / 2, (b.height - 10) / 2);
    body.setAllowGravity(false);

    const speed = 420;
    this.physics.velocityFromRotation(angle, speed, body.velocity);
    b.setData("bounces", runState.skills.wall_bounce ?? 0);
    b.setData("rico", runState.skills.ricochet ?? 0);
    b.setData("dmg", 1);
    b.setData("spawnAt", this.time.now);
  }

  /** Destrói tiro nas bordas da arena (paredes do mapa). */
  private cullPlayerBulletsAtWalls() {
    const pad = 2;
    const r = this.room;
    this.playerBullets.getChildren().forEach((obj) => {
      const b = obj as Phaser.Physics.Arcade.Image;
      if (!b.active) return;
      if (
        b.x < r.x - pad ||
        b.x > r.right + pad ||
        b.y < r.y - pad ||
        b.y > r.bottom + pad
      ) {
        this.killPlayerBullet(b);
      }
    });
  }

  private killPlayerBullet(b: Phaser.Physics.Arcade.Image) {
    if (!b.active) return;
    this.playerBullets.killAndHide(b);
    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
      body.stop();
    }
  }

  private onPlayerBulletHitWall(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    _wallObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    if (!bullet.active) return;

    // Ignora colisão logo no spawn (evita sumir no bloco ao lado do mago)
    const spawnAt = (bullet.getData("spawnAt") as number) || 0;
    if (this.time.now - spawnAt < 80) return;

    const bounces = (bullet.getData("bounces") as number) || 0;
    if (bounces > 0) {
      bullet.setData("bounces", bounces - 1);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.left || body.blocked.right) body.velocity.x *= -1;
      if (body.blocked.up || body.blocked.down) body.velocity.y *= -1;
      bullet.setRotation(Math.atan2(body.velocity.y, body.velocity.x) + Math.PI / 2);
      return;
    }

    this.killPlayerBullet(bullet);
  }

  private nearestEnemy(): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestD = Infinity;
    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  private updateEnemies(dt: number) {
    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      const data = e.getData("data") as EnemyData;
      if (data.frozen > 0) {
        data.frozen -= dt;
        e.setTint(0x74b9ff);
        e.setVelocity(0, 0);
        return;
      }
      if (data.isBoss) e.setTint(0xff9ff3);
      else e.clearTint();

      // Perseguir / flanquear
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
      if (data.isBoss) {
        // Boss fica mais na metade de cima e orbita
        this.physics.velocityFromRotation(
          angle + Math.sin(this.time.now / 700) * 0.9,
          data.speed,
          e.body.velocity as Phaser.Math.Vector2
        );
      } else if (data.kind === "eye" || data.kind === "bug") {
        this.physics.velocityFromRotation(angle, data.speed, e.body.velocity as Phaser.Math.Vector2);
      } else {
        // bots/pop mais lentos, orbitam um pouco
        this.physics.velocityFromRotation(
          angle + Math.sin(this.time.now / 400) * 0.5,
          data.speed * 0.7,
          e.body.velocity as Phaser.Math.Vector2
        );
      }

      // Clamp
      e.x = Phaser.Math.Clamp(e.x, this.room.x + 16, this.room.right - 16);
      e.y = Phaser.Math.Clamp(
        e.y,
        this.room.y + 20,
        data.isBoss ? this.room.centerY + 40 : this.room.bottom - 20
      );

      const shadow = e.getData("shadow") as Phaser.GameObjects.Image;
      if (shadow) shadow.setPosition(e.x, e.y + 22);

      // Idle / move — respeita preset attack/hurt em curso
      const vx = e.body?.velocity.x ?? 0;
      const vy = e.body?.velocity.y ?? 0;
      const spd = Math.hypot(vx, vy);
      if (!data.busy) {
        data.facing = facingFromVector(vx, vy, data.facing);
        const state = data.frozen > 0 || spd < 12 ? "idle" : "move";
        const want = enemyAnimKey(data.kind, state, data.facing);
        if (e.anims.currentAnim?.key !== want) e.play(want, true);
      }

      // Atirar com preset Attack
      data.shootTimer -= dt;
      if (data.shootTimer <= 0 && !data.busy) {
        if (data.isBoss) {
          data.shootTimer = data.shootCd;
          data.bossPhase = (data.bossPhase ?? 0) + 1;
          if ((data.bossPhase ?? 0) % 3 === 0) this.bossLaser(e);
          else this.bossRingShot(e, angle);
        } else if (data.kind !== "bug" && data.kind !== "kernel") {
          data.shootTimer = data.shootCd;
          this.enemyShoot(e, angle);
        }
      }
    });
  }

  private bossRingShot(e: Phaser.Physics.Arcade.Sprite, angle: number) {
    const data = e.getData("data") as EnemyData;
    data.facing = facingFromVector(Math.cos(angle), Math.sin(angle), data.facing);
    data.busy = true;
    e.play(enemyAnimKey(data.kind, "attack", data.facing), true);

    const count = 8 + Math.floor(runState.floor / 20);
    for (let i = 0; i < count; i++) {
      const a = angle + (i / count) * Math.PI * 2;
      const b = this.enemyBullets.get(e.x, e.y, "bullet_ring") as Phaser.Physics.Arcade.Image;
      if (!b) continue;
      b.setActive(true).setVisible(true);
      b.setTexture("bullet_ring");
      b.setTint(0xff9ff3);
      b.body.enable = true;
      this.physics.velocityFromRotation(
        a,
        110 + runState.floor * 3,
        b.body.velocity as Phaser.Math.Vector2
      );
      this.time.delayedCall(2800, () => {
        if (b.active) {
          b.clearTint();
          this.enemyBullets.killAndHide(b);
        }
      });
    }
  }

  /** Telegráfo rosa + rajada em linha (estilo laser do WL). */
  private bossLaser(e: Phaser.Physics.Arcade.Sprite) {
    const data = e.getData("data") as EnemyData;
    const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y);
    data.facing = facingFromVector(Math.cos(angle), Math.sin(angle), data.facing);
    data.busy = true;
    e.play(enemyAnimKey(data.kind, "attack", data.facing), true);

    const gfx = this.laserGfx;
    const len = 420;
    const x2 = e.x + Math.cos(angle) * len;
    const y2 = e.y + Math.sin(angle) * len;

    // Aviso
    gfx?.clear();
    gfx?.lineStyle(3, 0xff9ff3, 0.45);
    gfx?.lineBetween(e.x, e.y, x2, y2);

    this.time.delayedCall(450, () => {
      if (!e.active) {
        gfx?.clear();
        return;
      }
      gfx?.clear();
      gfx?.lineStyle(6, 0xff6bcb, 0.95);
      gfx?.lineBetween(e.x, e.y, x2, y2);

      // Projéteis rápidos ao longo do raio
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 40, () => {
          if (!e.active) return;
          const b = this.enemyBullets.get(
            e.x,
            e.y,
            "bullet_ring"
          ) as Phaser.Physics.Arcade.Image;
          if (!b) return;
          b.setActive(true).setVisible(true);
          b.setTexture("bullet_ring");
          b.setTint(0xff6bcb);
          b.setScale(1.35);
          b.body.enable = true;
          this.physics.velocityFromRotation(
            angle,
            280 + runState.floor * 4,
            b.body.velocity as Phaser.Math.Vector2
          );
          this.time.delayedCall(1600, () => {
            if (b.active) {
              b.clearTint();
              b.setScale(1);
              this.enemyBullets.killAndHide(b);
            }
          });
        });
      }

      this.time.delayedCall(180, () => gfx?.clear());
    });
  }

  private enemyShoot(e: Phaser.Physics.Arcade.Sprite, angle: number) {
    const data = e.getData("data") as EnemyData;
    data.facing = facingFromVector(Math.cos(angle), Math.sin(angle), data.facing);
    data.busy = true;
    e.play(enemyAnimKey(data.kind, "attack", data.facing), true);

    const b = this.enemyBullets.get(e.x, e.y, "bullet_ring") as Phaser.Physics.Arcade.Image;
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.setTexture("bullet_ring");
    b.body.enable = true;
    this.physics.velocityFromRotation(
      angle,
      140 + runState.floor * 5,
      b.body.velocity as Phaser.Math.Vector2
    );
    this.time.delayedCall(2500, () => {
      if (b.active) this.enemyBullets.killAndHide(b);
    });
  }

  private updateElves(dt: number) {
    this.elves.forEach((elf, i) => {
      const t = this.time.now / 500 + i * 2;
      elf.x = this.player.x + Math.cos(t) * 40;
      elf.y = this.player.y + Math.sin(t) * 40;
      if (Math.random() < dt * 1.5) {
        const target = this.nearestEnemy();
        if (target) {
          const angle = Phaser.Math.Angle.Between(elf.x, elf.y, target.x, target.y);
          this.spawnPlayerBulletFrom(elf.x, elf.y, angle, "bullet_fire");
        }
      }
    });
  }

  private spawnPlayerBulletFrom(x: number, y: number, angle: number, key: string) {
    const b = this.playerBullets.get(x, y, key) as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    b.setActive(true).setVisible(true).setDepth(16).clearTint();
    b.setTexture(key);
    b.setScale(1);
    b.setRotation(0);
    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    body.enable = true;
    body.setSize(10, 10);
    body.setOffset((b.width - 10) / 2, (b.height - 10) / 2);
    this.physics.velocityFromRotation(angle, 400, body.velocity);
    b.setData("dmg", 1);
    b.setData("bounces", 0);
    b.setData("rico", 0);
    b.setData("spawnAt", this.time.now);
  }

  private updateEnemyHpBars() {
    const kids = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    let bossHp = 0;
    let bossMax = 0;
    let hasBoss = false;

    for (const e of kids) {
      const bar = e.getData("hpBar") as Phaser.GameObjects.Graphics | undefined;
      const data = e.getData("data") as EnemyData | undefined;
      if (!bar || !e.active || !data) {
        bar?.clear();
        continue;
      }
      bar.clear();
      if (data.isBoss) {
        hasBoss = true;
        bossHp = data.hp;
        bossMax = data.maxHp;
        continue;
      }
      const w = 28;
      bar.fillStyle(0x000000, 0.5);
      bar.fillRect(e.x - w / 2, e.y - 24, w, 5);
      bar.fillStyle(0xe74c3c, 1);
      bar.fillRect(e.x - w / 2, e.y - 24, w * (data.hp / data.maxHp), 5);
    }

    if (this.bossHpGfx) {
      this.bossHpGfx.clear();
      if (hasBoss && bossMax > 0) {
        const { width } = this.scale;
        const barW = Math.min(280, width - 48);
        const x = (width - barW) / 2;
        const y = 62;
        const ratio = Math.max(0, bossHp / bossMax);
        this.bossHpGfx.fillStyle(0x2a1024, 0.85);
        this.bossHpGfx.fillRect(x - 2, y - 2, barW + 4, 14);
        this.bossHpGfx.fillStyle(0xff6bcb, 1);
        this.bossHpGfx.fillRect(x, y, barW * ratio, 10);
      }
    }
  }

  private onPlayerHitEnemy(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !enemy.active) return;

    const dmg = (bullet.getData("dmg") as number) || 1;
    this.damageEnemy(enemy, dmg);

    // Freeze chance
    if ((runState.skills.freeze ?? 0) > 0 && Math.random() < 0.2) {
      const data = enemy.getData("data") as EnemyData;
      data.frozen = 1.2;
    }

    const rico = (bullet.getData("rico") as number) || 0;
    if (rico > 0) {
      bullet.setData("rico", rico - 1);
      const next = this.enemies.getChildren().find((o) => {
        const e = o as Phaser.Physics.Arcade.Sprite;
        return e.active && e !== enemy;
      }) as Phaser.Physics.Arcade.Sprite | undefined;
      if (next) {
        const angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, next.x, next.y);
        this.physics.velocityFromRotation(angle, 300, bullet.body.velocity as Phaser.Math.Vector2);
        return;
      }
    }

    const bounces = (bullet.getData("bounces") as number) || 0;
    if (bounces > 0) {
      bullet.setData("bounces", bounces - 1);
      bullet.body.velocity.x *= -1;
      bullet.body.velocity.y *= -1;
      return;
    }

    this.killPlayerBullet(bullet);
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, dmg: number) {
    const data = enemy.getData("data") as EnemyData;
    data.hp -= dmg;
    this.showDamage(enemy.x, enemy.y - 20, dmg);

    if (data.hp <= 0) {
      const wasBoss = !!data.isBoss;
      const bar = enemy.getData("hpBar") as Phaser.GameObjects.Graphics;
      bar?.destroy();
      const shadow = enemy.getData("shadow") as Phaser.GameObjects.Image;
      shadow?.destroy();
      const splash = this.add
        .circle(enemy.x, enemy.y + 10, wasBoss ? 22 : 10, wasBoss ? 0xff6bcb : 0xe67e22, 0.7)
        .setDepth(3);
      this.tweens.add({
        targets: splash,
        alpha: 0,
        scale: wasBoss ? 2.6 : 1.8,
        duration: 500,
        onComplete: () => splash.destroy()
      });
      enemy.destroy();
      runState.coins += wasBoss ? 12 + runState.floor : 1;
      this.coinText.setText(String(runState.coins));
      if (wasBoss) {
        this.bossHpGfx?.clear();
        this.bossHpLabel?.destroy();
        this.bossHpLabel = undefined;
        this.laserGfx?.clear();
      }
      for (let i = 0; i < (wasBoss ? 14 : 6); i++) {
        const p = this.add.circle(enemy.x, enemy.y, wasBoss ? 4 : 3, wasBoss ? 0xff9ff3 : 0xf1c40f);
        this.tweens.add({
          targets: p,
          x: enemy.x + Phaser.Math.Between(-50, 50),
          y: enemy.y + Phaser.Math.Between(-50, 50),
          alpha: 0,
          duration: 450,
          onComplete: () => p.destroy()
        });
      }
    } else {
      // Preset Hurt do pack
      data.busy = true;
      enemy.play(enemyAnimKey(data.kind, "hurt", data.facing), true);
      enemy.setTint(0xffaaaa);
      this.time.delayedCall(120, () => {
        if (enemy.active) {
          if (data.isBoss) enemy.setTint(0xff9ff3);
          else enemy.clearTint();
        }
      });
    }
  }

  private showDamage(x: number, y: number, dmg: number) {
    const t = this.add
      .text(x, y, String(dmg * 17 + Phaser.Math.Between(3, 9)), {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 500,
      onComplete: () => t.destroy()
    });
  }

  private onEnemyHitPlayer(
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    if (!bullet.active) return;
    this.enemyBullets.killAndHide(bullet);
    bullet.body.enable = false;
    this.hurtPlayer(1);
  }

  private onTouchEnemy(
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
    if (!enemy.active) return;
    this.hurtPlayer(1);
    // Thorns
    const thorns = runState.skills.thorns ?? 0;
    if (thorns > 0) this.damageEnemy(enemy, thorns);
  }

  private hurtPlayer(amount: number) {
    if (this.invuln > 0 || this.cleared) return;
    runState.hp -= amount;
    this.invuln = 0.8;
    this.refreshHpHud();
    this.cameras.main.shake(120, 0.01);
    this.player.setTint(0xff6666);
    this.time.delayedCall(200, () => this.player.clearTint());

    if (runState.hp <= 0) {
      this.gameOver();
    }
  }

  private checkRoomClear() {
    if (this.cleared) return;
    const alive = this.enemies.countActive(true);
    if (alive === 0) {
      this.cleared = true;
      this.elevator.setTexture("tile_door_open");
      this.elevator.setDisplaySize(48, 48);
      this.elevator.setScale(1);
      this.elevator.setVisible(true);
      this.elevator.body.enable = true;
      // Porta fica fixa — só o texto indica a saída
      this.add
        .text(this.scale.width / 2, this.room.y + 70, "↑ Próximo andar", {
          fontFamily: "Arial Black, Arial",
          fontSize: "18px",
          color: "#f1c40f",
          stroke: "#000",
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(40);
    }
  }

  private checkElevator() {
    if (!this.cleared || !this.elevator.visible) return;
    const d = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.elevator.x,
      this.elevator.y
    );
    if (d < 45) {
      this.enterElevator();
    }
  }

  private gameOver() {
    this.physics.pause();
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(200);
    this.add
      .text(width / 2, height / 2 - 40, "YOU DIED", {
        fontFamily: "Arial Black, Arial",
        fontSize: "40px",
        color: "#e74c3c"
      })
      .setOrigin(0.5)
      .setDepth(201);
    this.add
      .text(width / 2, height / 2 + 10, `Floor ${runState.floor}  ·  Coins ${runState.coins}`, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(201);

    if (runState.floor > metaState.bestFloor) metaState.bestFloor = runState.floor;
    metaState.gems += Math.floor(runState.coins / 3);
    metaState.coinsBank += runState.coins;

    const retry = this.add
      .rectangle(width / 2, height / 2 + 55, 180, 44, 0x8e44ad)
      .setInteractive({ useHandCursor: true })
      .setDepth(201);
    this.add
      .text(width / 2, height / 2 + 55, "Retry", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#fff"
      })
      .setOrigin(0.5)
      .setDepth(202);
    retry.on("pointerdown", () => {
      this.joystick?.destroy();
      resetRun();
      this.scene.start("Game");
    });

    const lobby = this.add
      .rectangle(width / 2, height / 2 + 110, 180, 44, 0x5d6d7e)
      .setInteractive({ useHandCursor: true })
      .setDepth(201);
    this.add
      .text(width / 2, height / 2 + 110, "Lobby", {
        fontFamily: "Arial Black, Arial",
        fontSize: "20px",
        color: "#fff"
      })
      .setOrigin(0.5)
      .setDepth(202);
    lobby.on("pointerdown", () => {
      this.joystick?.destroy();
      resetRun();
      this.scene.start("Lobby");
    });
  }
}
