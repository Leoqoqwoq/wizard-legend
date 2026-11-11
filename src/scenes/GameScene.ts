import Phaser from "phaser";
import { Joystick } from "../game/Joystick";
import { CAPES, metaState } from "../game/MetaState";
import {
  runState,
  resetRun,
  isBossFloor,
  isFinalCampaignFloor,
  isUltraBossFloor
} from "../game/RunState";
import {
  enemyAnimKey,
  facingFromVector,
  playerAnimKey,
  type EnemyKind,
  type Facing
} from "../game/createAnims";
import { updatePlayerMotion } from "../game/playerMotion";
import {
  ULTRA_BOSS,
  enemiesForFloor,
  kingdomForFloor,
  type KingdomEnemySlot
} from "../game/kingdoms";
import { followBrowserFrame } from "../game/followBrowser";

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
  isUltra?: boolean;
  /** Alterna ring / laser no boss */
  bossPhase?: number;
  displayTint?: number;
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
  private paused = false;
  private runEnded = false;
  private pauseUi: Phaser.GameObjects.GameObject[] = [];

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
    this.paused = false;
    this.runEnded = false;
    this.pauseUi = [];
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
      maxSize: 160,
      runChildUpdate: false
    });
    this.enemyBullets = this.physics.add.group({
      defaultKey: "bullet_ring",
      maxSize: 160,
      runChildUpdate: false
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
    followBrowserFrame(this, () => this.joystick?.destroy());
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
    // Overlap (não collider): evita tiro preso/empurrado pelo bloco
    this.physics.add.overlap(
      this.playerBullets,
      this.blocks,
      this.onPlayerBulletHitWall as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      (
        bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
      ) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Image;
        if (!bullet.active) return false;
        const spawnAt = (bullet.getData("spawnAt") as number) || 0;
        return this.time.now - spawnAt >= 60;
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

    // Texto do floor / reino no chão
    const endless = runState.mode === "endless";
    const kingdom = kingdomForFloor(runState.floor, endless);
    const floorLabel = isUltraBossFloor(runState.floor)
      ? "ULTRA"
      : `${runState.floor}`;
    this.add
      .text(r.centerX, r.centerY + 24, floorLabel, {
        fontFamily: "Arial Black, Arial",
        fontSize: "42px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setAlpha(0.18)
      .setDepth(1);
    this.add
      .text(
        r.centerX,
        r.centerY + 58,
        isUltraBossFloor(runState.floor)
          ? ULTRA_BOSS.kingdomName
          : endless
            ? `${kingdom.name} · ∞`
            : kingdom.name,
        {
          fontFamily: "Arial Black, Arial",
          fontSize: "16px",
          color: "#ffffff"
        }
      )
      .setOrigin(0.5)
      .setAlpha(0.22)
      .setDepth(1)
      .setTint(isUltraBossFloor(runState.floor) ? ULTRA_BOSS.accent : kingdom.accent);
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
    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    pBody.moves = true;
    pBody.setMaxSpeed(this.playerSpeed);
    if (this.physics.world.isPaused) this.physics.resume();
    const idleKey = playerAnimKey("idle", this.facing);
    if (this.anims.exists(idleKey)) this.player.play(idleKey);
    else this.player.setFrame(0);
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
    // Após Ultra Boss: vitória da campanha
    if (isFinalCampaignFloor(runState.floor)) {
      this.joystick.destroy();
      this.showCampaignVictory();
      return;
    }
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

    const pool = enemiesForFloor(floor, runState.mode === "endless");
    if (pool.length === 0) return;

    // Quantidade sobe no capítulo e no progresso geral
    const local = ((floor - 1) % 10) + 1;
    const count = Math.min(2 + Math.floor(local / 2) + Math.floor((floor - 1) / 20), 8);

    for (let i = 0; i < count; i++) {
      const slot = pool[i % pool.length];
      const x = Phaser.Math.Between(r.x + 50, r.right - 50);
      const y = Phaser.Math.Between(r.y + 80, r.centerY);
      this.createEnemy(slot.kind, x, y, floor, false, slot);

      // Pudim/pop pode trazer pirulito/kernel se já estiver liberado
      if (slot.kind === "pop" && pool.some((p) => p.kind === "kernel")) {
        const ker = pool.find((p) => p.kind === "kernel")!;
        this.createEnemy(
          "kernel",
          x + Phaser.Math.Between(-40, 40),
          y + Phaser.Math.Between(30, 60),
          floor,
          false,
          ker
        );
      }
    }
  }

  private spawnBoss(floor: number) {
    const r = this.room;
    const endless = runState.mode === "endless";
    const ultra = isUltraBossFloor(floor);
    const kingdom = kingdomForFloor(endless ? floor : Math.min(floor, 60), endless);

    const kind: EnemyType = ultra ? ULTRA_BOSS.kind : kingdom.boss.kind;
    const tint = ultra ? ULTRA_BOSS.tint : kingdom.boss.tint;
    const scale = ultra ? ULTRA_BOSS.scale : kingdom.boss.scale;
    const bossName = ultra ? ULTRA_BOSS.name : kingdom.boss.name;

    const boss = this.createEnemy(kind, r.centerX, r.y + 120, floor, true);
    const data = boss.getData("data") as EnemyData;
    // Boss: começa mais baixo e escala com o andar (não só a cada 10)
    data.hp = data.maxHp = ultra
      ? 140 + Math.floor(floor * 1.5)
      : 10 + floor * 2 + Math.floor(floor / 10) * 6;
    data.speed = ultra ? 30 : 24 + Math.floor(floor / 10) * 2;
    data.damage = ultra ? 2 : 1;
    data.shootCd = ultra
      ? 0.7
      : Math.max(0.9, 1.55 - Math.floor(floor / 10) * 0.07);
    data.shootTimer = 1.0;
    data.isBoss = true;
    data.isUltra = ultra;
    data.bossPhase = 0;
    data.displayTint = tint;
    boss.setScale(scale);
    boss.setTint(tint);
    boss.setDepth(12);
    const shadow = boss.getData("shadow") as Phaser.GameObjects.Image;
    shadow?.setScale(ultra ? 3.2 : 2.4).setAlpha(0.55);

    this.bossHpGfx = this.add.graphics().setDepth(110).setScrollFactor(0);
    const labelColor = ultra ? "#ffe566" : "#ffe6f7";
    this.bossHpLabel = this.add
      .text(
        this.scale.width / 2,
        52,
        ultra
          ? `ULTRA BOSS · ${bossName}`
          : `${bossName} · ${kingdom.name}`,
        {
          fontFamily: "Arial Black, Arial",
          fontSize: ultra ? "14px" : "12px",
          color: labelColor,
          stroke: "#4a1040",
          strokeThickness: 3
        }
      )
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
    isBoss = false,
    slot?: KingdomEnemySlot
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

    const tint = slot?.tint;
    if (tint !== undefined && !isBoss) e.setTint(tint);

    // Andares baixos: bem frágeis. Sobe devagar com o floor.
    const hp = this.enemyHpForFloor(kind, floor);

    const data: EnemyData = {
      hp,
      maxHp: hp,
      speed:
        34 +
        Math.floor(floor * 1.6) +
        (kind === "eye" || kind === "kernel" ? 18 : 0) +
        (kind === "bug" ? 8 : 0),
      damage: 1,
      shootCd:
        kind === "bug" || kind === "kernel"
          ? 999
          : 1.6 - Math.min(floor * 0.035, 0.55),
      shootTimer: Phaser.Math.FloatBetween(0.3, 1.2),
      kind,
      frozen: 0,
      facing: "down",
      busy: false,
      isBoss,
      displayTint: tint
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

  /** HP baixo no começo; sobe conforme o andar. */
  private enemyHpForFloor(kind: EnemyType, floor: number) {
    const f = Math.max(1, floor);
    const base =
      kind === "kernel" ? 1 : kind === "eye" || kind === "bug" ? 1 : 2;
    // +1 a cada 4 andares
    const step = Math.floor((f - 1) / 4);
    // a partir do 20, acelera um pouco
    const late = f >= 20 ? Math.floor((f - 19) / 3) : 0;
    const tanky =
      kind === "bot" || kind === "pop" ? Math.floor((f - 1) / 12) : 0;
    return Math.max(1, base + step + late + tanky);
  }

  private createHud() {
    const { width } = this.scale;

    const pauseBg = this.add
      .circle(30, 30, 20, 0x566573, 0.88)
      .setScrollFactor(0)
      .setDepth(100)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(30, 30, "❚❚", { fontSize: "13px", color: "#fff" })
      .setOrigin(0.5)
      .setDepth(101)
      .setScrollFactor(0);
    pauseBg.on("pointerdown", () => this.togglePause());

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

    const endless = runState.mode === "endless";
    const kingdom = kingdomForFloor(runState.floor, endless);
    const ultra = isUltraBossFloor(runState.floor);
    const floorLabel = ultra
      ? "ULTRA BOSS"
      : isBossFloor(runState.floor)
        ? `BOSS ${runState.floor}`
        : endless
          ? `∞ F${runState.floor}`
          : `F${runState.floor} · ${kingdom.name}`;
    this.add
      .text(width / 2, 28, floorLabel, {
        fontFamily: "Arial Black, Arial",
        fontSize: ultra ? "15px" : "13px",
        color: ultra ? "#ffd700" : isBossFloor(runState.floor) ? "#ff9ff3" : "#ffffff"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.9);

    // HP fixo no HUD (canto superior esquerdo), não segue o mago
    this.hpContainer = this.add.container(58, 30).setDepth(100).setScrollFactor(0);
    this.refreshHpHud();
  }

  private refreshHpHud() {
    this.hpContainer.removeAll(true);
    for (let i = 0; i < runState.maxHp; i++) {
      const pip = this.add.image(i * 22, 0, "hp_pip").setDisplaySize(20, 18);
      if (i >= runState.hp) pip.setTint(0x555555).setAlpha(0.55);
      this.hpContainer.add(pip);
    }
  }

  update(_t: number, dtMs: number) {
    if (this.paused) return;
    const dt = dtMs / 1000;
    if (!this.player?.active) return;
    if (!this.joystick) return;

    this.invuln = Math.max(0, this.invuln - dt);

    // Garante que o corpo pode se mover (owl/shop às vezes deixavam moves=false)
    const pBody = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (pBody && !pBody.moves) pBody.moves = true;
    if (this.physics.world.isPaused && !this.runEnded) this.physics.resume();

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
    const ox = this.player.x + Math.cos(angle) * 26;
    const oy = this.player.y + Math.sin(angle) * 26;
    this.armPlayerBullet(ox, oy, angle, key, 420, {
      bounces: runState.skills.wall_bounce ?? 0,
      rico: runState.skills.ricochet ?? 0,
      dmg: 1
    });
  }

  /** Reset completo do pool — evita hitbox/textura/velocidade “fantasma”. */
  private armPlayerBullet(
    x: number,
    y: number,
    angle: number,
    key: string,
    speed: number,
    data: { bounces: number; rico: number; dmg: number }
  ) {
    const tex = key === "bullet_player" ? "bullet_player" : key;
    const b = this.playerBullets.get(x, y, tex) as Phaser.Physics.Arcade.Image | null;
    if (!b) return;

    b.setTexture(tex);
    b.setActive(true).setVisible(true).setDepth(16);
    b.clearTint();
    b.setDisplaySize(tex === "bullet_dark" ? 22 : 18, tex === "bullet_dark" ? 22 : 18);
    b.setRotation(0);
    b.setPosition(x, y);

    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    body.enable = true;
    body.setAllowGravity(false);
    body.setCircle(5, b.width / 2 - 5, b.height / 2 - 5);
    body.reset(x, y);
    this.physics.velocityFromRotation(angle, speed, body.velocity);

    b.setData("bounces", data.bounces);
    b.setData("rico", data.rico);
    b.setData("dmg", data.dmg);
    b.setData("spawnAt", this.time.now);
    b.setData("lastBounceAt", 0);
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
    wallObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    if (!bullet.active) return;

    const spawnAt = (bullet.getData("spawnAt") as number) || 0;
    if (this.time.now - spawnAt < 60) return;

    const bounces = (bullet.getData("bounces") as number) || 0;
    if (bounces > 0) {
      const lastBounce = (bullet.getData("lastBounceAt") as number) || 0;
      if (this.time.now - lastBounce < 50) return;
      bullet.setData("bounces", bounces - 1);
      bullet.setData("lastBounceAt", this.time.now);
      const body = bullet.body as Phaser.Physics.Arcade.Body | null;
      if (!body) {
        this.killPlayerBullet(bullet);
        return;
      }
      // Overlap não preenche blocked.* — rebate pela normal do bloco
      const wall = wallObj as Phaser.Physics.Arcade.Sprite;
      const dx = bullet.x - wall.x;
      const dy = bullet.y - wall.y;
      if (Math.abs(dx) > Math.abs(dy)) body.velocity.x *= -1;
      else body.velocity.y *= -1;
      bullet.x += Math.sign(body.velocity.x || dx) * 8;
      bullet.y += Math.sign(body.velocity.y || dy) * 8;
      body.reset(bullet.x, bullet.y);
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
      const data = e.getData("data") as EnemyData | undefined;
      if (!data) return;
      if (data.frozen > 0) {
        data.frozen -= dt;
        e.setTint(0x74b9ff);
        e.setVelocity(0, 0);
        return;
      }
      if (data.displayTint !== undefined) e.setTint(data.displayTint);
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
      this.armEnemyBullet(e.x, e.y, a, 110 + runState.floor * 3, 0xff9ff3, 1, 2800);
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
          this.armEnemyBullet(
            e.x,
            e.y,
            angle,
            280 + runState.floor * 4,
            0xff6bcb,
            1.35,
            1600
          );
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

    this.armEnemyBullet(e.x, e.y, angle, 140 + runState.floor * 5, 0xffffff, 1, 2500);
  }

  private armEnemyBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    tint: number,
    scale: number,
    ttlMs: number
  ) {
    const b = this.enemyBullets.get(x, y, "bullet_ring") as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    b.setTexture("bullet_ring");
    b.setActive(true).setVisible(true).setDepth(16);
    if (tint !== 0xffffff) b.setTint(tint);
    else b.clearTint();
    const size = Math.round(20 * scale);
    b.setDisplaySize(size, size);
    b.setPosition(x, y);

    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    body.enable = true;
    body.setAllowGravity(false);
    body.setCircle(5, b.width / 2 - 5, b.height / 2 - 5);
    body.reset(x, y);
    this.physics.velocityFromRotation(angle, speed, body.velocity);

    this.time.delayedCall(ttlMs, () => {
      if (b.active) this.killEnemyBullet(b);
    });
  }

  private killEnemyBullet(b: Phaser.Physics.Arcade.Image) {
    if (!b.active && !(b.body as Phaser.Physics.Arcade.Body | null)?.enable) return;
    b.clearTint();
    b.setDisplaySize(20, 20);
    this.enemyBullets.killAndHide(b);
    const body = b.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
      body.stop();
    }
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
    this.armPlayerBullet(x, y, angle, key, 400, { bounces: 0, rico: 0, dmg: 1 });
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
      const data = enemy.getData("data") as EnemyData | undefined;
      if (data) data.frozen = 1.2;
    }

    const body = bullet.body as Phaser.Physics.Arcade.Body | null;
    const rico = (bullet.getData("rico") as number) || 0;
    if (rico > 0 && body) {
      bullet.setData("rico", rico - 1);
      const next = this.enemies.getChildren().find((o) => {
        const e = o as Phaser.Physics.Arcade.Sprite;
        return e.active && e !== enemy;
      }) as Phaser.Physics.Arcade.Sprite | undefined;
      if (next) {
        const angle = Phaser.Math.Angle.Between(bullet.x, bullet.y, next.x, next.y);
        this.physics.velocityFromRotation(angle, 300, body.velocity);
        return;
      }
    }

    const bounces = (bullet.getData("bounces") as number) || 0;
    if (bounces > 0 && body) {
      bullet.setData("bounces", bounces - 1);
      body.velocity.x *= -1;
      body.velocity.y *= -1;
      return;
    }

    this.killPlayerBullet(bullet);
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, dmg: number) {
    const data = enemy.getData("data") as EnemyData | undefined;
    if (!data) return;
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
          if (data.displayTint !== undefined) enemy.setTint(data.displayTint);
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
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ) {
    // overlap(enemyBullets, player) → 1º = tiro, 2º = mago
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    if (!bullet?.active) return;
    this.killEnemyBullet(bullet);
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
      const exitMsg = isFinalCampaignFloor(runState.floor)
        ? "↑ Vitória!"
        : runState.floor === 60
          ? "↑ Ultra Boss…"
          : "↑ Próximo andar";
      this.add
        .text(this.scale.width / 2, this.room.y + 70, exitMsg, {
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

  private recordProgress() {
    if (runState.mode === "endless") {
      if (runState.floor > metaState.bestFloor) metaState.bestFloor = runState.floor;
    } else if (runState.floor > metaState.bestCampaignFloor) {
      metaState.bestCampaignFloor = runState.floor;
    }
  }

  private togglePause() {
    if (this.runEnded) return;
    if (this.paused) {
      this.resumeGame();
      return;
    }
    this.paused = true;
    this.physics.pause();
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);

    const { width, height } = this.scale;
    const veil = this.add
      .rectangle(width / 2, height / 2, width, height, 0x0a0612, 0.72)
      .setScrollFactor(0)
      .setDepth(250)
      .setInteractive();
    const title = this.add
      .text(width / 2, height / 2 - 70, "PAUSE", {
        fontFamily: "Arial Black, Arial",
        fontSize: "36px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(251);
    const resumeBg = this.add
      .rectangle(width / 2, height / 2 + 10, 180, 44, 0x8e44ad)
      .setScrollFactor(0)
      .setDepth(251)
      .setInteractive({ useHandCursor: true });
    const resumeTxt = this.add
      .text(width / 2, height / 2 + 10, "Continuar", {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#fff"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(252);
    const lobbyBg = this.add
      .rectangle(width / 2, height / 2 + 70, 180, 44, 0x5d6d7e)
      .setScrollFactor(0)
      .setDepth(251)
      .setInteractive({ useHandCursor: true });
    const lobbyTxt = this.add
      .text(width / 2, height / 2 + 70, "Lobby", {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
        color: "#fff"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(252);

    this.pauseUi = [veil, title, resumeBg, resumeTxt, lobbyBg, lobbyTxt];
    resumeBg.on("pointerdown", () => this.resumeGame());
    lobbyBg.on("pointerdown", () => {
      this.recordProgress();
      this.joystick?.destroy();
      resetRun();
      this.scene.start("Lobby");
    });
  }

  private resumeGame() {
    if (!this.paused) return;
    this.paused = false;
    this.pauseUi.forEach((o) => o.destroy());
    this.pauseUi = [];
    this.physics.resume();
  }

  private showCampaignVictory() {
    this.runEnded = true;
    this.physics.pause();
    runState.campaignWon = true;
    this.recordProgress();
    metaState.gems += 80 + Math.floor(runState.coins / 2);
    metaState.coinsBank += runState.coins;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1028, 0.82).setDepth(200);
    this.add
      .text(width / 2, height / 2 - 70, "CAMPEÃO!", {
        fontFamily: "Arial Black, Arial",
        fontSize: "42px",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(201);
    this.add
      .text(width / 2, height / 2 - 20, "Você derrotou o Ultra Boss", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(201);
    this.add
      .text(
        width / 2,
        height / 2 + 16,
        `+80 gemas · Floor ${runState.floor} · ${runState.coins} coins`,
        {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#82e0aa"
        }
      )
      .setOrigin(0.5)
      .setDepth(201);

    const lobby = this.add
      .rectangle(width / 2, height / 2 + 70, 200, 48, 0x8e44ad)
      .setInteractive({ useHandCursor: true })
      .setDepth(201);
    this.add
      .text(width / 2, height / 2 + 70, "Voltar ao Lobby", {
        fontFamily: "Arial Black, Arial",
        fontSize: "18px",
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
    this.runEnded = true;
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

    this.recordProgress();
    metaState.gems += Math.floor(runState.coins / 3);
    metaState.coinsBank += runState.coins;

    const mode = runState.mode;
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
      resetRun(mode);
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
