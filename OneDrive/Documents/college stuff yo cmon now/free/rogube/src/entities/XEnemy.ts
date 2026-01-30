import Phaser from 'phaser';
import Player from './Player';
import Bullet from './Bullet';

export default class XEnemy extends Phaser.Physics.Arcade.Image {
    private speed: number = 70; // Slightly slower than base enemy (80)
    private health: number = 3;
    private maxHealth: number = 3;
    private knockbackTime: number = 0;
    private isChampion: boolean = false;
    private damageToPlayer: number = 1; // Hearts of damage dealt to player
    private dropRateMultiplier: number = 1; // Multiplier for drop chances
    private lastHitBySword1: number = 0; // Timestamp of last hit by sword 1
    private lastHitBySword2: number = 0; // Timestamp of last hit by sword 2
    private swordHitCooldown: number = 100; // Cooldown per sword (100ms)
    
    // Charging attack variables
    private isCharging: boolean = false;
    private chargeStartTime: number = 0;
    private chargeDuration: number = 1500; // 1.5 seconds to charge
    private chargeRange: number = 180; // Distance to start charging
    private attackCooldown: number = 2500; // 2.5 seconds between attacks
    private lastAttackTime: number = 0;
    private flashTween?: Phaser.Tweens.Tween;
    private originalTint: number = 0xFF1100;
    private chargeTint: number = 0xFFFF00; // Yellow for charging

    constructor(scene: Phaser.Scene, x: number, y: number, isChampion: boolean = false) {
        super(scene, x, y, 'xEnemy');
        
        this.isChampion = isChampion;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set pixel-perfect rendering
        const texture = scene.textures.get('xEnemy');
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Apply champion modifiers
        if (this.isChampion) {
            this.speed = 77; // 10% faster (70 * 1.1)
            this.maxHealth = 6; // 2x health (3 * 2)
            this.health = this.maxHealth;
            this.damageToPlayer = 2; // 2 hearts instead of 1
            this.dropRateMultiplier = 2; // Double drop rates
            this.originalTint = 0xDD00FF; // Bright purple for champions
            
            // 8x8 sprite scaled to 40x40 (5x scale) for champions
            this.setDisplaySize(40, 40);
        } else {
            // 8x8 sprite scaled to 24x24 (3x scale) for normal
            this.setDisplaySize(24, 24);
        }
        
        this.setOrigin(0.5, 0.5);
        
        // Set physics body size to match original sprite (8x8) for accurate collision
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 8);
        body.setCollideWorldBounds(true);
        
