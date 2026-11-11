import Phaser from "phaser";

/** Sprites no estilo Wizard Legend (arte original, vilões do vídeo). */
export function generateTextures(scene: Phaser.Scene) {
  makePlayer(scene);
  makeYellowEye(scene);
  makeGreenSlime(scene);
  makeClockSpider(scene);
  makePopcorn(scene);
  makePopKernel(scene);
  makeShadow(scene);
  makeBullets(scene);
  makeBlock(scene);
  makeElevator(scene);
  makeCoin(scene);
  makeHpPip(scene);
  makeTargetRing(scene);
}

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

/** Herói: cabelo rosa, capa teal com capuz, espada azul (estilo vídeo). */
function makePlayer(scene: Phaser.Scene) {
  canvasTex(scene, "player", 72, 80, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(36, 74, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // capa larga (silhueta chibi)
    const cloak = ctx.createLinearGradient(16, 34, 56, 70);
    cloak.addColorStop(0, "#5eead4");
    cloak.addColorStop(0.5, "#2dd4bf");
    cloak.addColorStop(1, "#0f766e");
    ctx.fillStyle = cloak;
    ctx.strokeStyle = "#115e59";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(22, 36);
    ctx.quadraticCurveTo(14, 48, 16, 68);
    ctx.lineTo(56, 68);
    ctx.quadraticCurveTo(58, 48, 50, 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // capuz
    ctx.fillStyle = "#14b8a6";
    ctx.beginPath();
    ctx.ellipse(36, 38, 22, 14, 0, Math.PI * 1.05, -0.05);
    ctx.fill();
    ctx.stroke();

    // cabeça
    ctx.fillStyle = "#f5c6a8";
    ctx.strokeStyle = "#d4a088";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(36, 32, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // cabelo rosa bagunçado
    ctx.fillStyle = "#f43f5e";
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(22, 30);
    ctx.lineTo(24, 14);
    ctx.lineTo(30, 18);
    ctx.lineTo(36, 10);
    ctx.lineTo(42, 18);
    ctx.lineTo(48, 13);
    ctx.lineTo(50, 30);
    ctx.lineTo(44, 22);
    ctx.lineTo(28, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // olhos
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(30, 32, 3.5, 0, Math.PI * 2);
    ctx.arc(42, 32, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(30.5, 32.5, 1.7, 0, Math.PI * 2);
    ctx.arc(42.5, 32.5, 1.7, 0, Math.PI * 2);
    ctx.fill();

    // braço
    ctx.strokeStyle = "#115e59";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(50, 44);
    ctx.lineTo(58, 40);
    ctx.stroke();

    // espada brilhante
    const sword = ctx.createLinearGradient(56, 16, 64, 56);
    sword.addColorStop(0, "#e0f2fe");
    sword.addColorStop(0.4, "#38bdf8");
    sword.addColorStop(1, "#0369a1");
    ctx.fillStyle = sword;
    ctx.strokeStyle = "#0c4a6e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 14);
    ctx.lineTo(66, 20);
    ctx.lineTo(62, 56);
    ctx.lineTo(56, 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(61, 20);
    ctx.lineTo(59, 50);
    ctx.stroke();
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(56, 54, 10, 6);
  });
}

/** Ciclope amarelo voador (vídeo). */
function makeYellowEye(scene: Phaser.Scene) {
  canvasTex(scene, "enemy_eye", 56, 56, (ctx) => {
    ctx.fillStyle = "rgba(255, 230, 120, 0.45)";
    ctx.strokeStyle = "rgba(200, 160, 40, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(12, 22, 12, 16, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(44, 22, 12, 16, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const grad = ctx.createRadialGradient(28, 28, 4, 28, 30, 22);
    grad.addColorStop(0, "#ffe566");
    grad.addColorStop(1, "#f0b429");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#c98a10";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(28, 30, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(28, 28, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(28, 29, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(25, 26, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0b429";
    ctx.strokeStyle = "#c98a10";
    ctx.beginPath();
    ctx.ellipse(20, 46, 5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(36, 46, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

/** Slime/olho verde bravo com asas. */
function makeGreenSlime(scene: Phaser.Scene) {
  canvasTex(scene, "enemy_bug", 60, 60, (ctx) => {
    ctx.fillStyle = "rgba(180, 190, 200, 0.4)";
    ctx.strokeStyle = "rgba(120, 130, 140, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(12, 20, 13, 15, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(48, 20, 13, 15, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const grad = ctx.createRadialGradient(30, 30, 5, 30, 32, 24);
    grad.addColorStop(0, "#c8f574");
    grad.addColorStop(1, "#5daf2e");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#3d7a1c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(30, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // sobrancelha brava
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, 22);
    ctx.quadraticCurveTo(30, 18, 42, 22);
    ctx.stroke();

    // olho
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(30, 30, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.arc(30, 31, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(30, 32, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(27, 28, 2, 0, Math.PI * 2);
    ctx.fill();

    // nubs
    ctx.fillStyle = "#5daf2e";
    ctx.strokeStyle = "#3d7a1c";
    ctx.beginPath();
    ctx.ellipse(16, 48, 6, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(44, 48, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

/** Relógio-aranha mecânico. */
function makeClockSpider(scene: Phaser.Scene) {
  canvasTex(scene, "enemy_bot", 72, 64, (ctx) => {
    // pernas
    ctx.strokeStyle = "#7f8c8d";
    ctx.lineWidth = 3;
    const legs = [
      [16, 36, 6, 54],
      [22, 40, 14, 58],
      [50, 36, 66, 54],
      [48, 40, 58, 58],
      [20, 30, 4, 40],
      [52, 30, 68, 40]
    ];
    legs.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = "#95a5a6";
      ctx.beginPath();
      ctx.arc(x2, y2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // corpo / relógio
    const grad = ctx.createRadialGradient(36, 28, 4, 36, 30, 22);
    grad.addColorStop(0, "#85c1e9");
    grad.addColorStop(1, "#2e86ab");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#1a5276";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(36, 28, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // aro metálico
    ctx.strokeStyle = "#bdc3c7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(36, 28, 16, 0, Math.PI * 2);
    ctx.stroke();

    // face do relógio
    ctx.fillStyle = "#ebf5fb";
    ctx.beginPath();
    ctx.arc(36, 28, 13, 0, Math.PI * 2);
    ctx.fill();

    // ponteiros
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 28);
    ctx.lineTo(36, 18);
    ctx.moveTo(36, 28);
    ctx.lineTo(46, 30);
    ctx.stroke();
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(36, 28, 3, 0, Math.PI * 2);
    ctx.fill();

    // olho vermelho no centro (estilo vídeo)
    ctx.fillStyle = "rgba(231, 76, 60, 0.85)";
    ctx.beginPath();
    ctx.arc(36, 28, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Balde de pipoca. */
function makePopcorn(scene: Phaser.Scene) {
  canvasTex(scene, "enemy_pop", 64, 72, (ctx) => {
    // balde listrado
    ctx.fillStyle = "#f5f5f5";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 28);
    ctx.lineTo(8, 64);
    ctx.lineTo(56, 64);
    ctx.lineTo(52, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // listras vermelhas
    ctx.fillStyle = "#e74c3c";
    for (let i = 0; i < 5; i++) {
      const x0 = 12 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x0, 28);
      ctx.lineTo(x0 - 2, 64);
      ctx.lineTo(x0 + 4, 64);
      ctx.lineTo(x0 + 6, 28);
      ctx.closePath();
      ctx.fill();
    }
    // recorta listras dentro do balde (borda de novo)
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, 28);
    ctx.lineTo(8, 64);
    ctx.lineTo(56, 64);
    ctx.lineTo(52, 28);
    ctx.closePath();
    ctx.stroke();

    // pipocas no topo
    const pops = [
      [20, 22, 9],
      [32, 16, 11],
      [44, 22, 9],
      [26, 12, 7],
      [38, 12, 8]
    ];
    pops.forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, r);
      g.addColorStop(0, "#fff8dc");
      g.addColorStop(1, "#f4d03f");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#d4ac0d";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // olhos
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(24, 42, 6, 0, Math.PI * 2);
    ctx.arc(40, 42, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(25, 43, 2.5, 0, Math.PI * 2);
    ctx.arc(41, 43, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // bracinhos
    ctx.fillStyle = "#f4d03f";
    ctx.strokeStyle = "#d4ac0d";
    ctx.beginPath();
    ctx.ellipse(6, 48, 6, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(58, 48, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

/** Grão de pipoca com um olho. */
function makePopKernel(scene: Phaser.Scene) {
  canvasTex(scene, "enemy_kernel", 36, 36, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 2, 18, 18, 14);
    g.addColorStop(0, "#fff8dc");
    g.addColorStop(1, "#f4d03f");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#d4ac0d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(18, 18, 14, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#222";
    ctx.beginPath();
    ctx.arc(18, 17, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(18, 18, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(16, 15, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeShadow(scene: Phaser.Scene) {
  canvasTex(scene, "shadow", 40, 16, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(20, 8, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeTargetRing(scene: Phaser.Scene) {
  canvasTex(scene, "target_ring", 48, 48, (ctx) => {
    ctx.strokeStyle = "rgba(0, 230, 255, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 230, 255, 0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function makeBullets(scene: Phaser.Scene) {
  const bullets: [string, string, string][] = [
    ["bullet_player", "#85c1e9", "#d6eaf8"],
    ["bullet_enemy", "#e74c3c", "#f5b7b1"],
    ["bullet_dark", "#8e44ad", "#d2b4de"],
    ["bullet_fire", "#e67e22", "#fdebd0"],
    ["bullet_thunder", "#f1c40f", "#fcf3cf"]
  ];
  bullets.forEach(([key, c1, c2]) => {
    canvasTex(scene, key, 16, 16, (ctx) => {
      const g = ctx.createRadialGradient(6, 6, 1, 8, 8, 7);
      g.addColorStop(0, c2);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(6, 6, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // anel vermelho inimigo (projétil estilo vídeo)
  canvasTex(scene, "bullet_ring", 18, 18, (ctx) => {
    ctx.strokeStyle = "#ff3b3b";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(9, 9, 5, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function makeBlock(scene: Phaser.Scene) {
  canvasTex(scene, "block", 44, 44, (ctx) => {
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
}

function makeElevator(scene: Phaser.Scene) {
  canvasTex(scene, "elevator", 80, 56, (ctx) => {
    ctx.fillStyle = "#5d6d7e";
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 2;
    roundRect(ctx, 4, 4, 72, 48, 4);
    ctx.fill();
    ctx.stroke();

    const light = ctx.createLinearGradient(16, 10, 64, 46);
    light.addColorStop(0, "#fff3a0");
    light.addColorStop(1, "#f1c40f");
    ctx.fillStyle = light;
    roundRect(ctx, 16, 10, 48, 36, 3);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    roundRect(ctx, 22, 14, 20, 28, 2);
    ctx.fill();
  });
}

function makeCoin(scene: Phaser.Scene) {
  canvasTex(scene, "coin", 28, 28, (ctx) => {
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
    ctx.fillStyle = "#b7950b";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 14, 15);
  });
}

function makeHpPip(scene: Phaser.Scene) {
  canvasTex(scene, "hp_pip", 16, 12, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 12);
    g.addColorStop(0, "#58d68d");
    g.addColorStop(1, "#1e8449");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#145a32";
    ctx.lineWidth = 1;
    roundRect(ctx, 1, 1, 14, 10, 2);
    ctx.fill();
    ctx.stroke();
  });
}
