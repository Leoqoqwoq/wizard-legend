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
    // 48px + glow: projétil mais redondo/suave no upscale
    addFrame(scene, key, 48, 48, (ctx) => {
      ctx.shadowColor = c1;
      ctx.shadowBlur = 10;
      const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 16);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, c2);
      g.addColorStop(0.75, c1);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(24, 24, 16, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  addFrame(scene, "bullet_ring", 48, 48, (ctx) => {
    ctx.strokeStyle = "#ff3b3b";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(24, 24, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,180,180,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(24, 24, 8, 0, Math.PI * 2);
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

  // hp_pip definitivo em ensureHpHeart (coração)
  generateSoftUi(scene);
}

/** UI suave/arredondada (cartas, livro, botões). */
function generateSoftUi(scene: Phaser.Scene) {
  // Carta de skill — pergaminho arredondado
  const makeCard = (key: string, c0: string, c1: string, edge: string) => {
    addFrame(scene, key, 160, 240, (ctx) => {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      const g = ctx.createLinearGradient(0, 0, 0, 240);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      roundRect(ctx, 12, 10, 136, 212, 28);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 4;
      roundRect(ctx, 12, 10, 136, 212, 28);
      ctx.stroke();
      // brilho superior
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      roundRect(ctx, 22, 18, 116, 36, 16);
      ctx.fill();
      // medalhão do ícone
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(80, 88, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(80,40,20,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(80, 88, 34, 0, Math.PI * 2);
      ctx.stroke();
    });
  };
  makeCard("ui_soft_card", "#fff3d6", "#e8c48a", "#c48a4a");
  makeCard("ui_soft_card_alt", "#f3e7ff", "#c9a6e8", "#8e5bb8");
  makeCard("ui_soft_card_warm", "#ffe8d6", "#f0a878", "#d4783a");

  // Livro aberto suave (substitui o print estranho)
  addFrame(scene, "ui_soft_book", 420, 260, (ctx, w, h) => {
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    // capa
    ctx.fillStyle = "#6b3a22";
    roundRect(ctx, 18, 22, w - 36, h - 44, 26);
    ctx.fill();
    ctx.shadowBlur = 0;
    // páginas
    const pageG = ctx.createLinearGradient(40, 40, 40, h - 40);
    pageG.addColorStop(0, "#fffaf0");
    pageG.addColorStop(1, "#f0e0c8");
    ctx.fillStyle = pageG;
    roundRect(ctx, 36, 36, w - 72, h - 72, 18);
    ctx.fill();
    // lombada / sombra central
    const spine = ctx.createLinearGradient(w / 2 - 18, 0, w / 2 + 18, 0);
    spine.addColorStop(0, "rgba(90,50,30,0.08)");
    spine.addColorStop(0.5, "rgba(60,30,15,0.28)");
    spine.addColorStop(1, "rgba(90,50,30,0.08)");
    ctx.fillStyle = spine;
    ctx.fillRect(w / 2 - 16, 40, 32, h - 80);
    // linhas decorativas nas páginas
    ctx.strokeStyle = "rgba(140,100,60,0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = 70 + i * 28;
      ctx.beginPath();
      ctx.moveTo(56, y);
      ctx.lineTo(w / 2 - 28, y);
      ctx.moveTo(w / 2 + 28, y);
      ctx.lineTo(w - 56, y);
      ctx.stroke();
    }
    // anéis da lombada
    for (let i = 0; i < 4; i++) {
      const y = 70 + i * 42;
      ctx.fillStyle = "#d4a017";
      ctx.beginPath();
      ctx.ellipse(w / 2, y, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8a5a10";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  // Slot redondo
  addFrame(scene, "ui_soft_slot", 64, 64, (ctx) => {
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 8;
    const g = ctx.createRadialGradient(32, 28, 6, 32, 32, 26);
    g.addColorStop(0, "#fff8e8");
    g.addColorStop(1, "#d7b48a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#a67c52";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Botão pílula
  addFrame(scene, "ui_soft_btn", 220, 64, (ctx) => {
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "#b57bde");
    g.addColorStop(1, "#7b3fa8");
    ctx.fillStyle = g;
    roundRect(ctx, 8, 8, 204, 48, 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    roundRect(ctx, 16, 12, 188, 16, 10);
    ctx.fill();
  });

  addFrame(scene, "ui_soft_btn_brown", 220, 64, (ctx) => {
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "#e0b07a");
    g.addColorStop(1, "#a86b35");
    ctx.fillStyle = g;
    roundRect(ctx, 8, 8, 204, 48, 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 16, 12, 188, 16, 10);
    ctx.fill();
  });
}

export function generateTexturesAndAnims(scene: Phaser.Scene) {
  generateStatic(scene);
}
