import Phaser from "phaser";

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function addFrame(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: DrawFn
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ===================== HERÓI (pack free itch — GandalfHardcore) ===================== */
/**
 * Sheet 192×864, frames 48×48, 4 cols. Layout action-major:
 *   Idle / Walk / Run / Attack
 *   Em cada bloco a ordem do pack é: Down, Up, Left, Right
 *   (confirmado pela posição da barba nos frames laterais)
 *   Death + FX (rows 16–17)
 */

export type Facing = "down" | "up" | "right" | "left";

/** Índice da direção no spritesheet (não é right antes de left!). */
const FACING_SHEET_INDEX: Record<Facing, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3
};

const FACINGS: Facing[] = ["down", "up", "left", "right"];
const WIZARD_COLS = 4;

/** actionIndex: 0 idle, 1 walk, 2 run, 3 attack */
function wizardFrameStart(actionIndex: number, facing: Facing) {
  return (actionIndex * 4 + FACING_SHEET_INDEX[facing]) * WIZARD_COLS;
}

function makeSheetAnim(
  scene: Phaser.Scene,
  key: string,
  start: number,
  end: number,
  frameRate: number,
  repeat = -1
) {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers("wizard", { start, end }),
    frameRate,
    repeat
  });
}

/** Registra idle/walk/run/attack por direção + death + projétil do pack. */
export function registerWizardPackAnims(scene: Phaser.Scene) {
  FACINGS.forEach((dir) => {
    const idle0 = wizardFrameStart(0, dir);
    const walk0 = wizardFrameStart(1, dir);
    const run0 = wizardFrameStart(2, dir);
    const atk0 = wizardFrameStart(3, dir);
    makeSheetAnim(scene, `player-idle-${dir}`, idle0, idle0 + 3, 5);
    makeSheetAnim(scene, `player-walk-${dir}`, walk0, walk0 + 3, 9);
    makeSheetAnim(scene, `player-run-${dir}`, run0, run0 + 3, 12);
    makeSheetAnim(scene, `player-attack-${dir}`, atk0, atk0 + 3, 14, 0);
  });

  makeSheetAnim(scene, "player-idle", 0, 3, 6);
  makeSheetAnim(scene, "player-walk", 16, 19, 10);
  makeSheetAnim(scene, "player-attack", 48, 51, 14, 0);
  makeSheetAnim(scene, "player-death", 64, 67, 8, 0);
  makeSheetAnim(scene, "wizard-bolt", 68, 68, 1, 0);
  makeSheetAnim(scene, "wizard-bolt-hit", 69, 71, 12, 0);
}

/** Direção pelo eixo dominante — prioriza lado quando |x| >= |y|. */
export function facingFromVector(x: number, y: number, fallback: Facing = "down"): Facing {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return fallback;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  // Empate / quase empate: prefere horizontal (perfil) pra não ficar “de costas”
  if (ax >= ay) return x < 0 ? "left" : "right";
  return y < 0 ? "up" : "down";
}

export function playerAnimKey(
  state: "idle" | "walk" | "run" | "attack",
  facing: Facing
) {
  return `player-${state}-${facing}`;
}

/* ===================== VILÕES (pack free itch — Frakassets) ===================== */
/**
 * Free Monster Pack: floating-eye, mushroom, spider, bomb-walker, flame-wisp.
 * Aseprite tags: Idle/Walk/Attack/Hurt × South/East/North/West.
 */

export type EnemyKind = "eye" | "bug" | "bot" | "pop" | "kernel";

export const ENEMY_KINDS: EnemyKind[] = ["eye", "bug", "bot", "pop", "kernel"];

/** Walkers têm Walk; flyers usam Idle também como move. */
const ENEMY_HAS_WALK: Record<EnemyKind, boolean> = {
  eye: false,
  bug: true,
  bot: true,
  pop: true,
  kernel: false
};

const ASE_DIR: Record<Facing, string> = {
  down: "South",
  right: "East",
  up: "North",
  left: "West"
};

/**
 * Sheet 8 cols × N rows (48px). Hurt usa só 6 frames/linha; Idle começa na row 8.
 * Índices = grid Phaser (não os do JSON Aseprite, que pula células vazias).
 */
const SHEET_RANGES: Record<string, [number, number]> = {
  Attack_South: [0, 7],
  Attack_East: [8, 15],
  Attack_North: [16, 23],
  Attack_West: [24, 31],
  Hurt_South: [32, 37],
  Hurt_East: [40, 45],
  Hurt_North: [48, 53],
  Hurt_West: [56, 61],
  Idle_South: [64, 71],
  Idle_East: [72, 79],
  Idle_North: [80, 87],
  Idle_West: [88, 95],
  Walk_South: [96, 103],
  Walk_East: [104, 111],
  Walk_North: [112, 119],
  Walk_West: [120, 127]
};

function makeEnemyAnim(
  scene: Phaser.Scene,
  animKey: string,
  textureKey: string,
  start: number,
  end: number,
  frameRate: number,
  repeat = -1
) {
  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
  scene.anims.create({
    key: animKey,
    frames: scene.anims.generateFrameNumbers(textureKey, { start, end }),
    frameRate,
    repeat
  });
}

