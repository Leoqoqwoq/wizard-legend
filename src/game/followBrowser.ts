import Phaser from "phaser";

let lastW = 0;
let lastH = 0;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let restarting = false;

/**
 * Acompanha o tamanho do navegador.
 * Importante: NÃO destruir joystick antes do restart — isso travava o personagem.
 */
export function followBrowserFrame(
  scene: Phaser.Scene,
  cleanup?: () => void
) {
  lastW = Math.round(scene.scale.width);
  lastH = Math.round(scene.scale.height);
  restarting = false;

  const onResize = (gameSize: Phaser.Structs.Size) => {
    const w = Math.round(gameSize.width);
    const h = Math.round(gameSize.height);
    if (restarting) return;
    if (Math.abs(w - lastW) < 8 && Math.abs(h - lastH) < 8) return;

    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!scene.sys.settings.active || restarting) return;
      lastW = w;
      lastH = h;
      restarting = true;
      // Só reinicia a cena; cleanup roda no shutdown
      scene.scene.restart();
    }, 180);
  };

  scene.scale.on("resize", onResize);

  const onShutdown = () => {
    scene.scale.off("resize", onResize);
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    try {
      cleanup?.();
    } catch {
      /* ignore */
    }
    restarting = false;
  };

  scene.events.once("shutdown", onShutdown);
  scene.events.once("destroy", onShutdown);
}
