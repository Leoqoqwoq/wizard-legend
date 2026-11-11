import Phaser from "phaser";
import type { SkillId } from "./skills";

function canvasTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function bgOrb(ctx: CanvasRenderingContext2D, color: string) {
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  const g = ctx.createRadialGradient(28, 24, 4, 32, 32, 28);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, color);
  g.addColorStop(1, shade(color, -40));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.stroke();
}

function shade(hexColor: string, amt: number) {
  const n = parseInt(hexColor.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const DRAW: Record<SkillId, (ctx: CanvasRenderingContext2D) => void> = {
  front_arrow: (ctx) => {
    bgOrb(ctx, "#e74c3c");
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    // 3 setas pra frente
    for (const x of [22, 32, 42]) {
      ctx.beginPath();
      ctx.moveTo(x, 44);
      ctx.lineTo(x, 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5, 28);
      ctx.lineTo(x, 20);
      ctx.lineTo(x + 5, 28);
      ctx.fill();
    }
  },
  dark_missile: (ctx) => {
    bgOrb(ctx, "#8e44ad");
    ctx.fillStyle = "#2c1140";
    ctx.beginPath();
    ctx.ellipse(32, 34, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d2b4de";
    ctx.beginPath();
    ctx.arc(32, 22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(30, 20, 2, 0, Math.PI * 2);
    ctx.fill();
  },
  thorns: (ctx) => {
    bgOrb(ctx, "#27ae60");
    ctx.fillStyle = "#145a32";
    ctx.strokeStyle = "#abebc6";
    ctx.lineWidth = 2;
    for (const [x, y, a] of [
      [32, 18, 0],
      [22, 28, -0.5],
      [42, 28, 0.5],
      [26, 40, -0.2],
      [38, 40, 0.2]
    ] as [number, number, number][]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(-5, -2);
      ctx.lineTo(0, -10);
      ctx.lineTo(5, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  },
  fury_of_thor: (ctx) => {
    bgOrb(ctx, "#f1c40f");
    ctx.fillStyle = "#fff8dc";
    ctx.strokeStyle = "#7d6608";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 14);
    ctx.lineTo(24, 32);
    ctx.lineTo(32, 32);
    ctx.lineTo(26, 50);
    ctx.lineTo(42, 28);
    ctx.lineTo(34, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  flame_elf: (ctx) => {
    bgOrb(ctx, "#e67e22");
    // fogo
    ctx.fillStyle = "#f5b041";
    ctx.beginPath();
    ctx.moveTo(32, 14);
    ctx.quadraticCurveTo(44, 28, 38, 42);
    ctx.quadraticCurveTo(32, 36, 26, 42);
    ctx.quadraticCurveTo(20, 28, 32, 14);
    ctx.fill();
    ctx.fillStyle = "#fff3cd";
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.quadraticCurveTo(38, 32, 34, 40);
    ctx.quadraticCurveTo(32, 36, 30, 40);
    ctx.quadraticCurveTo(26, 32, 32, 24);
    ctx.fill();
    // olhinho
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(28, 30, 2.5, 0, Math.PI * 2);
    ctx.arc(36, 30, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(28, 30, 1.2, 0, Math.PI * 2);
    ctx.arc(36, 30, 1.2, 0, Math.PI * 2);
    ctx.fill();
  },
  ricochet: (ctx) => {
    bgOrb(ctx, "#3498db");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(16, 40);
    ctx.lineTo(28, 22);
    ctx.lineTo(40, 38);
    ctx.lineTo(50, 20);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(28, 22, 4, 0, Math.PI * 2);
    ctx.arc(40, 38, 4, 0, Math.PI * 2);
    ctx.fill();
  },
  multishot: (ctx) => {
    bgOrb(ctx, "#1abc9c");
    ctx.fillStyle = "#e8fff8";
    for (const [x, y] of [
      [32, 18],
      [22, 34],
      [42, 34],
      [32, 46]
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#0e6655";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.lineTo(22, 34);
    ctx.moveTo(32, 24);
    ctx.lineTo(42, 34);
    ctx.moveTo(32, 24);
    ctx.lineTo(32, 40);
    ctx.stroke();
  },
  diagonal: (ctx) => {
    bgOrb(ctx, "#9b59b6");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(18, 46);
    ctx.lineTo(46, 18);
    ctx.moveTo(18, 18);
    ctx.lineTo(46, 46);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    for (const [x, y] of [
      [46, 18],
      [46, 46]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y);
      ctx.lineTo(x, y + (y < 32 ? 8 : -8));
      ctx.fill();
    }
  },
  attack_speed: (ctx) => {
    bgOrb(ctx, "#2ecc71");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 14, -0.2, Math.PI * 1.4);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(42, 18);
    ctx.lineTo(48, 30);
    ctx.lineTo(36, 28);
    ctx.closePath();
    ctx.fill();
  },
  hp_boost: (ctx) => {
    bgOrb(ctx, "#ff6b81");
    drawHeart(ctx, 32, 36, 13, "#fff");
    ctx.fillStyle = "#ff4d6d";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    roundBox(ctx, 26, 18, 12, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(30, 20, 4, 8);
    ctx.fillRect(28, 22, 8, 4);
  },
  wall_bounce: (ctx) => {
    bgOrb(ctx, "#95a5a6");
    ctx.fillStyle = "#ecf0f1";
    ctx.strokeStyle = "#5d6d7e";
    ctx.lineWidth = 2;
    roundBox(ctx, 18, 20, 12, 28, 4);
    ctx.fill();
    ctx.stroke();
    roundBox(ctx, 34, 20, 12, 28, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 40);
    ctx.lineTo(32, 24);
    ctx.lineTo(42, 40);
    ctx.stroke();
  },
  freeze: (ctx) => {
    bgOrb(ctx, "#74b9ff");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(32, 32);
      ctx.lineTo(32 + Math.cos(a) * 16, 32 + Math.sin(a) * 16);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10);
      ctx.lineTo(
        32 + Math.cos(a) * 10 + Math.cos(a + 0.8) * 5,
        32 + Math.sin(a) * 10 + Math.sin(a + 0.8) * 5
      );
      ctx.stroke();
    }
    ctx.fillStyle = "#eaf6ff";
    ctx.beginPath();
    ctx.arc(32, 32, 5, 0, Math.PI * 2);
    ctx.fill();
  }
};

function roundBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s, x, y + s * 1.15);
  ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.7, x + s, y + s * 0.35);
  ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.35);
  ctx.fill();
}

export function skillGenKey(id: SkillId) {
  return `skill_gen_${id}`;
}

/** Gera ícones redondos de cada poder. */
export function ensureSkillIcons(scene: Phaser.Scene) {
  (Object.keys(DRAW) as SkillId[]).forEach((id) => {
    canvasTex(scene, skillGenKey(id), 64, 64, DRAW[id]);
  });
}

/** Coração de vida suave (substitui o pip estranho). */
export function ensureHpHeart(scene: Phaser.Scene) {
  canvasTex(scene, "hp_pip", 28, 26, (ctx) => {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 5;
    drawHeart(ctx, 14, 4, 10, "#ff4d6d");
    ctx.shadowBlur = 0;
    // brilho
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(10, 10, 3.5, 2.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // contorno
    ctx.strokeStyle = "#9b1b30";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 7.5);
    ctx.bezierCurveTo(14, 4, 4, 4, 4, 7.5);
    ctx.bezierCurveTo(4, 12, 14, 16, 14, 18.5);
    ctx.bezierCurveTo(14, 16, 24, 12, 24, 7.5);
    ctx.bezierCurveTo(24, 4, 14, 4, 14, 7.5);
    ctx.stroke();
  });
}
