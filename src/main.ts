import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { EquipScene } from "./scenes/EquipScene";
import { GameScene } from "./scenes/GameScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { PrepRoomScene } from "./scenes/PrepRoomScene";
import { SkillSelectScene } from "./scenes/SkillSelectScene";

const WIDTH = 390;
const HEIGHT = 700;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#1a1028",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, LobbyScene, EquipScene, GameScene, SkillSelectScene, PrepRoomScene],
  input: {
    activePointers: 3
  }
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
