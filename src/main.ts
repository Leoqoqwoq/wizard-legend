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

/** Canvas sempre igual ao quadro do navegador. */
window.addEventListener("resize", () => {
  const { width, height } = viewport();
  game.scale.resize(width, height);
});
