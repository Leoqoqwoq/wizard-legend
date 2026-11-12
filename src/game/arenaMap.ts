import Phaser from "phaser";
import {
  ULTRA_BOSS,
  ULTRA_BOSS_FLOOR,
  kingdomForFloor,
  type KingdomId
} from "./kingdoms";
import { isBossFloor, type RunMode } from "./RunState";

const TS = 32;

export type ArenaLayoutId =
  | "corners"
  | "cross"
  | "lanes"
  | "arena_open"
  | "gauntlet";

/** Escurece uma cor RGB hex (0xRRGGBB). */
export function darkenColor(hex: number, factor = 0.22): number {
  const r = Math.floor(((hex >> 16) & 0xff) * factor);
  const g = Math.floor(((hex >> 8) & 0xff) * factor);
  const b = Math.floor((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function mixTint(base: number, accent: number, t: number): number {
  const br = (base >> 16) & 0xff;
  const bg = (base >> 8) & 0xff;
  const bb = base & 0xff;
  const ar = (accent >> 16) & 0xff;
  const ag = (accent >> 8) & 0xff;
  const ab = accent & 0xff;
  const r = Math.round(br + (ar - br) * t);
  const g = Math.round(bg + (ag - bg) * t);
  const b = Math.round(bb + (ab - bb) * t);
  return (r << 16) | (g << 8) | b;
}

function themeOf(
  floor: number,
  endless: boolean
): { id: KingdomId | "ultra"; name: string; accent: number; floorTint: number } {
  if (!endless && floor >= ULTRA_BOSS_FLOOR) {
    return {
      id: "ultra",
      name: ULTRA_BOSS.kingdomName,
      accent: ULTRA_BOSS.accent,
      floorTint: 0xfff3cd
    };
  }
  const k = kingdomForFloor(floor, endless);
  return {
    id: k.id,
    name: k.name,
    accent: k.accent,
    floorTint: k.floorTint
  };
}

/** Escolha estável de layout por andar. Boss/ultra → arena_open. */
export function pickArenaLayout(
  floor: number,
  mode: RunMode
): ArenaLayoutId {
  if (isBossFloor(floor)) return "arena_open";

  const endless = mode === "endless";
  const presets: ArenaLayoutId[] = [
    "corners",
    "cross",
    "lanes",
    "gauntlet",
    "corners",
    "lanes",
    "cross",
    "gauntlet",
    "lanes"
  ];
  if (endless && floor > 15) {
    return presets[(floor * 7 + 3) % presets.length] ?? "gauntlet";
  }
  if (floor <= 3) return "corners";
  if (floor <= 6) return floor % 2 === 0 ? "cross" : "corners";
  return presets[(floor * 5 + floor) % presets.length] ?? "corners";
}

const MAX_OBSTACLES = 4;

function obstaclePoints(
  room: Phaser.Geom.Rectangle,
  layout: ArenaLayoutId,
  floor: number
): { x: number; y: number }[] {
  const r = room;
  const cx = r.centerX;
  const cy = r.centerY;
  const left = r.x + 72;
  const right = r.right - 72;
  const top = r.y + 80;
  const bottom = r.bottom - 96;

  let pts: { x: number; y: number }[];
  switch (layout) {
    case "arena_open":
      pts = [
        { x: left, y: top },
        { x: right, y: top }
      ];
      break;
    case "corners":
      pts = [
        { x: left, y: top },
        { x: right, y: top },
        { x: left, y: bottom },
        { x: right, y: bottom }
      ];
      break;
    case "cross":
      pts = [
        { x: cx, y: top + 20 },
        { x: cx, y: bottom - 20 },
        { x: left + 20, y: cy },
        { x: right - 20, y: cy }
      ];
      break;
    case "lanes":
      // 4 só — evita mapa entulhado
      pts =
        floor % 2 === 0
          ? [
              { x: left, y: top + 40 },
              { x: left, y: bottom - 40 },
              { x: right, y: top + 40 },
              { x: right, y: bottom - 40 }
            ]
          : [
              { x: left, y: cy },
              { x: right, y: cy },
              { x: cx - 56, y: top + 30 },
              { x: cx + 56, y: bottom - 30 }
            ];
      break;
    case "gauntlet":
      pts = [
        { x: left + 30, y: top + 30 },
        { x: right - 30, y: bottom - 30 },
        { x: right - 40, y: top + 50 },
        { x: left + 40, y: bottom - 50 }
      ];
      break;
    default:
      pts = [
        { x: left, y: top },
        { x: right, y: top },
        { x: left, y: bottom },
        { x: right, y: bottom }
      ];
  }
  return pts.slice(0, MAX_OBSTACLES);
}

function placeDecor(
  scene: Phaser.Scene,
  room: Phaser.Geom.Rectangle,
  id: KingdomId | "ultra",
  accent: number
) {
  const r = room;
  const wallY = r.y - TS / 2;

  const deco = (
    x: number,
    y: number,
    key: string,
    w: number,
    h: number,
    depth = 3,
    tint?: number
  ) => {
    const img = scene.add.image(x, y, key).setDisplaySize(w, h).setDepth(depth);
    if (tint !== undefined) img.setTint(tint);
    return img;
  };

  switch (id) {
    case "doce":
      deco(r.x + 40, wallY + 36, "tile_chest_closed", 28, 28, 3, accent);
      deco(r.right - 40, wallY + 36, "tile_chest_closed", 28, 28, 3, accent);
      deco(r.x + 56, r.bottom - 20, "tile_box", 24, 24, 3, 0xffc8e8);
      deco(r.right - 56, r.bottom - 20, "tile_box", 24, 24, 3, 0xffeaa7);
      break;
    case "animal":
      deco(r.x + 36, r.y + 50, "tile_column", 28, 72, 3, accent);
      deco(r.right - 36, r.y + 50, "tile_column", 28, 72, 3, accent);
      deco(r.x + 36, r.bottom - 40, "tile_column_wall", 28, 48, 3);
      deco(r.right - 36, r.bottom - 40, "tile_column_wall", 28, 48, 3);
      break;
    case "gelo":
      // já reforçado no chão; só cristais-caixa claros
      deco(r.x + 44, wallY + 40, "tile_box", 22, 22, 3, 0xaed6f1);
      deco(r.right - 44, wallY + 40, "tile_box", 22, 22, 3, 0x85c1e9);
      deco(cxSafe(r, -70), r.bottom - 18, "tile_boxes_stacked", 26, 32, 3, 0xd6eaf8);
      deco(cxSafe(r, 70), r.bottom - 18, "tile_boxes_stacked", 26, 32, 3, 0xd6eaf8);
      break;
    case "trovao":
      deco(r.x + 48, wallY - 10, "tile_wall_flag_red", TS, TS, 3, accent);
      deco(r.right - 48, wallY - 10, "tile_wall_flag_blue", TS, TS, 3, accent);
      deco(r.centerX - 64, wallY + 8, "tile_wall_flag_red", 28, 28, 3, 0xf7dc6f);
      deco(r.centerX + 64, wallY + 8, "tile_wall_flag_blue", 28, 28, 3, 0xf4d03f);
      break;
    case "sombrio":
      deco(r.x + 40, wallY + 36, "tile_column_wall", 30, 56, 3, 0x5b2c6f);
      deco(r.right - 40, wallY + 36, "tile_column_wall", 30, 56, 3, 0x5b2c6f);
      deco(r.centerX, wallY + 28, "tile_chest_closed", 26, 26, 3, 0x9b59b6);
      break;
    case "inferno":
      deco(r.x + 44, wallY + 36, "tile_boxes_stacked", 28, 36, 3, 0xe67e22);
      deco(r.right - 44, wallY + 36, "tile_boxes_stacked", 28, 36, 3, 0xc0392b);
      deco(r.x + 50, r.bottom - 22, "tile_box", 24, 24, 3, 0xd35400);
      deco(r.right - 50, r.bottom - 22, "tile_box", 24, 24, 3, 0xe74c3c);
      break;
    case "ultra":
      deco(r.x + 48, wallY - 8, "tile_wall_flag_red", TS, TS, 3, 0xffd700);
      deco(r.right - 48, wallY - 8, "tile_wall_flag_blue", TS, TS, 3, 0xffd700);
      deco(r.centerX - 80, wallY + 32, "tile_column", 32, 80, 3, 0xffd700);
      deco(r.centerX + 80, wallY + 32, "tile_column", 32, 80, 3, 0xffd700);
      break;
  }
}

function cxSafe(r: Phaser.Geom.Rectangle, dx: number) {
  return Phaser.Math.Clamp(r.centerX + dx, r.x + 40, r.right - 40);
}

/**
 * Desenha void, chão, paredes, bandeiras, rótulo e props temáticos.
 */
export function buildArenaVisual(
  scene: Phaser.Scene,
  room: Phaser.Geom.Rectangle,
  floor: number,
  endless: boolean
) {
  const theme = themeOf(floor, endless);
  const r = room;
  const voidColor =
    theme.id === "sombrio"
      ? 0x07040e
      : theme.id === "ultra"
        ? 0x1a1200
        : darkenColor(theme.accent, theme.id === "gelo" ? 0.18 : 0.16);

  const g = scene.add.graphics().setDepth(0);
  g.fillStyle(voidColor, 1);
  g.fillRect(0, 0, scene.scale.width, scene.scale.height);

  // Halo suave atrás da sala
  g.fillStyle(theme.accent, 0.06);
  g.fillRoundedRect(r.x - 10, r.y - 14, r.width + 20, r.height + 28, 12);

  const floors =
    theme.id === "gelo"
      ? ["tile_floor_light", "tile_floor_plain", "tile_floor_light", "tile_floor_edge_1"]
      : theme.id === "sombrio"
        ? ["tile_floor_plain", "tile_floor_edge_2", "tile_floor_edge_3", "tile_floor_plain"]
        : ["tile_floor_plain", "tile_floor_light", "tile_floor_edge_1", "tile_floor_edge_2"];

  for (let y = r.y; y < r.bottom; y += TS) {
    for (let x = r.x; x < r.right; x += TS) {
      const cx = Math.floor((x - r.x) / TS);
      const cy = Math.floor((y - r.y) / TS);
      const key =
        floors[(cx * 3 + cy * 5 + floor) % floors.length] ?? floors[0];
      const tile = scene.add
        .image(x + TS / 2, y + TS / 2, key)
        .setDisplaySize(TS, TS)
        .setDepth(0);
      const edge = cx === 0 || cy === 0 || x + TS >= r.right || y + TS >= r.bottom;
      // Tint leve — preserva o look Kenney Tiny Dungeon
      const tintAmt = edge ? 0.28 : 0.12 + ((cx + cy + floor) % 3) * 0.04;
      tile.setTint(mixTint(0xffffff, theme.floorTint, tintAmt));
    }
  }

  const wallTint = mixTint(0xffffff, theme.accent, 0.22);
  const wallY = r.y - TS / 2;
  for (let x = r.x; x < r.right; x += TS) {
    const isLeft = x <= r.x;
    const isRight = x + TS >= r.right;
    const key = isLeft
      ? "tile_Wall_front_left"
      : isRight
        ? "tile_Wall_front_right"
        : "tile_Wall_front";
    scene.add
      .image(x + TS / 2, wallY, key)
      .setDisplaySize(TS, TS)
      .setDepth(2)
      .setTint(wallTint);
  }
  for (let y = r.y; y < r.bottom; y += TS) {
    scene.add
      .image(r.x - TS / 2, y + TS / 2, "tile_wall_center")
      .setDisplaySize(TS, TS)
      .setDepth(2)
      .setTint(wallTint);
    scene.add
      .image(r.right + TS / 2, y + TS / 2, "tile_Wall_inner_e")
      .setDisplaySize(TS, TS)
      .setDepth(2)
      .setTint(wallTint);
  }
  for (let x = r.x; x < r.right; x += TS) {
    scene.add
      .image(x + TS / 2, r.bottom + TS / 2, "tile_wall_center")
      .setDisplaySize(TS, TS)
      .setDepth(2)
      .setTint(wallTint);
  }

  // Bandeiras padrão (reinos sem override forte)
  if (theme.id !== "trovao" && theme.id !== "ultra") {
    scene.add
      .image(r.x + 48, wallY - 8, "tile_wall_flag_red")
      .setDisplaySize(TS, TS)
      .setDepth(3)
      .setTint(theme.accent);
    scene.add
      .image(r.right - 48, wallY - 8, "tile_wall_flag_blue")
      .setDisplaySize(TS, TS)
      .setDepth(3)
      .setTint(mixTint(theme.accent, 0xffffff, 0.25));
  }

  placeDecor(scene, room, theme.id, theme.accent);

  const ultra = theme.id === "ultra";
  const floorLabel = ultra ? "ULTRA" : `${floor}`;
  scene.add
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
  scene.add
    .text(
      r.centerX,
      r.centerY + 58,
      endless ? `${theme.name} · ∞` : theme.name,
      {
        fontFamily: "Arial Black, Arial",
        fontSize: "16px",
        color: "#ffffff"
      }
    )
    .setOrigin(0.5)
    .setAlpha(0.22)
    .setDepth(1)
    .setTint(theme.accent);

  return theme;
}

/**
 * Spawna obstáculos com colisão conforme o preset do andar.
 */
export function layoutObstacles(
  _scene: Phaser.Scene,
  blocks: Phaser.Physics.Arcade.StaticGroup,
  room: Phaser.Geom.Rectangle,
  floor: number,
  mode: RunMode
): ArenaLayoutId {
  const layout = isBossFloor(floor) ? "arena_open" : pickArenaLayout(floor, mode);
  const points = obstaclePoints(room, layout, floor);
  const accent = themeOf(floor, mode === "endless").accent;

  const propKeys = ["tile_box", "tile_boxes_stacked", "tile_chest_closed", "tile_column"] as const;
  points.forEach(({ x, y }, i) => {
    const key = propKeys[i % propKeys.length] ?? "tile_box";
    const b = blocks.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
    b.setDisplaySize(40, 40);
    b.refreshBody();
    b.setDepth(5);
    b.setTint(mixTint(0xffffff, accent, 0.08));
  });

  return layout;
}