export function registerEnemyPackAnims(scene: Phaser.Scene) {
  for (const kind of ENEMY_KINDS) {
    const tex = `enemy_${kind}`;
    for (const facing of FACINGS) {
      const ase = ASE_DIR[facing];
      const idle = SHEET_RANGES[`Idle_${ase}`];
      const walk = SHEET_RANGES[`Walk_${ase}`];
      const attack = SHEET_RANGES[`Attack_${ase}`];
      const hurt = SHEET_RANGES[`Hurt_${ase}`];

      makeEnemyAnim(scene, `${kind}-idle-${facing}`, tex, idle[0], idle[1], 12);
      if (ENEMY_HAS_WALK[kind] && walk) {
        makeEnemyAnim(scene, `${kind}-move-${facing}`, tex, walk[0], walk[1], 12);
      } else {
        makeEnemyAnim(scene, `${kind}-move-${facing}`, tex, idle[0], idle[1], 12);
      }
      makeEnemyAnim(scene, `${kind}-attack-${facing}`, tex, attack[0], attack[1], 12, 0);
      makeEnemyAnim(scene, `${kind}-hurt-${facing}`, tex, hurt[0], hurt[1], 12, 0);
    }

    makeEnemyAnim(scene, `${kind}-idle`, tex, 64, 71, 12);
    if (ENEMY_HAS_WALK[kind]) {
      makeEnemyAnim(scene, `${kind}-move`, tex, 96, 103, 12);
    } else {
      makeEnemyAnim(scene, `${kind}-move`, tex, 64, 71, 12);
    }
  }
}

export function enemyAnimKey(
  kind: EnemyKind,
  state: "idle" | "move" | "attack" | "hurt",
  facing: Facing
) {
  return `${kind}-${state}-${facing}`;
}

export const ENEMY_ANIM: Record<EnemyKind, { idle: string; move: string }> = {
  eye: { idle: "eye-idle", move: "eye-move" },
  bug: { idle: "bug-idle", move: "bug-move" },
  bot: { idle: "bot-idle", move: "bot-move" },
  pop: { idle: "pop-idle", move: "pop-move" },
  kernel: { idle: "kernel-idle", move: "kernel-move" }
};

/* ===================== ESTÁTICOS ===================== */

function generateStatic(scene: Phaser.Scene) {
  addFrame(scene, "shadow", 40, 16, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(20, 8, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  addFrame(scene, "target_ring", 48, 48, (ctx) => {
    ctx.strokeStyle = "rgba(0, 230, 255, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 230, 255, 0.3)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.stroke();
  });

  const bullets: [string, string, string][] = [
    ["bullet_player", "#85c1e9", "#d6eaf8"],
    ["bullet_enemy", "#e74c3c", "#f5b7b1"],
    ["bullet_dark", "#8e44ad", "#d2b4de"],
    ["bullet_fire", "#e67e22", "#fdebd0"],
    ["bullet_thunder", "#f1c40f", "#fcf3cf"]
  ];
  bullets.forEach(([key, c1, c2]) => {
    addFrame(scene, key, 16, 16, (ctx) => {
      const g = ctx.createRadialGradient(6, 6, 1, 8, 8, 7);
      g.addColorStop(0, c2);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  addFrame(scene, "bullet_ring", 18, 18, (ctx) => {
    ctx.strokeStyle = "#ff3b3b";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(9, 9, 5, 0, Math.PI * 2);
    ctx.stroke();
  });

  addFrame(scene, "block", 44, 44, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 44, 44);
    g.addColorStop(0, "#aeb6bf");
    g.addColorStop(1, "#797d7f");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#566573";
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, 40, 40, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#95a5a6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 16);
    ctx.lineTo(34, 16);
    ctx.moveTo(10, 28);
    ctx.lineTo(34, 28);
    ctx.stroke();
  });

  addFrame(scene, "elevator", 80, 56, (ctx) => {
    ctx.fillStyle = "#5d6d7e";
    roundRect(ctx, 4, 4, 72, 48, 4);
    ctx.fill();
    const light = ctx.createLinearGradient(16, 10, 64, 46);
    light.addColorStop(0, "#fff3a0");
    light.addColorStop(1, "#f1c40f");
    ctx.fillStyle = light;
    roundRect(ctx, 16, 10, 48, 36, 3);
    ctx.fill();
  });

  addFrame(scene, "coin", 28, 28, (ctx) => {
    ctx.fillStyle = "#f1c40f";
    ctx.strokeStyle = "#b7950b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14, 14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f9e79f";
    ctx.beginPath();
    ctx.arc(14, 14, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  addFrame(scene, "hp_pip", 16, 12, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 12);
    g.addColorStop(0, "#58d68d");
    g.addColorStop(1, "#1e8449");
    ctx.fillStyle = g;
    roundRect(ctx, 1, 1, 14, 10, 2);
    ctx.fill();
  });
}

export function generateTexturesAndAnims(scene: Phaser.Scene) {
  generateStatic(scene);
}
