import Phaser from "phaser";
import { facingFromVector, playerAnimKey, type Facing } from "./createAnims";

const BASE_SCALE = 2.2;

/**
 * Movimento estilo Wizard Legend / Archero:
 * idle respira (frames do pack), walk no deslocamento normal,
 * run só com stick forte; sombra no chão com squash.
 */
export function updatePlayerMotion(opts: {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow?: Phaser.GameObjects.Image | null;
  velocity: Phaser.Math.Vector2;
  facing: Facing;
  speed: number;
  timeMs: number;
  lockAnim?: boolean;
  baseScale?: number;
}): Facing {
  const { sprite, shadow, velocity, speed, timeMs, lockAnim } = opts;
  const baseScale = opts.baseScale ?? BASE_SCALE;
  let facing = opts.facing;

  const moving = velocity.lengthSq() > 0.012;
  const body = sprite.body as Phaser.Physics.Arcade.Body;

  if (moving) {
    body.setVelocity(velocity.x * speed, velocity.y * speed);
    facing = facingFromVector(velocity.x, velocity.y, facing);

    // Walk = bob natural do sheet; run só no dash do stick
    const strong = velocity.length() > 0.78;
    const state = strong ? "run" : "walk";
    const key = playerAnimKey(state, facing);
    if (!lockAnim && sprite.anims.currentAnim?.key !== key) {
      sprite.play(key);
    }
  } else {
    body.setVelocity(0, 0);
    const key = playerAnimKey("idle", facing);
    if (!lockAnim && sprite.anims.currentAnim?.key !== key) {
      sprite.play(key);
    }
  }

  // Squash/stretch leve (sem rotação — não atrapalha a leitura da barba)
  const period = moving ? 140 : 300;
  const amp = moving ? 0.035 : 0.045;
  const wave = Math.sin(timeMs / period);
  const sy = 1 + wave * amp;
  const sx = 1 - wave * amp * 0.55;
  sprite.setScale(baseScale * sx, baseScale * sy);
  sprite.setRotation(0);

  if (shadow) {
    shadow.setPosition(sprite.x, sprite.y + 26);
    const squash = 1 - Math.abs(wave) * 0.08;
    shadow.setScale(squash * (baseScale / BASE_SCALE), 0.9);
    shadow.setAlpha(0.42 + Math.abs(wave) * 0.04);
  }

  return facing;
}

/** Frame rates do pack: idle mais lento (respiração), walk legível. */
export function tuneWizardAnimRates(scene: Phaser.Scene) {
  for (const dir of ["down", "up", "right", "left"] as const) {
    const idle = scene.anims.get(`player-idle-${dir}`);
    const walk = scene.anims.get(`player-walk-${dir}`);
    const run = scene.anims.get(`player-run-${dir}`);
    if (idle) idle.frameRate = 5;
    if (walk) walk.frameRate = 9;
    if (run) run.frameRate = 12;
  }
}
