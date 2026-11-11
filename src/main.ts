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
  // NONE no Boot: Scale.RESIZE no meio do load mata o loader (mago “congelado”)
  scale: {
    mode: Phaser.Scale.NONE,
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

/** Phaser não deve ouvir resize até o Boot terminar. */
try {
  game.scale.stopListeners();
} catch {
  /* ignore */
}

let bootReady = false;

function applyLiveResize() {
  const { width, height } = viewport();
  if (
    Math.abs(width - game.scale.width) > 2 ||
    Math.abs(height - game.scale.height) > 2
  ) {
    game.scale.resize(width, height);
  }
  try {
    game.loop.wake(true);
  } catch {
    /* ignore */
  }
}

game.events.once("wl-boot-ready", () => {
  bootReady = true;
  try {
    // Liga resize automático só depois dos assets
    (game.scale as Phaser.Scale.ScaleManager).scaleMode = Phaser.Scale.RESIZE;
    game.scale.startListeners();
  } catch {
    /* ignore */
  }
  applyLiveResize();
});

window.addEventListener("resize", () => {
  if (!bootReady) return;
  applyLiveResize();
});

const wakeLoop = () => {
  try {
    if (!game.loop.running) game.loop.start();
    game.loop.wake(true);
  } catch {
    /* ignore */
  }
};
window.addEventListener("focus", wakeLoop);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) wakeLoop();
});

/** Recupera loader morto (lista pendente sem download em voo). */
function kickDeadLoader() {
  const boot = game.scene.getScene("Boot") as Phaser.Scene | null;
  const loader = boot?.load;
  if (!loader || !loader.isLoading()) return false;
  const listSize =
    typeof (loader.list as { size?: number }).size === "number"
      ? (loader.list as { size: number }).size
      : 0;
  const inflightSize =
    typeof (loader.inflight as { size?: number }).size === "number"
      ? (loader.inflight as { size: number }).size
      : 0;
  if (listSize > 0 && inflightSize === 0) {
    console.warn("[WL] loader morto — retomando", listSize);
    try {
      loader.start();
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}

const bootWatch = window.setInterval(() => {
  if (bootReady) {
    window.clearInterval(bootWatch);
    return;
  }
  kickDeadLoader();
}, 500);

/** Se ainda preso após 5s, reinicia o Boot do zero. */
window.setTimeout(() => {
  if (bootReady) return;
  console.warn("[WL] Boot preso — reiniciando cena");
  try {
    game.scene.stop("Boot");
  } catch {
    /* ignore */
  }
  game.scene.start("Boot");
}, 5000);
