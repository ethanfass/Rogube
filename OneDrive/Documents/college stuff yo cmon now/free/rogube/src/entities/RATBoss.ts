import Phaser from 'phaser';
import Bullet from './Bullet';

enum RATState {
    IDLE = 'idle',
    MOVING = 'moving',
    ATTACK_BALL = 'attack_ball',
    ATTACK_RING = 'attack_ring',
    DEFENSE = 'defense',
    CHARGING = 'charging',
    CHARGE_PAUSING = 'charge_pausing',
    DASHING = 'dashing',
    PAUSED = 'paused',
    DYING = 'dying'
}

class RATBoss extends Phaser.Physics.Arcade.Image {
    private maxHealth: number = 250;
    private currentHealth: number = 250;
    public state: RATState = RATState.IDLE;
    private circleSpeed: number = 150; // Speed when circling the player
    private stopDistance: number = 200; // Distance to stop from player
    private attackRange: number = 450; // Range for attacks
    private player!: Phaser.Physics.Arcade.Image;
    private lastAttackTime: number = 0;
    private attackCooldown: number = 1500; // 1.5 seconds between attacks
    private isInRange: boolean = false;
    private exitRangeTime: number = 0;
    private currentAttackPhase: number = 0;
    private blinkCount: number = 0;
    private maxBlinks: number = 3;
    
    // Dash properties
    private dashSpeed: number = 1200; // Much faster/farther dash
    private dashVelocityX: number = 0;
    private dashVelocityY: number = 0;
    private dashFriction: number = 0.985; // Less friction = goes much farther
    private pauseDuration: number = 2000;
    private pauseStartTime: number = 0;
    private chargePauseDuration: number = 300;
    private chargePauseStartTime: number = 0;
    
    // Defense properties
    private defenseStartTime: number = 0;
    private defenseDuration: number = 3500;
    
    // Per-sword hit cooldown
    private lastSwordHitTime1: number = 0;
    private lastSwordHitTime2: number = 0;
    private swordCooldown: number = 200;
    
    // Turn speed
    private turnSpeed: number = 0.10; // Radians per frame (about 5.7 degrees)
    
    // Spawn time tracking
    private spawnTime: number = 0;
    
