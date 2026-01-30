import Phaser from 'phaser';

export default class PowerCell extends Phaser.Physics.Arcade.Image {
    private lifespan: number = 10000; // milliseconds before disappearing
    private spawnTime: number;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'powerCell');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setDisplaySize(15, 15);
        
        // Set physics body size
        (this.body as Phaser.Physics.Arcade.Body).setSize(15, 15);
        
        this.spawnTime = scene.time.now;
        
        // Add a gentle floating animation
        scene.tweens.add({
            targets: this,
            y: this.y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    update() {
        // Destroy if too old
        if (this.scene.time.now - this.spawnTime > this.lifespan) {
            this.destroy();
        }
    }

    destroy() {
        super.destroy();
    }
}
