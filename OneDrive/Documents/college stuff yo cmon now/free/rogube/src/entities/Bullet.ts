import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Image {
    private lifespan: number = 2000; // milliseconds
    private spawnTime: number;
    private isHoming: boolean = false;
    private homingStrength: number = 0.08; // How strongly bullets turn toward enemies
    private speed: number;
    private enemyGroup: Phaser.GameObjects.Group | null = null;
    private hasLifespan: boolean = true; // Boss bullets won't have lifespan

    constructor(scene: Phaser.Scene, x: number, y: number, velocityX: number, velocityY: number, hasLifespan: boolean = true) {
        super(scene, x, y, 'bullet');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setDisplaySize(8, 8);
        
        // Store speed for homing calculations
        this.speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        
        // Set physics body size
        (this.body as Phaser.Physics.Arcade.Body).setSize(8, 8);
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(velocityX, velocityY);
        
        this.spawnTime = scene.time.now;
        this.hasLifespan = hasLifespan;
    }

    setHoming(enabled: boolean, enemyGroup: Phaser.GameObjects.Group | null = null) {
        this.isHoming = enabled;
        this.enemyGroup = enemyGroup;
    }

    update() {
        // Homing logic - seek nearest enemy
        if (this.isHoming && this.enemyGroup && this.active) {
            const enemies = this.enemyGroup.getChildren();
            let closestEnemy: Phaser.GameObjects.GameObject | null = null;
            let closestDistance = Infinity;

            // Find closest enemy
            for (const enemy of enemies) {
                if (enemy.active) {
                    const enemySprite = enemy as Phaser.Physics.Arcade.Image;
                    const dx = enemySprite.x - this.x;
                    const dy = enemySprite.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }
            }

            // Steer toward closest enemy
            if (closestEnemy && closestDistance < 400) { // Only home within range
                const enemySprite = closestEnemy as Phaser.Physics.Arcade.Image;
                const body = this.body as Phaser.Physics.Arcade.Body;
                
                // Get current velocity direction
                const currentVelX = body.velocity.x;
                const currentVelY = body.velocity.y;
                
                // Get direction to enemy
                const dx = enemySprite.x - this.x;
                const dy = enemySprite.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    const targetVelX = (dx / distance) * this.speed;
                    const targetVelY = (dy / distance) * this.speed;
                    
                    // Interpolate toward target direction
                    const newVelX = currentVelX + (targetVelX - currentVelX) * this.homingStrength;
                    const newVelY = currentVelY + (targetVelY - currentVelY) * this.homingStrength;
                    
                    // Normalize to maintain speed
                    const newSpeed = Math.sqrt(newVelX * newVelX + newVelY * newVelY);
                    if (newSpeed > 0) {
                        body.setVelocity(
                            (newVelX / newSpeed) * this.speed,
                            (newVelY / newSpeed) * this.speed
                        );
                    }
                }
            }
        }

        // Destroy bullet after lifespan (only if hasLifespan is true)
        if (this.hasLifespan && this.scene.time.now - this.spawnTime > this.lifespan) {
            this.destroy();
        }

        // Destroy if out of bounds (use map dimensions: 3840x2160)
        if (this.x < -50 || this.x > 3890 || this.y < -50 || this.y > 2210) {
            this.destroy();
        }
    }

    destroy() {
        super.destroy();
    }
}