    // Sound tracking
    private deflectingSound: Phaser.Sound.BaseSound | null = null;
    
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'rat-default');
        
        scene.add.existing(this as any);
        scene.physics.add.existing(this as any);
        
        // Set pixel-perfect rendering for all rat textures
        const ratTextures = [
            'rat-default', 'rat-attack-no-ball', 'rat-attack-ball', 
            'rat-attack-ring', 'rat-defense-no-wall', 'rat-defense-with-wall',
            'rat-flash', 'rat-pause', 'rat-death'
        ];
        ratTextures.forEach(textureName => {
            const texture = scene.textures.get(textureName);
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
        });
        
        // Scale up (16x16 sprite scaled to 224x224, 14x scale)
        this.setDisplaySize(224, 224);
        this.setOrigin(0.5, 0.5);
        
        // Set physics body hitbox
        // Original sprite is 16x16 (scaled to 224x224 for display)
        // Body size/offset work on the ORIGINAL 16x16 texture, not the scaled display
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(15, 15); // Full original sprite size (easiest to hit)
        body.setOffset(0, 0); // Centered
        
        // To make hitbox smaller (harder to hit), reduce size and adjust offset:
        // Example: body.setSize(12, 12); body.setOffset(2, 2); // (16-12)/2 = 2
        body.setCollideWorldBounds(false); // Allow boss to move freely, including spawn off-screen
        body.setImmovable(true); // Boss cannot be pushed by collisions
        body.pushable = false; // Boss is not pushable
        
        // Boss should not block anything (walls, enemies, etc.) - it only detects overlaps
        body.checkCollision.none = false; // Keep collision detection on for overlaps
        body.enable = true; // Keep physics enabled
        
        this.setDepth(5);
    }
    
    setPlayer(player: Phaser.Physics.Arcade.Image) {
        this.player = player;
        // Don't start attack cooldown yet - wait until boss reaches circle range
        this.lastAttackTime = 0;
        // Track spawn time for failsafe
        this.spawnTime = this.scene.time.now;
    }
    
    getHealth(): number {
        return this.currentHealth;
    }
    
    getMaxHealth(): number {
        return this.maxHealth;
    }
    
    // Smoothly rotate towards target angle
    private rotateTowards(targetAngle: number) {
        // Normalize angles to -PI to PI range
        let currentAngle = this.rotation;
        
        // Calculate shortest angle difference
        let angleDiff = targetAngle - currentAngle;
        
        // Normalize angle difference to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Rotate by turn speed or remaining angle (whichever is smaller)
        if (Math.abs(angleDiff) < this.turnSpeed) {
            this.setRotation(targetAngle);
        } else {
            this.setRotation(currentAngle + Math.sign(angleDiff) * this.turnSpeed);
        }
    }
    
    takeDamage(damage: number, onDeath: (x: number, y: number) => void, _knockbackX: number = 0, _knockbackY: number = 0) {
        // Don't take damage while dying
        if (this.state === RATState.DYING) {
            return false;
        }
        
        this.currentHealth -= damage;
        
        // Flash white
        this.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });
        
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.startDeathSequence(onDeath);
        }
        
        return true; // Took damage
    }
    
    private startDeathSequence(onDeath: (x: number, y: number) => void) {
        this.state = RATState.DYING;
        this.setTexture('rat-death');
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        // Play enemy death sound
        const volume = (this.scene as any).volumeEnemyDeath || 0.5;
        this.scene.sound.play('enemy_death', { volume });
        
        // Shake for 3 seconds
        const shakeAmount = 5;
        const shakeInterval = 50;
        let shakeCount = 0;
        const maxShakes = (3000 / shakeInterval);
        
        const originalX = this.x;
        const originalY = this.y;
        
        this.scene.time.addEvent({
            delay: shakeInterval,
            repeat: maxShakes - 1,
            callback: () => {
                if (this.active) {
                    const offsetX = Phaser.Math.Between(-shakeAmount, shakeAmount);
                    const offsetY = Phaser.Math.Between(-shakeAmount, shakeAmount);
                    this.setPosition(originalX + offsetX, originalY + offsetY);
                }
                shakeCount++;
            }
        });
        
        // After 3 seconds, trigger death
        this.scene.time.delayedCall(3000, () => {
            if (this.active) {
                // Spawn explosion particles
                this.spawnDeathParticles();
                
                onDeath(this.x, this.y);
                
                // Clean up any active sounds
                if (this.deflectingSound) {
                    this.deflectingSound.stop();
                    this.deflectingSound = null;
                }
                this.scene.sound.stopByKey('rat_dash');
                
                this.destroy();
            }
        });
    }
    
    private spawnDeathParticles() {
        // Play explosion sound
        const volume = (this.scene as any).volumeRatExplosion || 0.5;
        this.scene.sound.play('rat_explosion', { volume });
        
        // Spawn 20-30 particles in all directions
        const particleCount = Phaser.Math.Between(20, 30);
        const particleColor = 0xff0000; // Red particles
        
        for (let i = 0; i < particleCount; i++) {
            // Random size between 8-16 pixels (large particles)
            const size = Phaser.Math.Between(8, 16);
            
            // Create particle as a simple colored rectangle
            const particle = this.scene.add.rectangle(this.x, this.y, size, size, particleColor);
            particle.setDepth(15); // Above everything
            
            // Random direction (360 degrees)
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            
            // Random speed between 100-200
            const speed = Phaser.Math.Between(100, 200);
            
            // Animate particle - explode outward
            this.scene.tweens.add({
                targets: particle,
                x: particle.x + dirX * speed,
                y: particle.y + dirY * speed,
                alpha: 0,
                duration: 800,
                ease: 'Quint.Out',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }
    
    update(time: number, player: Phaser.Physics.Arcade.Image, bulletGroup: Phaser.GameObjects.Group) {
        if (!this.active || !this.body) return;
        if (this.state === RATState.DYING) return;
        
        const body = this.body as Phaser.Physics.Arcade.Body;
        
        // Calculate distance to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if in attack range
        const wasInRange = this.isInRange;
        this.isInRange = distance <= this.attackRange;
        
        // If just exited range, mark time
        if (wasInRange && !this.isInRange) {
            this.exitRangeTime = time;
        }
        
        // Update homing bullets
        this.updateHomingBullets(time, bulletGroup);
        
        // State machine
        switch (this.state) {
            case RATState.IDLE:
            case RATState.MOVING:
                this.handleMovement(distance, dx, dy, body);
                this.handleAttackSelection(time, bulletGroup);
                break;
                
            case RATState.ATTACK_BALL:
                this.handleBallAttack(time, bulletGroup);
                break;
                
            case RATState.ATTACK_RING:
                this.handleRingAttack(time, bulletGroup);
                break;
                
            case RATState.DEFENSE:
                this.handleDefense(time);
                break;
                
            case RATState.CHARGING:
                this.handleCharging(time, dx, dy);
                break;
                
            case RATState.CHARGE_PAUSING:
                this.handleChargePausing(time, dx, dy);
                break;
                
            case RATState.DASHING:
                this.handleDashing(time);
                break;
                
            case RATState.PAUSED:
                this.handlePaused(time);
                break;
        }
    }
    
    private updateHomingBullets(time: number, bulletGroup: Phaser.GameObjects.Group) {
        if (!bulletGroup) return; // Safety check
        const bullets = bulletGroup.getChildren();
        
        for (const bullet of bullets) {
            if (!bullet.active) continue;
            
            const bulletSprite = bullet as Bullet;
            const isHoming = bulletSprite.getData('isHoming');
            
            if (isHoming) {
                const homingEndTime = bulletSprite.getData('homingEndTime');
                
                // Check if homing should stop
                if (time >= homingEndTime) {
                    bulletSprite.setData('isHoming', false);
                    continue;
                }
                
                // Apply homing toward player
                const target = bulletSprite.getData('homingTarget') as Phaser.Physics.Arcade.Image;
                const bulletSpeed = bulletSprite.getData('bulletSpeed') as number;
                
                if (target && target.active) {
                    const body = bulletSprite.body as Phaser.Physics.Arcade.Body;
                    
                    // Get direction to player
                    const dx = target.x - bulletSprite.x;
                    const dy = target.y - bulletSprite.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        // Calculate desired velocity
                        const targetVelX = (dx / distance) * bulletSpeed;
                        const targetVelY = (dy / distance) * bulletSpeed;
                        
                        // Current velocity
                        const currentVelX = body.velocity.x;
                        const currentVelY = body.velocity.y;
                        
                        // Interpolate toward target (homing strength 0.1)
                        const homingStrength = 0.1;
                        const newVelX = currentVelX + (targetVelX - currentVelX) * homingStrength;
                        const newVelY = currentVelY + (targetVelY - currentVelY) * homingStrength;
                        
                        // Normalize to maintain speed
                        const newSpeed = Math.sqrt(newVelX * newVelX + newVelY * newVelY);
                        if (newSpeed > 0) {
                            body.setVelocity(
                                (newVelX / newSpeed) * bulletSpeed,
                                (newVelY / newSpeed) * bulletSpeed
                            );
                        }
                    }
                }
            }
        }
    }
    
    private handleMovement(distance: number, dx: number, dy: number, body: Phaser.Physics.Arcade.Body) {
        // Always rotate to face the player (bottom side points at player)
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        // ALWAYS circle - calculate tangential direction (perpendicular to radial)
        const radialX = dx / distance;
        const radialY = dy / distance;
        const tangentX = -radialY; // Perpendicular (clockwise)
        const tangentY = radialX;
        
        // Use the circleSpeed property (can be adjusted at the top of the class)
        const circleSpeed = this.circleSpeed;
        
        // Calculate distance error and apply radial correction if needed
        const distanceError = distance - this.stopDistance;
        const radialSpeed = Math.min(Math.max(distanceError * 0.8, -100), 100); // Clamped radial adjustment
        
        // Start attack cooldown timer when first reaching circle range
        if (this.lastAttackTime === 0 && Math.abs(distanceError) < 50) {
            // Boss has reached circle range for the first time
            this.lastAttackTime = this.scene.time.now;
        }
        
        // Combine tangential (circling) and radial (distance correction) movement
        const velocityX = tangentX * circleSpeed + radialX * radialSpeed;
        const velocityY = tangentY * circleSpeed + radialY * radialSpeed;
        
        body.setVelocity(velocityX, velocityY);
        this.state = RATState.MOVING;
    }
    
    private handleAttackSelection(time: number, _bulletGroup: Phaser.GameObjects.Group) {
        // Failsafe: if 5 seconds have passed since spawn and still not attacking, force start
        if (this.lastAttackTime === 0 && time - this.spawnTime > 5000) {
            this.lastAttackTime = time;
        }
        
        // Don't attack if timer hasn't been started yet (boss not at circle range)
        if (this.lastAttackTime === 0) return;
        
        // Check cooldown (1.5 seconds after reaching circle range, then 1.5 seconds between attacks)
        if (time - this.lastAttackTime < this.attackCooldown) return;
        
        // Check if should attack
        const shouldAttack = this.isInRange || (time - this.exitRangeTime < 1000 && this.exitRangeTime > 0);
        
        if (shouldAttack) {
            // Randomly select an attack (1/4 chance for each)
            const attackRoll = Phaser.Math.Between(0, 3);
            // Don't set lastAttackTime here - it will be set when attack ends
            this.currentAttackPhase = 0;
            
            switch (attackRoll) {
                case 0:
                    this.startBallAttack(time);
                    break;
                case 1:
                    this.startRingAttack(time);
                    break;
                case 2:
                    this.startDefense(time);
                    break;
                case 3:
                    this.startCharge(time);
                    break;
            }
        }
    }
    
    // Ball Attack
    private startBallAttack(time: number) {
        this.state = RATState.ATTACK_BALL;
        this.setTexture('rat-attack-no-ball');
        // DON'T stop moving yet - let handleBallAttack do it
        
        // Set attack start time for timing calculations
        this.lastAttackTime = time;
        
        // Face player during attack
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        // After 1 second, transition to ball sprite
        this.scene.time.delayedCall(1000, () => {
            if (this.active && this.state === RATState.ATTACK_BALL) {
                this.setTexture('rat-attack-ball');
            }
        });
    }
    
    private handleBallAttack(time: number, bulletGroup: Phaser.GameObjects.Group) {
        // Stay still during attack
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        // Shoot pattern: 1, 3, 5, 7, 9 bullets with spread
        // Phase timing: 1s transition + shoot at 1.2s, 1.4s, 1.6s, 1.8s, 2.0s
        const shootTimes = [1200, 1400, 1600, 1800, 2000];
        const bulletCounts = [1, 3, 5, 7, 9];
        
        const elapsed = time - this.lastAttackTime;
        
        for (let i = 0; i < shootTimes.length; i++) {
            if (elapsed >= shootTimes[i] && this.currentAttackPhase === i) {
                this.shootSpread(bulletGroup, bulletCounts[i]);
                this.currentAttackPhase++;
            }
        }
        
        // End attack after all shots
        if (elapsed >= 2200) {
            this.setTexture('rat-default');
            this.state = RATState.IDLE;
            this.lastAttackTime = this.scene.time.now; // Start cooldown when returning to default
        }
    }
    
    private shootSpread(bulletGroup: Phaser.GameObjects.Group, count: number) {
        const angleToPlayer = Math.atan2(this.player.y - this.y, this.player.x - this.x);
        const spreadAngle = count > 1 ? 0.3 : 0; // ~17 degrees spread per bullet
        const totalSpread = (count - 1) * spreadAngle;
        const startAngle = angleToPlayer - totalSpread / 2;
        
        // Calculate spawn position at bottom of boss (where it faces player)
        // Boss rotation is angleToPlayer - PI/2, so bottom is at rotation + PI/2
        const facingAngle = this.rotation + Math.PI / 2;
        const spawnDistance = 112; // Half of 224 (boss size)
        const spawnX = this.x + Math.cos(facingAngle) * spawnDistance;
        const spawnY = this.y + Math.sin(facingAngle) * spawnDistance;
        
        // Play enemy laser sound
        const volume = (this.scene as any).volumeEnemyLaser || 0.5;
        this.scene.sound.play('enemy_laser', { volume });
        
        for (let i = 0; i < count; i++) {
            const angle = startAngle + i * spreadAngle;
            const velocityX = Math.cos(angle) * 300;
            const velocityY = Math.sin(angle) * 300;
            
            const bullet = new Bullet(this.scene, spawnX, spawnY, velocityX, velocityY, false); // No lifespan for boss bullets
            bullet.setTint(0xff0000); // Red for enemy bullets
            bullet.setDepth(7);
            bulletGroup.add(bullet);
        }
    }
    
    // Ring Attack
    private startRingAttack(time: number) {
        this.state = RATState.ATTACK_RING;
        this.setTexture('rat-attack-no-ball');
        // DON'T stop moving yet - let handleRingAttack do it
        
        // Set attack start time for timing calculations
        this.lastAttackTime = time;
        
        // Face player during attack
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        // After 1 second, transition to ring sprite
        this.scene.time.delayedCall(1000, () => {
            if (this.active && this.state === RATState.ATTACK_RING) {
                this.setTexture('rat-attack-ring');
            }
        });
    }
    
    private handleRingAttack(time: number, bulletGroup: Phaser.GameObjects.Group) {
        // Stay still during attack
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        // Shoot 10 volleys of 2 homing bullets each (20 total), fast
        const elapsed = time - this.lastAttackTime;
        const shootInterval = 100; // Fast shooting
        const firstShotTime = 1200;
        
        const shotNumber = Math.floor((elapsed - firstShotTime) / shootInterval);
        
        if (shotNumber >= 0 && shotNumber < 10 && this.currentAttackPhase === shotNumber) {
            this.shootHomingBullet(bulletGroup);
            this.currentAttackPhase++;
        }
        
        // End attack after all shots
        if (elapsed >= firstShotTime + 10 * shootInterval + 200) {
            this.setTexture('rat-default');
            this.state = RATState.IDLE;
            this.lastAttackTime = this.scene.time.now; // Start cooldown when returning to default
        }
    }
    
    private shootHomingBullet(bulletGroup: Phaser.GameObjects.Group) {
        // Calculate spawn position at bottom of boss (where it faces player)
        const facingAngle = this.rotation + Math.PI / 2;
        const spawnDistance = 112; // Half of 224 (boss size)
        const baseSpawnX = this.x + Math.cos(facingAngle) * spawnDistance;
        const baseSpawnY = this.y + Math.sin(facingAngle) * spawnDistance;
        
        // Aim at player
        const angleToPlayer = Math.atan2(this.player.y - this.y, this.player.x - this.x);
        const bulletSpeed = 300; // Increased from 250
        const velocityX = Math.cos(angleToPlayer) * bulletSpeed;
        const velocityY = Math.sin(angleToPlayer) * bulletSpeed;
        
        // Play enemy laser sound
        const volume = (this.scene as any).volumeEnemyLaser || 0.5;
        this.scene.sound.play('enemy_laser', { volume });
        
        // Spawn two bullets with perpendicular spacing (like 20/20)
        const spacing = 20; // Increased from 10
        
        // Calculate perpendicular offset (perpendicular to facing direction)
        const perpX = -Math.sin(facingAngle);
        const perpY = Math.cos(facingAngle);
        
        // First bullet (offset to one side)
        const bullet1 = new Bullet(
            this.scene,
            baseSpawnX + perpX * spacing,
            baseSpawnY + perpY * spacing,
            velocityX,
            velocityY,
            false
        );
        bullet1.setTint(0xff0000);
        bullet1.setDepth(7);
        bulletGroup.add(bullet1);
        bullet1.setData('isHoming', true);
        bullet1.setData('homingEndTime', this.scene.time.now + 750);
        bullet1.setData('homingTarget', this.player);
        bullet1.setData('bulletSpeed', bulletSpeed);
        
        // Second bullet (offset to the other side)
        const bullet2 = new Bullet(
            this.scene,
            baseSpawnX - perpX * spacing,
            baseSpawnY - perpY * spacing,
            velocityX,
            velocityY,
            false
        );
        bullet2.setTint(0xff0000);
        bullet2.setDepth(7);
        bulletGroup.add(bullet2);
        bullet2.setData('isHoming', true);
        bullet2.setData('homingEndTime', this.scene.time.now + 750);
        bullet2.setData('homingTarget', this.player);
        bullet2.setData('bulletSpeed', bulletSpeed);
    }
    
    // Defense
    private startDefense(time: number) {
        this.state = RATState.DEFENSE;
        this.setTexture('rat-defense-no-wall');
        // DON'T stop moving yet - let handleDefense do it
        this.defenseStartTime = time;
        
        // Face player during attack
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        // After 0.5 seconds, transition to wall sprite
        this.scene.time.delayedCall(500, () => {
            if (this.active && this.state === RATState.DEFENSE) {
                this.setTexture('rat-defense-with-wall');
                
                // Play deflecting sound
                const volume = (this.scene as any).volumeRatDeflecting || 0.5;
                this.deflectingSound = this.scene.sound.add('rat_deflecting', { loop: true, volume });
                this.deflectingSound.play();
            }
        });
    }
    
    private handleDefense(time: number) {
        // Stay still during defense
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        // Always face the player during defense
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        const elapsed = time - this.defenseStartTime;
        
        // End defense after 3.5 seconds total (0.5s transition + 3s with wall)
        if (elapsed >= this.defenseDuration) {
            this.setTexture('rat-default');
            this.state = RATState.IDLE;
            this.lastAttackTime = this.scene.time.now; // Start cooldown when returning to default
            
            // Stop deflecting sound
            if (this.deflectingSound) {
                this.deflectingSound.stop();
                this.deflectingSound = null;
            }
        }
    }
    
    isDefending(): boolean {
        return this.state === RATState.DEFENSE && this.texture.key === 'rat-defense-with-wall';
    }
    
    // Charge Attack
    private startCharge(_time: number) {
        this.state = RATState.CHARGING;
        // DON'T stop moving yet - let handleCharging do it
        this.blinkCount = 0;
        
        // Face player before charging
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        // Start blinking
        this.scene.time.addEvent({
            delay: 150,
            repeat: this.maxBlinks * 2 - 1,
            callback: () => {
                if (this.active && this.state === RATState.CHARGING) {
                    const isFlash = this.blinkCount % 2 === 1;
                    this.setTexture(isFlash ? 'rat-flash' : 'rat-default');
                    this.blinkCount++;
                }
            }
        });
    }
    
    private handleCharging(time: number, dx: number, dy: number) {
        // Stay still during charging
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        // Keep facing the player while charging
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        // After 3 blinks (6 texture changes), pause before dash
        if (this.blinkCount >= this.maxBlinks * 2) {
            // Transition to pause
            this.state = RATState.CHARGE_PAUSING;
            this.chargePauseStartTime = time;
            
            // Calculate and store dash direction
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                this.dashVelocityX = (dx / distance) * this.dashSpeed;
                this.dashVelocityY = (dy / distance) * this.dashSpeed;
            }
        }
    }
    
    private handleChargePausing(time: number, dx: number, dy: number) {
        // Stay still during pause before dash
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        // Keep facing the player during pause
        const angleToPlayer = Math.atan2(dy, dx);
        this.rotateTowards(angleToPlayer - Math.PI / 2);
        
        const elapsed = time - this.chargePauseStartTime;
        
        if (elapsed >= this.chargePauseDuration) {
            // Start dash
            this.state = RATState.DASHING;
            this.setTexture('rat-attack-no-ball');
            
            // Play dash sound directly
            const volume = (this.scene as any).volumeRatDash || 0.5;
            this.scene.sound.play('rat_dash', { volume });
        }
    }
    
    private handleDashing(time: number) {
        const body = this.body as Phaser.Physics.Arcade.Body;
        
        // ALWAYS apply dash velocity - ignore any external interference
        body.setVelocity(this.dashVelocityX, this.dashVelocityY);
        
        // Apply friction to gradually slow down
        this.dashVelocityX *= this.dashFriction;
        this.dashVelocityY *= this.dashFriction;
        
        const currentSpeed = Math.sqrt(
            this.dashVelocityX * this.dashVelocityX +
            this.dashVelocityY * this.dashVelocityY
        );
        
        // When speed is low enough, transition to paused (same threshold as Dasher enemy)
        if (currentSpeed < 50) {
            this.state = RATState.PAUSED;
            this.setTexture('rat-pause');
            body.setVelocity(0, 0);
            this.dashVelocityX = 0;
            this.dashVelocityY = 0;
            this.pauseStartTime = time;
            
            // Stop dash sound
            this.scene.sound.stopByKey('rat_dash');
        }
    }
    
    private handlePaused(time: number) {
        // Stay still during pause (no rotation)
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        
        const elapsed = time - this.pauseStartTime;
        
        if (elapsed >= this.pauseDuration) {
            this.setTexture('rat-default');
            this.state = RATState.IDLE;
            this.lastAttackTime = this.scene.time.now; // Start cooldown when returning to default
        }
    }
    
    canBeHitBySword(swordNumber: 1 | 2): boolean {
        const currentTime = this.scene.time.now;
        if (swordNumber === 1) {
            return currentTime - this.lastSwordHitTime1 >= this.swordCooldown;
        } else {
            return currentTime - this.lastSwordHitTime2 >= this.swordCooldown;
        }
    }
    
    recordSwordHit(swordNumber: 1 | 2) {
        const currentTime = this.scene.time.now;
        if (swordNumber === 1) {
            this.lastSwordHitTime1 = currentTime;
        } else {
            this.lastSwordHitTime2 = currentTime;
        }
    }
}

export default RATBoss;
