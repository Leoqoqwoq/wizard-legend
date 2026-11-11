import Phaser from "phaser";

/**
 * Antes reiniciava a cena no resize e isso destruía o joystick / travava o mago.
 * Agora só acompanha o canvas — o layout já usa scale.width/height no create.
 */
export function followBrowserFrame(
  _scene: Phaser.Scene,
  _cleanup?: () => void
) {
  // no-op intencional: resize é tratado em main.ts via Scale.RESIZE
}
