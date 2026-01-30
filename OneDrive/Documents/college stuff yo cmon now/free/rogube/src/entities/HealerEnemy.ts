import Phaser from 'phaser';

export default class HealerEnemy extends Phaser.Physics.Arcade.Image {
    private speed: number = 60; // Slow movement
    private health: number = 5;
    private maxHealth: number = 5;
    private knockbackTime: number = 0;
    private isChampion: boolean = false;
    private damageToPlayer: number = 1;
    private dropRateMultiplier: number = 1;
    private lastHitBySword1: number = 0;
    private lastHitBySword2: number = 0;
    private swordHitCooldown: number = 100;
    
    // Healing mechanics
    private healRange: number = 750; // Range to detect and heal allies (increased)
    private minDistance: number = 150; // Minimum distance to maintain from target
    private healCooldown: number = 3000; // 3 seconds between heals
    private cooldownStartTime: number = -1; // When cooldown started (-1 = not started)
    private healAmount: number = 1;
    private isHealing: boolean = false;
    private healBeam: Phaser.GameObjects.Graphics | null = null;
    private currentTarget: Phaser.Physics.Arcade.Image | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, isChampion: boolean = false) {
        super(scene, x, y, 'healerEnemy');
        
        this.isChampion = isChampion;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set pixel-perfect rendering
        const texture = scene.textures.get('healerEnemy');
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Apply champion modifiers
        if (this.isChampion) {
            this.speed = 66; // 10% faster
            this.maxHealth = 10; // 2x health
            this.health = this.maxHealth;
            this.damageToPlayer = 2;
            this.dropRateMultiplier = 2;
            this.healAmount = 2; // 2x healing for champions
            
            // 8x8 sprite scaled to 48x48 (6x scale) for champions
            this.setDisplaySize(48, 48);
        } else {
            // 8x8 sprite scaled to 32x32 (4x scale) for normal
            this.setDisplaySize(32, 32);
        }
        
        this.setOrigin(0.5, 0.5);
        
        // Set physics body size to match original sprite (8x8)
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 8);
        body.setCollideWorldBounds(true);
        
        // Set initial color based on health
        this.updateColor();
    }

    update(enemies: Phaser.GameObjects.GameObject[]) {
        const currentTime = this.scene.time.now;
        
        // Handle knockback - stop movement during knockback
        if (currentTime < this.knockbackTime) {
            return;
        }
        
        // Find the closest enemy (for movement) and lowest health damaged enemy (for healing)
        let closestEnemy: Phaser.Physics.Arcade.Image | null = null;
        let closestDistance = Infinity;
        let lowestHealthEnemy: Phaser.Physics.Arcade.Image | null = null;
        let lowestHealth = Infinity;
        
        enemies.forEach((enemyObj) => {
            if (enemyObj === this || !enemyObj.active) return;
            
            const enemy = enemyObj as any;
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            
            // Check if enemy is within heal range
            if (distance <= this.healRange) {
                // Track closest enemy for movement
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy as Phaser.Physics.Arcade.Image;
                }
                
                // Track lowest health damaged enemy for healing
                const enemyHealth = enemy.health || enemy.maxHealth;
                const enemyMaxHealth = enemy.maxHealth || 1;
                
                if (enemyHealth < enemyMaxHealth && enemyHealth < lowestHealth) {
                    lowestHealth = enemyHealth;
                    lowestHealthEnemy = enemy as Phaser.Physics.Arcade.Image;
                }
            }
        });
        
        // Handle cooldown logic
        if (lowestHealthEnemy) {
            // There's a damaged enemy in range - start/continue cooldown
            if (this.cooldownStartTime === -1) {
                // Start cooldown now
                this.cooldownStartTime = currentTime;
            }
            
            // Check if cooldown is complete
            if (!this.isHealing && currentTime - this.cooldownStartTime >= this.healCooldown) {
                this.healTarget(lowestHealthEnemy);
            }
        } else {
            // No damaged enemies in range - reset cooldown
            this.cooldownStartTime = -1;
        }
        
        // Move towards the closest enemy if found, otherwise stay still
        if (!this.isHealing) {
            if (closestEnemy) {
                const target = closestEnemy as Phaser.Physics.Arcade.Image;
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Only move if target is beyond minimum distance
                if (distance > this.minDistance) {
                    this.setVelocity(
                        (dx / distance) * this.speed,
                        (dy / distance) * this.speed
                    );
                } else {
                    // Close enough - stay still
                    this.setVelocity(0, 0);
                }
            } else {
                // No enemies in range - stay completely still
                this.setVelocity(0, 0);
            }
        }
    }

    private healTarget(target: Phaser.Physics.Arcade.Image) {
        this.isHealing = true;
        this.currentTarget = target;
        this.cooldownStartTime = -1; // Reset cooldown (will restart when heal completes)
        this.setVelocity(0, 0); // Stop moving while healing
        
        // Create pink healing beam
        this.healBeam = this.scene.add.graphics();
        this.healBeam.setDepth(5); // Below player, above ground
        
        // Draw initial beam
        this.drawHealBeam();
        
        // Fade out the beam over 500ms
        this.scene.tweens.add({
            targets: this.healBeam,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                if (this.healBeam) {
                    this.healBeam.destroy();
                    this.healBeam = null;
                }
                this.isHealing = false;
                this.currentTarget = null;
            }
        });
        
        // Apply healing to the target
        const targetEnemy = target as any;
        if (targetEnemy.health !== undefined && targetEnemy.maxHealth !== undefined) {
            targetEnemy.health = Math.min(targetEnemy.health + this.healAmount, targetEnemy.maxHealth);
            
            // Update target's color if it has updateColor method
            if (typeof targetEnemy.updateColor === 'function') {
                targetEnemy.updateColor();
            }
        }
    }

    private drawHealBeam() {
        if (!this.healBeam || !this.currentTarget || !this.currentTarget.active) return;
        
        this.healBeam.clear();
        this.healBeam.lineStyle(3, 0xFF6B9D, 1); // Softer pink color, 3px width
        this.healBeam.beginPath();
        this.healBeam.moveTo(this.x, this.y);
        this.healBeam.lineTo(this.currentTarget.x, this.currentTarget.y);
        this.healBeam.strokePath();
    }

    private updateColor() {
        const healthPercent = this.health / this.maxHealth;
        
        if (this.isChampion) {
            // Champion: Purple gradient based on health
            if (healthPercent > 0.66) {
                this.setTint(0xDD00FF); // Bright purple
            } else if (healthPercent > 0.33) {
                this.setTint(0xBB00DD); // Medium purple
            } else {
                this.setTint(0x990099); // Dark purple
            }
        } else {
            // Normal: Red gradient based on health
            if (healthPercent > 0.66) {
                this.setTint(0xFF1100); // Bright red
            } else if (healthPercent > 0.33) {
                this.setTint(0xDD0000); // Medium red
            } else {
                this.setTint(0xBB0000); // Dark red
            }
        }
    }

    getDamageToPlayer(): number {
        return this.damageToPlayer;
    }

    getDropRateMultiplier(): number {
        return this.dropRateMultiplier;
    }

    takeDamage(amount: number, onDeath: (x: number, y: number) => void, knockbackX: number, knockbackY: number) {
        this.health -= amount;
        
        // Apply knockback
        this.setVelocity(knockbackX, knockbackY);
        this.knockbackTime = this.scene.time.now + 100; // 100ms knockback duration
        
        if (this.health <= 0) {
            onDeath(this.x, this.y);
            this.destroy();
        } else {
            // Update color based on remaining health
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

    canBeHitBySword(swordNumber: 1 | 2): boolean {
        const currentTime = this.scene.time.now;
        const lastHitTime = swordNumber === 1 ? this.lastHitBySword1 : this.lastHitBySword2;
        return (currentTime - lastHitTime) >= this.swordHitCooldown;
    }

    recordSwordHit(swordNumber: 1 | 2) {
        const currentTime = this.scene.time.now;
        if (swordNumber === 1) {
            this.lastHitBySword1 = currentTime;
        } else {
            this.lastHitBySword2 = currentTime;
        }
    }

    destroy() {
        // Clean up heal beam if it exists
        if (this.healBeam) {
            this.healBeam.destroy();
            this.healBeam = null;
        }
        super.destroy();
    }
}
