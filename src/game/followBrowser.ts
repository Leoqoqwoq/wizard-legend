import Phaser from "phaser";

/**
 * Acompanha o tamanho da janela SEM reiniciar a cena.
 * (scene.restart no resize destruía o joystick e travava o mago.)
 */
export function followBrowserFrame(
  scene: Phaser.Scene,
  cleanup?: () => void,
  onResize?: (width: number, height: number) => void
) {
  let lastW = Math.round(scene.scale.width);
  let lastH = Math.round(scene.scale.height);

  const handle = (gameSize: Phaser.Structs.Size) => {
    if (!scene.sys.isActive()) return;
    if (!scene.game.registry.get("wlBootReady")) return;

    const w = Math.round(gameSize.width);
    const h = Math.round(gameSize.height);
    if (Math.abs(w - lastW) < 4 && Math.abs(h - lastH) < 4) return;
    lastW = w;
    lastH = h;
    try {
      onResize?.(w, h);
    } catch {
      /* ignore */
    }
  };

  scene.scale.on("resize", handle);

  const detach = () => {
    scene.scale.off("resize", handle);
    try {
      cleanup?.();
    } catch {
      /* ignore */
    }
  };

  scene.events.once("shutdown", detach);
  scene.events.once("destroy", detach);
}
