import Phaser from "phaser";

/** Joystick virtual estilo Wizard Legend / Archero. */
export class Joystick {
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private value = new Phaser.Math.Vector2();
  private readonly radius = 70;
  private active = false;

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.scale;
    this.base = scene.add
      .circle(width / 2, height - 110, this.radius, 0xffffff, 0.12)
      .setScrollFactor(0)
      .setDepth(1000)
      .setStrokeStyle(2, 0xffffff, 0.25);
    this.thumb = scene.add
      .circle(width / 2, height - 110, 28, 0xffffff, 0.28)
      .setScrollFactor(0)
      .setDepth(1001);

    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.pointerId !== null) return;
    // Só metade inferior da tela controla movimento
    if (p.y < this.scene.scale.height * 0.35) return;
    this.pointerId = p.id;
    this.active = true;
    this.origin.set(p.x, p.y);
    this.base.setPosition(p.x, p.y).setAlpha(0.35);
    this.thumb.setPosition(p.x, p.y).setAlpha(0.5);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (!this.active || p.id !== this.pointerId) return;
    const dx = p.x - this.origin.x;
    const dy = p.y - this.origin.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const clamped = Math.min(len, this.radius);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    this.thumb.setPosition(this.origin.x + nx, this.origin.y + ny);
    this.value.set(nx / this.radius, ny / this.radius);
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    this.active = false;
    this.value.set(0, 0);
    const { width, height } = this.scene.scale;
    this.base.setPosition(width / 2, height - 110).setAlpha(0.12);
    this.thumb.setPosition(width / 2, height - 110).setAlpha(0.28);
  }

  /** Vetor normalizado -1..1. Magnitude 0 = parado (pode atacar). */
  getVector() {
    return this.value;
  }

  isMoving() {
    return this.value.lengthSq() > 0.01;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onDown, this);
    this.scene.input.off("pointermove", this.onMove, this);
    this.scene.input.off("pointerup", this.onUp, this);
    this.scene.input.off("pointerupoutside", this.onUp, this);
    this.base.destroy();
    this.thumb.destroy();
  }
}
