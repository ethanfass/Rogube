import Phaser from 'phaser';
import Player from './Player';

export default class Enemy extends Phaser.Physics.Arcade.Image {
    private speed: number = 100;
    private health: number = 5;
    private maxHealth: number = 5;
    private knockbackTime: number = 0; // Time when knockback ends
    private isChampion: boolean = false;
    private damageToPlayer: number = 1; // Hearts of damage dealt to player
    private dropRateMultiplier: number = 1; // Multiplier for drop chances
    private lastHitBySword1: number = 0; // Timestamp of last hit by sword 1
    private lastHitBySword2: number = 0; // Timestamp of last hit by sword 2
    private swordHitCooldown: number = 100; // Cooldown per sword (100ms)

    constructor(scene: Phaser.Scene, x: number, y: number, isChampion: boolean = false) {
        super(scene, x, y, 'enemy');
        
        this.isChampion = isChampion;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set pixel-perfect rendering
        const texture = scene.textures.get('enemy');
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Apply champion modifiers
        if (this.isChampion) {
            this.speed = 88; // 10% faster (80 * 1.1)
            this.maxHealth = 10; // 2x health (5 * 2)
            this.health = this.maxHealth;
            this.damageToPlayer = 2; // 2 hearts instead of 1
            this.dropRateMultiplier = 2; // Double drop rates
            
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
        
        // Set initial color based on health
        this.updateColor();
    }
    
    public getDamageToPlayer(): number {
        return this.damageToPlayer;
    }
    
    public getDropRateMultiplier(): number {
        return this.dropRateMultiplier;
    }

    update(player: Player, _delta: number) {
        // Don't move during knockback
        if (this.scene.time.now < this.knockbackTime) {
            return;
        }
        
        // Simple AI: move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const velocityX = (dx / distance) * this.speed;
            const velocityY = (dy / distance) * this.speed;
            this.setVelocity(velocityX, velocityY);
        }
    }

    takeDamage(amount: number, onDeath?: (x: number, y: number) => void, knockbackX?: number, knockbackY?: number) {
        this.health -= amount;
        
        // Apply knockback if direction provided
        if (knockbackX !== undefined && knockbackY !== undefined) {
            const knockbackDuration = 100; // milliseconds
            const body = this.body as Phaser.Physics.Arcade.Body;
            // Use knockback values directly (already calculated with proper strength)
            body.setVelocity(knockbackX, knockbackY);
            this.knockbackTime = this.scene.time.now + knockbackDuration;
        }
        
        if (this.health <= 0) {
            // Call onDeath callback before destroying (for power cell drops)
            if (onDeath) {
                onDeath(this.x, this.y);
            }
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

    private updateColor() {
        if (this.isChampion) {
            // Champion: Solid bright purple - no health-based fading
            this.setTint(0xDD00FF);
        } else {
            // Normal: Solid bright red - no health-based fading
            this.setTint(0xFF1100);
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
        super.destroy();
    }
}
