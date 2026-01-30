import Phaser from 'phaser';
import Player from './Player';

enum DasherState {
    APPROACHING,
    CHARGING,
    PAUSING,
    DASHING,
    EXHAUSTED
}

export default class DasherEnemy extends Phaser.Physics.Arcade.Image {
    private speed: number = 100;
    private health: number = 3;
    private maxHealth: number = 3;
    private knockbackTime: number = 0;
    private isChampion: boolean = false;
    private damageToPlayer: number = 1;
    private dropRateMultiplier: number = 1;
    private lastHitBySword1: number = 0;
    private lastHitBySword2: number = 0;
    private swordHitCooldown: number = 100;
    
    // Dasher mechanics
    public state: DasherState = DasherState.APPROACHING;
    private chargeRange: number = 200; // Range to start charging
    private blinkCount: number = 0;
    private maxBlinks: number = 5;
    private blinkDuration: number = 200; // ms per blink (half cycle)
    private lastBlinkTime: number = 0;
    private isBlinkVisible: boolean = true;
    private pauseDuration: number = 300; // ms pause before dash
    private pauseStartTime: number = 0;
    private dashSpeed: number = 1600; // Increased speed
    private dashDirection: { x: number, y: number } = { x: 0, y: 0 };
    private dashTween: Phaser.Tweens.Tween | null = null;
    private colorTween: Phaser.Tweens.Tween | null = null;
    private dashVelocityX: number = 0;
    private dashVelocityY: number = 0;
    private dashFriction: number = 0.975; // Friction coefficient (0.96 = very gradual slowdown)
    private exhaustDuration: number = 1500; // ms to stay blue/exhausted
    private exhaustStartTime: number = 0;
    private chargeTint: number = 0xFFFF00; // Yellow
    private exhaustTint: number = 0x0099FF; // Blue
    private normalTint: number = 0xFF1100; // Red
    private isRotating: boolean = false; // Whether we're smoothly rotating to face player
    private rotationSpeed: number = 0.15; // Speed of smooth rotation (radians per frame)
    
