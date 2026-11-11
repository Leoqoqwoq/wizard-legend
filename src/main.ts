import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { EquipScene } from "./scenes/EquipScene";
import { GameScene } from "./scenes/GameScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { PrepRoomScene } from "./scenes/PrepRoomScene";
import { SkillSelectScene } from "./scenes/SkillSelectScene";

/** Tamanho atual da janela do navegador. */
function viewport() {
  return {
    width: Math.max(320, Math.floor(window.innerWidth)),
    height: Math.max(480, Math.floor(window.innerHeight))
  };
}

const vp = viewport();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: vp.width,
  height: vp.height,
  backgroundColor: "#1a1028",
  antialias: true,
  roundPixels: false,
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: "high-performance"
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: vp.width,
    height: vp.height
  },
  scene: [BootScene, LobbyScene, EquipScene, GameScene, SkillSelectScene, PrepRoomScene],
  input: {
    activePointers: 3
  }
};

const game = new Phaser.Game(config);

declare global {
  interface Window {
    __WL_GAME__?: Phaser.Game;
  }
}
window.__WL_GAME__ = game;

/**
 * Resize só depois do Boot terminar.
 * Redimensionar durante o load trava o loader do Phaser (mago “congelado”).
 */
let bootReady = false;
game.events.once("wl-boot-ready", () => {
  bootReady = true;
});

window.addEventListener("resize", () => {
  if (!bootReady) return;
  const { width, height } = viewport();
  if (
    Math.abs(width - game.scale.width) > 2 ||
    Math.abs(height - game.scale.height) > 2
  ) {
    game.scale.resize(width, height);
  }
});

/** Se o Boot ficar preso no load (cena inativa), reinicia. */
window.setTimeout(() => {
  if (bootReady) return;
  const boot = game.scene.getScene("Boot");
  const loading = boot?.load?.isLoading?.();
  if (loading || !game.scene.isActive("Lobby")) {
    console.warn("[WL] Boot preso — reiniciando");
    game.scene.start("Boot");
  }
}, 4000);