        // Set initial color
        this.updateColor();
    }
    
    public getDamageToPlayer(): number {
        return this.damageToPlayer;
    }
    
    public getDropRateMultiplier(): number {
        return this.dropRateMultiplier;
    }

    update(player: Player, _delta: number, enemyBullets: Phaser.GameObjects.Group) {
        // Don't move during knockback
        if (this.scene.time.now < this.knockbackTime) {
            return;
        }
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const currentTime = this.scene.time.now;

        // Check if we should start charging
        if (!this.isCharging && distance <= this.chargeRange && currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.startCharging();
        }

        // Handle charging state
        if (this.isCharging) {
            // Stop moving
            this.setVelocity(0, 0);
            
            // Check if charge is complete
            const chargeProgress = (currentTime - this.chargeStartTime) / this.chargeDuration;
            if (chargeProgress >= 1) {
                this.fireShotgun(player, enemyBullets);
            }
        } else {
            // Normal movement towards player
            if (distance > 0) {
                const velocityX = (dx / distance) * this.speed;
                const velocityY = (dy / distance) * this.speed;
                this.setVelocity(velocityX, velocityY);
            }
        }
    }

    private startCharging() {
        this.isCharging = true;
        this.chargeStartTime = this.scene.time.now;
        this.setVelocity(0, 0);
        
        // Create flashing effect that speeds up over time
        this.startFlashing();
    }

    private startFlashing() {
        // Stop any existing flash tween
        if (this.flashTween) {
            this.flashTween.destroy();
        }

        // Calculate flash intervals that speed up
        const flashCount = 8;
        const startInterval = 250; // Start slow (250ms)
        const endInterval = 50; // End fast (50ms)
        
        let currentFlash = 0;
        const flash = () => {
            if (!this.active || !this.isCharging) return;
            
            currentFlash++;
            const progress = currentFlash / flashCount;
            const interval = Phaser.Math.Linear(startInterval, endInterval, progress);
            
            // Toggle between charge color and original
            const isYellow = currentFlash % 2 === 1;
            this.setTint(isYellow ? this.chargeTint : this.originalTint);
            
            if (currentFlash < flashCount && this.isCharging) {
                this.scene.time.delayedCall(interval, flash);
            }
        };
        
        flash();
    }

    private fireShotgun(player: Player, enemyBullets: Phaser.GameObjects.Group) {
        // Calculate direction to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            // Calculate angle to player
            const baseAngle = Math.atan2(dy, dx);
            const spreadAngle = Math.PI / 8; // 22.5 degrees spread for each side
            
            // Fire 3 bullets in a spread
            const angles = [
                baseAngle - spreadAngle, // Left
                baseAngle,                // Center
                baseAngle + spreadAngle   // Right
            ];
            
            const bulletSpeed = 300;
            
            // Play enemy laser sound
            const volume = (this.scene as any).volumeEnemyLaser || 0.5;
            this.scene.sound.play('enemy_laser', { volume });
            
            angles.forEach(angle => {
                const velX = Math.cos(angle) * bulletSpeed;
                const velY = Math.sin(angle) * bulletSpeed;
                
                const bullet = new Bullet(
                    this.scene,
                    this.x,
                    this.y,
                    velX,
                    velY
                );
                // Tint bullets to match enemy type - pink/purple for champions, red for normal
                bullet.setTint(this.isChampion ? 0xDD00FF : 0xFF1100); // Purple for champions, red for normal
                bullet.setDepth(7);
                enemyBullets.add(bullet);
            });
        }

        // Reset charging state
        this.isCharging = false;
        this.lastAttackTime = this.scene.time.now;
        this.updateColor();
        
        // Stop flashing
        if (this.flashTween) {
            this.flashTween.destroy();
            this.flashTween = undefined;
        }
    }

    takeDamage(amount: number, onDeath?: (x: number, y: number) => void, knockbackX?: number, knockbackY?: number) {
        this.health -= amount;
        
        // Apply knockback if direction provided
        if (knockbackX !== undefined && knockbackY !== undefined) {
            const knockbackDuration = 100;
            const body = this.body as Phaser.Physics.Arcade.Body;
            // Use knockback values directly (already calculated with proper strength)
            body.setVelocity(knockbackX, knockbackY);
            this.knockbackTime = this.scene.time.now + knockbackDuration;
        }
        
        if (this.health <= 0) {
            if (onDeath) {
                onDeath(this.x, this.y);
            }
            this.destroy();
        } else {
            this.updateColor();
            
            // Flash effect when hit
            this.setTint(0xffffff);
            this.scene.time.delayedCall(100, () => {
                if (this.active) {
                    this.updateColor();
                }
            });
        }
    }

    private updateColor() {
        if (this.isChampion) {
            // Champion: Solid bright purple - no health-based fading
            this.setTint(this.originalTint); // originalTint is set to 0xDD00FF for champions
        } else {
            // Normal: Solid bright red - no health-based fading
            this.setTint(this.originalTint);
        }
    }

    // Check if this enemy can be hit by a specific sword (cooldown check)
    canBeHitBySword(swordNumber: 1 | 2): boolean {
        const currentTime = this.scene.time.now;
        const lastHitTime = swordNumber === 1 ? this.lastHitBySword1 : this.lastHitBySword2;
        return (currentTime - lastHitTime) >= this.swordHitCooldown;
    }

    // Record that this enemy was hit by a specific sword
    recordSwordHit(swordNumber: 1 | 2) {
        const currentTime = this.scene.time.now;
        if (swordNumber === 1) {
            this.lastHitBySword1 = currentTime;
        } else {
            this.lastHitBySword2 = currentTime;
        }
    }

    destroy() {
        // Clean up flash tween
        if (this.flashTween) {
            this.flashTween.destroy();
        }
        super.destroy();
    }
}
