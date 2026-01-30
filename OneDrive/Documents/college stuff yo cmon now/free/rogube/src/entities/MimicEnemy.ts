import Phaser from 'phaser';
import Player from './Player';

export default class MimicEnemy extends Phaser.Physics.Arcade.Image {
    private health: number = 4;
    private maxHealth: number = 4;
    private knockbackTime: number = 0;
    private isChampion: boolean = false;
    private isMini: boolean = false; // Mini mimics from splitting
    private damageToPlayer: number = 1;
    private dropRateMultiplier: number = 1;
    private lastHitBySword1: number = 0;
    private lastHitBySword2: number = 0;
    private swordHitCooldown: number = 100;
    
    // Hopping mechanics
    private isHopping: boolean = false;
    private hopCooldown: number = 800; // 600ms between hops
    private lastHopTime: number = 0;
    private hopDuration: number = 800; // 400ms hop duration
    private hopDistance: number = 150; // Distance to hop
    private hopTween: Phaser.Tweens.Tween | null = null;
    private squishTween: Phaser.Tweens.Tween | null = null;
    private hopDelayedCall: Phaser.Time.TimerEvent | null = null;
    
    // Reflection mechanics
    private isReflecting: boolean = false;
    private isFadingToReflect: boolean = false; // True while fading to yellow, before reflecting
    private reflectChance: number = 0.01; // 30% chance to reflect when close
    private reflectRange: number = 100; // Distance to start reflecting
    private reflectDuration: number = 2000; // 2 seconds in reflect state (longer)
    private reflectStartTime: number = 0;
    private reflectCooldown: number = 7000; // 3 seconds between reflects
    private lastReflectTime: number = 0;
    private reflectTint: number = 0xFFFF00; // Yellow
    private originalTint: number = 0xFF1100; // Normal red
    private fadeTween: Phaser.Tweens.Tween | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, isChampion: boolean = false, isMini: boolean = false) {
        super(scene, x, y, 'mimicEnemy');
        
        this.isChampion = isChampion;
        this.isMini = isMini;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set pixel-perfect rendering
        const texture = scene.textures.get('mimicEnemy');
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Apply mini mimic modifiers (takes precedence over champion)
        if (this.isMini) {
            this.maxHealth = 2;
            this.health = this.maxHealth;
            this.hopDistance = 200; // Half the normal hop distance
            this.reflectChance = 0; // No reflection for mini mimics
            
            // Smaller size (3x scale)
            this.setDisplaySize(24, 24);
        }
        // Apply champion modifiers
        else if (this.isChampion) {
            this.maxHealth = 8; // 2x health
            this.health = this.maxHealth;
            this.damageToPlayer = 2;
            this.dropRateMultiplier = 2;
            
            // 8x8 sprite scaled to 56x56 (7x scale) for champions
            this.setDisplaySize(56, 56);
            this.originalTint = 0xDD00FF; // Purple for champions
        } else {
            // Normal size (5x scale)
            this.setDisplaySize(40, 40);
        }
        
        this.setOrigin(0.5, 0.5);
        
        // Set physics body size to match original sprite (8x8)
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 8);
        body.setCollideWorldBounds(true);
        
        // Set initial hop time to now so they wait one full cooldown before first hop
        this.lastHopTime = this.scene.time.now - this.hopCooldown / 2;
        
        // Set initial color
        this.updateColor();
    }

    update(player: Player) {
        // Safety check - don't update if destroyed
        if (!this.active || !this.body) {
            return;
        }
        
        const currentTime = this.scene.time.now;
        
        // Handle knockback - stop movement
        if (currentTime < this.knockbackTime) {
            return;
        }
        
        // Calculate distance to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if we should enter reflect state
        if (!this.isReflecting && !this.isFadingToReflect && distance < this.reflectRange) {
            if (currentTime - this.lastReflectTime > this.reflectCooldown) {
                if (Math.random() < this.reflectChance) {
                    this.startReflecting();
                }
            }
        }
        
        // Update reflect state
        if (this.isReflecting || this.isFadingToReflect) {
            if (this.isReflecting && currentTime - this.reflectStartTime > this.reflectDuration) {
                this.stopReflecting();
            } else {
                // Stay still while fading and reflecting
                this.setVelocity(0, 0);
                return;
            }
        }
        
        // Handle hopping movement
        if (this.isHopping) {
            // Currently hopping - wait for hop to finish
            if (currentTime - this.lastHopTime > this.hopDuration) {
                this.isHopping = false;
                this.setVelocity(0, 0);
                // Squish before next hop
            }
        } else {
            // Not hopping - wait for cooldown then hop
            if (currentTime - this.lastHopTime > this.hopCooldown) {
                this.lastHopTime = currentTime;

                this.squish();

                // Clear any existing hop delayed call
                if (this.hopDelayedCall) {
                    this.hopDelayedCall.destroy();
                }

                this.hopDelayedCall = this.scene.time.delayedCall(500, () => {
                    if (this.active && this.body) {
                        // Recalculate direction to player at hop time
                        const hopDx = player.x - this.x;
                        const hopDy = player.y - this.y;
                        const hopDistance = Math.sqrt(hopDx * hopDx + hopDy * hopDy);
                        this.hop(hopDx, hopDy, hopDistance);
                    }
                });
            } else {
                // Waiting between hops
                this.setVelocity(0, 0);
            }
        }
    }

    private hop(dx: number, dy: number, distance: number) {
        // Safety check
        if (!this.active || !this.body) {
            return;
        }
        
        if (distance > 0) {
            this.isHopping = true;
            this.lastHopTime = this.scene.time.now;
            
            // Calculate target position (use instance hop distance)
            const targetX = this.x + (dx / distance) * this.hopDistance;
            const targetY = this.y + (dy / distance) * this.hopDistance;
            
            // Buttery hop movement - start fast, slow down (Quad.Out easing)
            if (this.hopTween) {
                this.hopTween.stop();
            }
            
            this.hopTween = this.scene.tweens.add({
                targets: this,
                x: targetX,
                y: targetY,
                duration: this.hopDuration,
                ease: 'Quad.Out', // Start fast, slow down
                onComplete: () => {
                    if (this.active && this.body) {
                        this.setVelocity(0, 0);
                    }
                }
            });
        }
    }

    private squish() {
        // Safety check
        if (!this.active) {
            return;
        }
        
        // Squish down slightly before hopping
        if (this.squishTween) {
            this.squishTween.stop();
        }
        
        let originalSize = 40; // Normal
        if (this.isMini) {
            originalSize = 24;
        } else if (this.isChampion) {
            originalSize = 56;
        }
        
        const squishSize = originalSize * 0.75;
        
        this.squishTween = this.scene.tweens.add({
            targets: this,
            displayHeight: squishSize,
            duration: 100,
            yoyo: true,
            ease: 'Sine.InOut',
            onComplete: () => {
                // Ensure we're back to original size (check if still active)
                if (this.active) {
                    this.setDisplaySize(originalSize, originalSize);
                }
            }
        });
    }

    private startReflecting() {
        // Safety check
        if (!this.active) {
            return;
        }
        
        this.isFadingToReflect = true;
        this.lastReflectTime = this.scene.time.now;
        this.setVelocity(0, 0);
        
        // Fade to yellow slowly (over 2000ms)
        if (this.fadeTween) {
            this.fadeTween.stop();
        }
        
        this.fadeTween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 1000, // 2000ms fade
            ease: 'Sine.InOut',
            onUpdate: (tween) => {
                if (!this.active) return;
                
                const progress = tween.getValue();
                if (progress === null || progress === undefined) return;
                
                // Interpolate between original tint and yellow
                const r1 = (this.originalTint >> 16) & 0xFF;
                const g1 = (this.originalTint >> 8) & 0xFF;
                const b1 = this.originalTint & 0xFF;
                
                const r2 = (this.reflectTint >> 16) & 0xFF;
                const g2 = (this.reflectTint >> 8) & 0xFF;
                const b2 = this.reflectTint & 0xFF;
                
                const r = Math.round(r1 + (r2 - r1) * progress);
                const g = Math.round(g1 + (g2 - g1) * progress);
                const b = Math.round(b1 + (b2 - b1) * progress);
                
                const interpolatedTint = (r << 16) | (g << 8) | b;
                this.setTint(interpolatedTint);
            },
            onComplete: () => {
                if (!this.active) return;
                
                // Fade complete - now start reflecting
                this.isFadingToReflect = false;
                this.isReflecting = true;
                this.reflectStartTime = this.scene.time.now;
            }
        });
    }

    private stopReflecting() {
        // Safety check
        if (!this.active) {
            return;
        }
        
        this.isReflecting = false;
        this.isFadingToReflect = false; // Make sure both are cleared
        
        // Fade back to normal color
        if (this.fadeTween) {
            this.fadeTween.stop();
        }
        
        this.fadeTween = this.scene.tweens.addCounter({
            from: 1,
            to: 0,
            duration: 200,
            ease: 'Sine.InOut',
            onUpdate: (tween) => {
                if (!this.active) return;
                
                const progress = tween.getValue();
                if (progress === null || progress === undefined) return;
                
                const r1 = (this.originalTint >> 16) & 0xFF;
                const g1 = (this.originalTint >> 8) & 0xFF;
                const b1 = this.originalTint & 0xFF;
                
                const r2 = (this.reflectTint >> 16) & 0xFF;
                const g2 = (this.reflectTint >> 8) & 0xFF;
                const b2 = this.reflectTint & 0xFF;
                
                const r = Math.round(r1 + (r2 - r1) * progress);
                const g = Math.round(g1 + (g2 - g1) * progress);
                const b = Math.round(b1 + (b2 - b1) * progress);
                
                const interpolatedTint = (r << 16) | (g << 8) | b;
                this.setTint(interpolatedTint);
            },
            onComplete: () => {
                if (this.active) {
                    this.updateColor();
                }
            }
        });
    }

    getDamageToPlayer(): number {
        return this.damageToPlayer;
    }

    getDropRateMultiplier(): number {
        return this.dropRateMultiplier;
    }

    isReflectingState(): boolean {
        return this.isReflecting;
    }

    isMiniMimic(): boolean {
        return this.isMini;
    }

    takeDamage(amount: number, onDeath: (x: number, y: number) => void, knockbackX: number, knockbackY: number) {
        // If reflecting, don't take damage from swords (bullets handled in GameScene)
        if (this.isReflecting) {
            return; // No damage, knockback handled in GameScene
        }
        
        this.health -= amount;
        
        // Apply knockback
        this.setVelocity(knockbackX, knockbackY);
        this.knockbackTime = this.scene.time.now + 100; // 100ms knockback duration
        
        if (this.health <= 0) {
            // Spawn 2 mini mimics if this is a normal (not mini) mimic
            if (!this.isMini) {
                this.spawnMiniMimics();
            }
            
            onDeath(this.x, this.y);
            this.destroy();
        } else {
            // Update color based on remaining health
            this.updateColor();
            
            // Flash effect when hit
            this.setTint(0xffffff);
            this.scene.time.delayedCall(100, () => {
                if (this.active && !this.isReflecting && !this.isFadingToReflect) {
                    this.updateColor();
                }
            });
        }
    }

    private updateColor() {
        if (this.isChampion) {
            // Champion: Solid bright purple
            this.setTint(0xDD00FF);
        } else {
            // Normal: Solid bright red
            this.setTint(0xFF1100);
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

    private spawnMiniMimics() {
        // Spawn 2 mini mimics at this position, slightly offset
        const offsetDistance = 30;
        
        // Mini mimic 1 - offset to the left
        const mini1 = new MimicEnemy(this.scene, this.x - offsetDistance, this.y, false, true);
        
        // Mini mimic 2 - offset to the right
        const mini2 = new MimicEnemy(this.scene, this.x + offsetDistance, this.y, false, true);
        
        // Add to scene's enemy group (we need to emit an event or store reference)
        // Store mini mimics as data so GameScene can pick them up
        this.setData('miniMimic1', mini1);
        this.setData('miniMimic2', mini2);
    }

    destroy() {
        // Clean up tweens
        if (this.hopTween) {
            this.hopTween.stop();
            this.hopTween = null;
        }
        if (this.squishTween) {
            this.squishTween.stop();
            this.squishTween = null;
        }
        if (this.fadeTween) {
            this.fadeTween.stop();
            this.fadeTween = null;
        }
        // Clean up delayed calls
        if (this.hopDelayedCall) {
            this.hopDelayedCall.destroy();
            this.hopDelayedCall = null;
        }
        super.destroy();
    }
}