    // Pixel collision data - these are the WHITE pixels that CAN take damage
    // Black border pixels (lines 2019-2028 in GameScene) will NOT take damage
    // These coordinates match exactly the white fillRect calls (lines 2036-2060 in GameScene)
    // Stored as [x, y] coordinates relative to sprite (0-7 for 8x8)
    private damageablePixels: [number, number][] = [
        // Row 0: fillRect(0, 0, 2, 1)
        [0, 0], [1, 0],
        // Row 1: fillRect(1, 1, 6, 1)
        [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
        // Row 2: fillRect(2, 2, 5, 1)
        [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
        // Row 3: fillRect(3, 3, 4, 1)
        [3, 3], [4, 3], [5, 3], [6, 3],
        // Row 4: fillRect(2, 4, 5, 1)
        [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
        // Row 5: fillRect(1, 5, 3, 1) + fillRect(5, 5, 2, 1)
        [1, 5], [2, 5], [3, 5], [5, 5], [6, 5],
        // Row 6: fillRect(0, 6, 3, 1) + fillRect(6, 6, 2, 1)
        [0, 6], [1, 6], [2, 6], [6, 6], [7, 6],
        // Row 7: fillRect(0, 7, 2, 1) + fillRect(7, 7, 1, 1)
        [0, 7], [1, 7], [7, 7],
    ];

    constructor(scene: Phaser.Scene, x: number, y: number, isChampion: boolean = false) {
        super(scene, x, y, 'dasherEnemy');
        
        this.isChampion = isChampion;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set pixel-perfect rendering
        const texture = scene.textures.get('dasherEnemy');
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Apply champion modifiers
        if (this.isChampion) {
            this.speed = 110; // 10% faster
            this.maxHealth = 6; // 2x health
            this.health = this.maxHealth;
            this.damageToPlayer = 2;
            this.dropRateMultiplier = 2;
            this.normalTint = 0xDD00FF; // Purple for champions
            
            // 8x8 sprite scaled to 40x40 (5x scale) for champions
            this.setDisplaySize(40, 40);
        } else {
            // 8x8 sprite scaled to 32x32 (4x scale) for normal
            this.setDisplaySize(32, 32);
        }
        
        this.setOrigin(0.5, 0.5);
        
        // Set physics body size to match sprite size (8x8)
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 8);
        body.setCollideWorldBounds(true);
        
        // Set initial color
        this.updateColor();
    }

    update(player: Player, _delta: number) {
        const currentTime = this.scene.time.now;
        
        // Handle knockback - stop movement during knockback
        if (currentTime < this.knockbackTime) {
            return;
        }
        
        // Calculate distance and direction to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Handle rotation based on state
        if (distance > 0) {
            const targetRotation = Math.atan2(dy, dx) + Math.PI / 4;
            
            if (this.state === DasherState.APPROACHING || this.state === DasherState.CHARGING) {
                if (this.isRotating) {
                    // Smoothly rotate towards target
                    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetRotation, this.rotationSpeed);
                    
                    // Stop rotating flag when close enough to target (within ~5 degrees)
                    if (Math.abs(Phaser.Math.Angle.ShortestBetween(this.rotation, targetRotation)) < 0.1) {
                        this.isRotating = false;
                    }
                } else {
                    // Normal instant rotation
                    this.rotation = targetRotation;
                }
            }
            // During dash, pause, and exhausted states: maintain current rotation
        }
        
        switch (this.state) {
            case DasherState.APPROACHING:
                this.handleApproaching(player, distance, dx, dy);
                break;
            case DasherState.CHARGING:
                this.handleCharging(currentTime, dx, dy, distance);
                break;
            case DasherState.PAUSING:
                this.handlePausing(currentTime);
                break;
            case DasherState.DASHING:
                this.handleDashing();
                break;
            case DasherState.EXHAUSTED:
                this.handleExhausted(currentTime);
                break;
        }
    }

    private handleApproaching(_player: Player, distance: number, dx: number, dy: number) {
        // Move toward player until in charge range
        if (distance > this.chargeRange) {
            // Move toward player
            this.setVelocity(
                (dx / distance) * this.speed,
                (dy / distance) * this.speed
            );
        } else {
            // In range - start charging
            this.setVelocity(0, 0);
            this.state = DasherState.CHARGING;
            this.blinkCount = 0;
            this.lastBlinkTime = this.scene.time.now;
            this.isBlinkVisible = true;
            this.isRotating = false; // Disable smooth rotation during charging
        }
    }

    private handleCharging(currentTime: number, dx: number, dy: number, distance: number) {
        // Stay still and blink
        this.setVelocity(0, 0);
        
        // Handle blinking
        if (currentTime - this.lastBlinkTime >= this.blinkDuration) {
            this.isBlinkVisible = !this.isBlinkVisible;
            this.lastBlinkTime = currentTime;
            
            // Count complete blinks (when turning off)
            if (!this.isBlinkVisible) {
                this.blinkCount++;
            }
            
            // After 5 complete blinks, go to pause state
            if (this.blinkCount >= this.maxBlinks) {
                this.state = DasherState.PAUSING;
                this.pauseStartTime = currentTime;
                this.setTint(this.normalTint); // Set to normal color during pause
                
                // Store dash direction (normalized)
                if (distance > 0) {
                    this.dashDirection = {
                        x: dx / distance,
                        y: dy / distance
                    };
                }
            } else {
                // Update color based on blink
                if (this.isBlinkVisible) {
                    this.setTint(this.chargeTint); // Yellow
                } else {
                    this.setTint(this.normalTint); // Normal red/purple
                }
            }
        }
    }

    private handlePausing(currentTime: number) {
        // Stay still during pause
        this.setVelocity(0, 0);
        
        // After pause, start dashing
        if (currentTime - this.pauseStartTime >= this.pauseDuration) {
            this.state = DasherState.DASHING;
        }
    }

    private handleDashing() {
        // Initialize dash velocity on first frame
        if (this.dashVelocityX === 0 && this.dashVelocityY === 0) {
            // Set initial high velocity
            this.dashVelocityX = this.dashDirection.x * this.dashSpeed;
            this.dashVelocityY = this.dashDirection.y * this.dashSpeed;
        }
        
        // Apply velocity
        this.setVelocity(this.dashVelocityX, this.dashVelocityY);
        
        // Apply friction to create gliding effect
        this.dashVelocityX *= this.dashFriction;
        this.dashVelocityY *= this.dashFriction;
        
        // Check if velocity is low enough to stop (speed < 50)
        const currentSpeed = Math.sqrt(this.dashVelocityX * this.dashVelocityX + this.dashVelocityY * this.dashVelocityY);
        if (currentSpeed < 50) {
            this.state = DasherState.EXHAUSTED;
            this.exhaustStartTime = this.scene.time.now;
            this.setVelocity(0, 0);
            
            // Reset dash velocity for next dash
            this.dashVelocityX = 0;
            this.dashVelocityY = 0;
            
            // Fade to blue exhausted color
            this.fadeToColor(this.exhaustTint, 250);
        }
    }

    private handleExhausted(currentTime: number) {
        // Stay still and blue
        this.setVelocity(0, 0);
        
        // After exhaust duration, return to approaching
        if (currentTime - this.exhaustStartTime >= this.exhaustDuration) {
            this.state = DasherState.APPROACHING;
            this.isRotating = true; // Enable smooth rotation to face player
            
            // Fade back to normal red color
            this.fadeToColor(this.normalTint, 250);
        }
    }

    private fadeToColor(targetColor: number, duration: number) {
        // Stop any existing color tween
        if (this.colorTween) {
            this.colorTween.stop();
            this.colorTween = null;
        }
        
        // Get current tint color components
        const currentTint = this.tintTopLeft;
        const currentR = (currentTint >> 16) & 0xFF;
        const currentG = (currentTint >> 8) & 0xFF;
        const currentB = currentTint & 0xFF;
        
        // Get target color components
        const targetR = (targetColor >> 16) & 0xFF;
        const targetG = (targetColor >> 8) & 0xFF;
        const targetB = targetColor & 0xFF;
        
        // Create interpolation object
        const colorObj = { r: currentR, g: currentG, b: currentB };
        
        // Tween the color components
        this.colorTween = this.scene.tweens.add({
            targets: colorObj,
            r: targetR,
            g: targetG,
            b: targetB,
            duration: duration,
            ease: 'Linear',
            onUpdate: () => {
                if (this.active) {
                    const r = Math.round(colorObj.r);
                    const g = Math.round(colorObj.g);
                    const b = Math.round(colorObj.b);
                    const newColor = (r << 16) | (g << 8) | b;
                    this.setTint(newColor);
                }
            },
            onComplete: () => {
                if (this.active) {
                    this.colorTween = null;
                }
            }
        });
    }

    private updateColor() {
        this.setTint(this.normalTint);
    }

    getDamageToPlayer(): number {
        return this.damageToPlayer;
    }

    getDropRateMultiplier(): number {
        return this.dropRateMultiplier;
    }

    // Check if a specific pixel can take damage (for pixel-perfect collision)
    canPixelTakeDamage(pixelX: number, pixelY: number): boolean {
        // pixelX and pixelY are in local sprite coordinates (0-7 for 8x8 sprite)
        return this.damageablePixels.some(([x, y]) => x === pixelX && y === pixelY);
    }

    takeDamage(amount: number, onDeath: (x: number, y: number) => void, knockbackX: number, knockbackY: number) {
        this.health -= amount;
        
        // Only apply knockback when NOT charging or dashing (those states have control of movement)
        if (this.state !== DasherState.CHARGING && this.state !== DasherState.DASHING && this.state !== DasherState.PAUSING) {
            this.setVelocity(knockbackX, knockbackY);
            this.knockbackTime = this.scene.time.now + 100; // 100ms knockback duration
        }
        
        if (this.health <= 0) {
            onDeath(this.x, this.y);
            this.destroy();
        } else {
            // Flash white when hit (only the white/red pixels will flash, black border stays black)
            // Stop any color fade tween temporarily
            const wasColorTweening = this.colorTween !== null;
            if (this.colorTween) {
                this.colorTween.pause();
            }
            
            // Determine what color to restore based on current state
            let restoreColor: number;
            if (this.state === DasherState.EXHAUSTED) {
                restoreColor = this.exhaustTint; // Blue
            } else if (this.state === DasherState.CHARGING && this.isBlinkVisible) {
                restoreColor = this.chargeTint; // Yellow
            } else {
                restoreColor = this.normalTint; // Red
            }
            
            this.setTint(0xFFFFFF); // Flash to white
            
            this.scene.time.delayedCall(100, () => {
                if (this.active) {
                    this.setTint(restoreColor);
                    
                    // Resume color tween if it was active
                    if (wasColorTweening && this.colorTween) {
                        this.colorTween.resume();
                    }
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
        // Clean up dash tween
        if (this.dashTween) {
            this.dashTween.stop();
            this.dashTween = null;
        }
        
        // Clean up color tween
        if (this.colorTween) {
            this.colorTween.stop();
            this.colorTween = null;
        }
        
        super.destroy();
    }
}
