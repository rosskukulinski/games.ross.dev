import Phaser from 'phaser';

export default class Building extends Phaser.GameObjects.Container {
  constructor(scene, x, y, buildingData) {
    super(scene, x, y);

    this.scene = scene;
    this.buildingData = buildingData;
    this.isInteractive = true;

    this.createBuilding();

    scene.add.existing(this);
  }

  createBuilding() {
    // Building sprite
    this.sprite = this.scene.add.image(0, 0, this.buildingData.texture);
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Name label
    this.label = this.scene.add.text(0, -this.sprite.height - 5, this.buildingData.name, {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 }
    });
    this.label.setOrigin(0.5, 1);
    this.add(this.label);

    // Make interactive
    this.setSize(this.sprite.width, this.sprite.height);
    // The sprite hangs ABOVE the container origin (origin 0.5, 1), but a
    // container's default hit area is centred on it — which made the bottom
    // half of the road in front a hidden "enter" button and the top half of
    // the building dead. Line the hit area up with the drawn sprite (plus the
    // name label above it).
    const w = this.sprite.width;
    const h = this.sprite.height;
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, -h / 2 - 22, w, h + 22),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    // Hover effects
    this.on('pointerover', this.onPointerOver, this);
    this.on('pointerout', this.onPointerOut, this);
    this.on('pointerdown', this.onPointerDown, this);
    this.on('pointerup', this.onPointerUp, this);
  }

  onPointerOver() {
    if (!this.isInteractive) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 100,
      ease: 'Quad.easeOut'
    });
    this.label.setVisible(true);
  }

  onPointerOut() {
    if (!this.isInteractive) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Quad.easeOut'
    });
  }

  onPointerDown() {
    if (!this.isInteractive) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
      ease: 'Quad.easeOut'
    });
  }

  onPointerUp() {
    if (!this.isInteractive) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.emit('building-selected', this.buildingData);
      }
    });
  }

  setInteractiveState(enabled) {
    this.isInteractive = enabled;
    if (enabled) {
      this.setAlpha(1);
    } else {
      this.setAlpha(0.7);
    }
  }

  getBuildingData() {
    return this.buildingData;
  }

  // Get the position for a character to stand in front of the building
  getEntrancePosition() {
    return {
      x: this.x,
      y: this.y + 20
    };
  }
}
