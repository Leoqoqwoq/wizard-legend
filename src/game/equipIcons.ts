import Phaser from "phaser";
import type { BookId, CapeId } from "./MetaState";

/** Ícones procedurais de capa/livro no estilo WL (chibi / vibrante). */

function canvasTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
}

function hex(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function drawCapeBase(
  ctx: CanvasRenderingContext2D,
  color: string,
  pattern: (ctx: CanvasRenderingContext2D) => void
) {
  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(32, 58, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // capa
  ctx.fillStyle = color;
  ctx.strokeStyle = "#1a1028";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(18, 14);
  ctx.quadraticCurveTo(8, 28, 12, 52);
  ctx.lineTo(52, 52);
  ctx.quadraticCurveTo(56, 28, 46, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // capuz
  ctx.beginPath();
  ctx.moveTo(20, 16);
  ctx.quadraticCurveTo(32, 4, 44, 16);
  ctx.quadraticCurveTo(32, 22, 20, 16);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(18, 14);
  ctx.quadraticCurveTo(8, 28, 12, 52);
  ctx.lineTo(52, 52);
  ctx.quadraticCurveTo(56, 28, 46, 14);
  ctx.closePath();
  ctx.clip();
  pattern(ctx);
  ctx.restore();
}

const CAPE_DRAW: Record<CapeId, (ctx: CanvasRenderingContext2D) => void> = {
  default: (ctx) => {
    drawCapeBase(ctx, "#2dd4bf", () => {});
  },
  heart: (ctx) => {
    drawCapeBase(ctx, "#ff9ec8", (c) => {
      c.fillStyle = "#ff4d8a";
      for (const [x, y] of [
        [22, 28],
        [38, 36],
        [28, 42]
      ]) {
        c.beginPath();
        c.moveTo(x, y + 4);
        c.bezierCurveTo(x - 6, y - 2, x - 2, y - 8, x, y - 2);
        c.bezierCurveTo(x + 2, y - 8, x + 6, y - 2, x, y + 4);
        c.fill();
      }
    });
  },
  star: (ctx) => {
    drawCapeBase(ctx, "#9b6bff", (c) => {
      c.fillStyle = "#ff6b6b";
      for (const [x, y] of [
        [24, 30],
        [40, 38],
        [30, 44]
      ]) {
        c.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? 5 : 2.2;
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.fill();
      }
    });
  },
  swirl: (ctx) => {
    drawCapeBase(ctx, "#ffe08a", (c) => {
      c.strokeStyle = "#e67e22";
      c.lineWidth = 2;
      for (const [x, y] of [
        [24, 32],
        [40, 40],
        [28, 46]
      ]) {
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 1.5);
        c.stroke();
      }
    });
  },
  crimson: (ctx) => {
    drawCapeBase(ctx, "#e74c3c", () => {});
  },
  frost: (ctx) => {
    drawCapeBase(ctx, "#a8e4ff", (c) => {
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      for (const [x, y] of [
        [24, 30],
        [40, 38],
        [30, 46]
      ]) {
        c.beginPath();
        c.moveTo(x - 5, y);
        c.lineTo(x + 5, y);
        c.moveTo(x, y - 5);
        c.lineTo(x, y + 5);
        c.moveTo(x - 3.5, y - 3.5);
        c.lineTo(x + 3.5, y + 3.5);
        c.moveTo(x + 3.5, y - 3.5);
        c.lineTo(x - 3.5, y + 3.5);
        c.stroke();
      }
    });
  },
  leaf: (ctx) => {
    drawCapeBase(ctx, "#58d68d", (c) => {
      c.fillStyle = "#1e8449";
      for (const [x, y] of [
        [24, 32],
        [40, 40]
      ]) {
        c.beginPath();
        c.ellipse(x, y, 5, 8, -0.4, 0, Math.PI * 2);
        c.fill();
      }
    });
  }
};

function drawBook(
  ctx: CanvasRenderingContext2D,
  color: number,
  symbol: (ctx: CanvasRenderingContext2D) => void
) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(14, 52, 36, 6);

  ctx.fillStyle = hex(color);
  ctx.strokeStyle = "#1a1028";
  ctx.lineWidth = 2.5;
  roundBook(ctx, 12, 8, 40, 46, 4);
  ctx.fill();
  ctx.stroke();

  // lombada
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(12, 8, 6, 46);

  // medalhão
  ctx.fillStyle = "#f7e7a8";
  ctx.beginPath();
  ctx.arc(34, 30, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1028";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  symbol(ctx);
}

function roundBook(
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

const BOOK_DRAW: Record<Exclude<BookId, "none">, (ctx: CanvasRenderingContext2D) => void> = {
  fire: (ctx) =>
    drawBook(ctx, 0xe74c3c, (c) => {
      c.fillStyle = "#e67e22";
      c.beginPath();
      c.moveTo(34, 22);
      c.quadraticCurveTo(40, 30, 34, 38);
      c.quadraticCurveTo(28, 30, 34, 22);
      c.fill();
    }),
  ice: (ctx) =>
    drawBook(ctx, 0x74b9ff, (c) => {
      c.strokeStyle = "#2980b9";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(34, 22);
      c.lineTo(34, 38);
      c.moveTo(26, 30);
      c.lineTo(42, 30);
      c.moveTo(28, 24);
      c.lineTo(40, 36);
      c.moveTo(40, 24);
      c.lineTo(28, 36);
      c.stroke();
    }),
  thunder: (ctx) =>
    drawBook(ctx, 0xf1c40f, (c) => {
      c.fillStyle = "#2c3e50";
      c.beginPath();
      c.moveTo(38, 20);
      c.lineTo(30, 30);
      c.lineTo(35, 30);
      c.lineTo(30, 40);
      c.lineTo(42, 28);
      c.lineTo(36, 28);
      c.closePath();
      c.fill();
    }),
  shield: (ctx) =>
    drawBook(ctx, 0x9b59b6, (c) => {
      c.fillStyle = "#6c3483";
      c.beginPath();
      c.moveTo(34, 22);
      c.lineTo(42, 26);
      c.lineTo(42, 34);
      c.quadraticCurveTo(34, 42, 26, 34);
      c.lineTo(26, 26);
      c.closePath();
      c.fill();
    }),
  wind: (ctx) =>
    drawBook(ctx, 0x2ecc71, (c) => {
      c.strokeStyle = "#1e8449";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(30, 28, 6, 0.2, Math.PI * 1.4);
      c.stroke();
      c.beginPath();
      c.arc(38, 34, 5, 0.2, Math.PI * 1.4);
      c.stroke();
    }),
  arcane: (ctx) =>
    drawBook(ctx, 0x8e44ad, (c) => {
      c.fillStyle = "#d2b4de";
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        const r = i % 2 === 0 ? 8 : 3.5;
        const px = 34 + Math.cos(a) * r;
        const py = 30 + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    })
};

export function ensureEquipIcons(scene: Phaser.Scene) {
  (Object.keys(CAPE_DRAW) as CapeId[]).forEach((id) => {
    canvasTex(scene, `icon_cape_${id}`, 64, 64, CAPE_DRAW[id]);
  });
  (Object.keys(BOOK_DRAW) as Exclude<BookId, "none">[]).forEach((id) => {
    canvasTex(scene, `icon_book_${id}`, 64, 64, BOOK_DRAW[id]);
  });
}

export function capeIconKey(id: CapeId) {
  return `icon_cape_${id}`;
}

export function bookIconKey(id: BookId) {
  return id === "none" ? "ui_book" : `icon_book_${id}`;
}
