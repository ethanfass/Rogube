import Phaser from 'phaser';
import Bullet from './Bullet';

export type WeaponType = 'gun' | 'sword';

export default class Player extends Phaser.Physics.Arcade.Image {
    private speed: number = 200;
    private lastShotTime: number = 0;
    private power: number = 3; // Starting power
    private maxPower: number = 3;
    private isInvincible: boolean = false;
    private coins: number = 0;
    
    // Stats
    private damage: number = 1;
    private shotSpeed: number = 500;
    private shotRate: number = 300; // milliseconds (lower = faster)
    private swingRate: number = 300; // milliseconds between swings (lower = faster) - matches shot rate
    private luck: number = 0; // Starting luck
    private hasTwentyTwenty: boolean = false; // 20/20 item - shoot 2 shots at once
    private hasHoming: boolean = false; // Homing shots item - bullets seek enemies
    private invincibilityDuration: number = 1000; // 1 second of invincibility
    private blinkTimer: Phaser.Time.TimerEvent | null = null;
    private lastShootDirectionX: number = 1; // Track last shooting direction (default right)
    private lastShootDirectionY: number = 0; // Track last vertical shooting direction
    private facingAngle: number = 0; // Current facing angle based on mouse
    
    // Upgrade tracking for sword conversion
    private shotSpeedUpgrades: number = 0; // Track how many shot speed upgrades
    private shotRateUpgrades: number = 0; // Track how many shot rate upgrades
    
    // Weapon system
    private weaponType: WeaponType = 'gun';
    private swordDamage: number = 3; // Sword does 3 damage per hit
    private lastSlashTime: number = 0;
    private slashFromRight: boolean = true; // Alternates each slash
    private swordSprite: Phaser.Physics.Arcade.Image | null = null;
    private secondSwordSprite: Phaser.Physics.Arcade.Image | null = null; // For 20/20 dual swords
    private isSlashing: boolean = false;
    private swordKnockbackStrength: number = 425; // Knockback force for sword hits (increased!)
    private bladeLength: number = 1; // Blade length level (1-5)
    private swingCounter: number = 0; // Track swings for Arkhalis + Bullseye synergy

    constructor(scene: Phaser.Scene, x: number, y: number, weaponType: WeaponType = 'gun') {
        super(scene, x, y, 'cymon');
        
        this.weaponType = weaponType;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set pixel-perfect rendering for player sprite
        const texture = scene.textures.get('cymon');
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Use setDisplaySize instead of setScale to avoid physics body scaling
        // 8x8 sprite scaled to 40x40 (scale 5) for pixel-perfect rendering
        this.setDisplaySize(40, 40);
        this.setOrigin(0.5, 0.5);
        
        // Round position to whole pixels to prevent sub-pixel jitter
        this.x = Math.round(x);
        this.y = Math.round(y);
        
        // Set physics body size to match original sprite (8x8)
        // Since we used setDisplaySize (not setScale), the body won't be auto-scaled
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 8); // 8x8 original sprite size - exact collision
        body.setCollideWorldBounds(true);
        
        // Create sword sprite if using sword weapon (always visible, resting at side)
        if (this.weaponType === 'sword') {
            // Make sword a PHYSICS sprite just like player for identical rendering
            const sideOffset = 20;
            const initialX = x + sideOffset; // Start on right side
            const initialY = y - 10;
            
            this.swordSprite = scene.physics.add.image(initialX, initialY, 'sword');
            this.updateSwordSprite();
            // Origin at handle (bottom-left corner of sprite)
            this.swordSprite.setOrigin(0, 1);
            this.swordSprite.setDepth(11); // Above player
            this.swordSprite.setVisible(true); // Always visible
            
            // Set up physics body - keep it enabled but no collisions
            const swordBody = this.swordSprite.body as Phaser.Physics.Arcade.Body;
            swordBody.setSize(8, 8); // Match original sprite
            swordBody.setCollideWorldBounds(false);
            
            // Set pixel-perfect rendering for sword
            const swordTexture = scene.textures.get('sword');
            if (swordTexture) {
                swordTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
            
            // Initialize facing direction to match default sprite (down)
            this.lastShootDirectionX = 0;
            this.lastShootDirectionY = 1; // Facing down
            
            // Set initial position and angle using updateSwordRestPosition
            this.updateSwordRestPosition();
        }
    }

    getPower(): number {
        return this.power;
    }

    getMaxPower(): number {
        return this.maxPower;
    }

    getDamage(): number {
        return this.damage;
    }

    getShotSpeed(): number {
        return this.shotSpeed;
    }

    getShotRate(): number {
        return this.shotRate;
    }

    getSwingRate(): number {
        return this.swingRate;
    }

    getMovementSpeed(): number {
        return this.speed;
    }

    getLuck(): number {
        return this.luck;
    }

    getCoins(): number {
        return this.coins;
    }

    addCoins(amount: number) {
        this.coins += amount;
    }

    spendCoins(amount: number): boolean {
        if (this.coins >= amount) {
            this.coins -= amount;
            return true;
        }
        return false;
    }

    upgradeDamage() {
        this.damage *= 1.5;
    }

    upgradeShotSpeed() {
        this.shotSpeed *= 1.5;
        this.shotSpeedUpgrades++;
    }

    upgradeShotRate() {
        // Lower shot rate = faster shooting, so divide by 1.5
        this.shotRate /= 1.5;
        this.shotRateUpgrades++;
    }

    upgradeSwingRate() {
        // Lower swing rate = faster swinging, so divide by 1.5
        this.swingRate /= 1.5;
    }

    upgradeMoveSpeed() {
        this.speed *= 1.5;
    }

    upgradeLuck() {
        this.luck += 1; // Additive: 0 → 1 → 2 → 3
    }

    upgradeMaxPower() {
        this.maxPower += 1;
        this.power += 1; // Also heal when picking up
    }

    enableTwentyTwenty() {
        this.hasTwentyTwenty = true;
        
        // If using sword, create a second sword in the other hand
        if (this.weaponType === 'sword' && this.swordSprite && !this.secondSwordSprite) {
            const sideOffset = 20;
            const initialX = this.x - sideOffset; // Start on left side (opposite of first sword)
            const initialY = this.y - 10;
            
            this.secondSwordSprite = this.scene.physics.add.image(initialX, initialY, 'sword');
            this.updateSwordSprite(); // Update texture for current blade length
            
            // Update second sword to match first sword
            const spriteKey = this.bladeLength === 1 ? 'sword' : `swordlvl${this.bladeLength}`;
            const spriteFileSize = this.bladeLength === 1 ? 8 : 16;
            const displaySize = spriteFileSize * 4;
            
            this.secondSwordSprite.setTexture(spriteKey);
            this.secondSwordSprite.setDisplaySize(displaySize, displaySize);
            this.secondSwordSprite.setOrigin(0, 1);
            this.secondSwordSprite.setDepth(11);
            this.secondSwordSprite.setVisible(true);
            
            const swordBody = this.secondSwordSprite.body as Phaser.Physics.Arcade.Body;
            swordBody.setSize(spriteFileSize, spriteFileSize);
            swordBody.setCollideWorldBounds(false);
            
            const texture = this.scene.textures.get(spriteKey);
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
            
            // Snap to initial position immediately (no interpolation on first appearance)
            this.snapSecondSwordToRestPosition();
        }
    }

    hasTwentyTwentyItem(): boolean {
        return this.hasTwentyTwenty;
    }

    enableHoming() {
        this.hasHoming = true;
    }

    hasHomingItem(): boolean {
        return this.hasHoming;
    }

    takeDamage(amount: number = 1): boolean {
        // Return true if damage was taken, false if invincible
        if (this.isInvincible) {
            return false;
        }

        // Check if this will kill the player
        const willDie = this.power - amount <= 0;
        
        this.power = Math.max(0, this.power - amount);
        
        // Only play damage sound if not dying (if dying, only game over sound plays)
        if (!willDie) {
            const volume = (this.scene as any).volumeCymonHpDown || 0.5;
            this.scene.sound.play('cymon_hp_down', { volume });
        }
        
        // Start invincibility and blinking
        this.isInvincible = true;
        this.startBlinking();
        
        // End invincibility after duration
        this.scene.time.delayedCall(this.invincibilityDuration, () => {
            this.isInvincible = false;
            this.stopBlinking();
        });

        return true;
    }

    addPower(amount: number = 1) {
        this.power = Math.min(this.maxPower, this.power + amount);
    }

    private startBlinking() {
        this.stopBlinking(); // Clear any existing timer
        
        let visible = true;
        this.blinkTimer = this.scene.time.addEvent({
            delay: 100, // Blink every 100ms
            callback: () => {
                this.setAlpha(visible ? 0.3 : 1);
                visible = !visible;
            },
            repeat: Math.floor(this.invincibilityDuration / 100) - 1
        });
    }

    private stopBlinking() {
        if (this.blinkTimer) {
            this.blinkTimer.destroy();
            this.blinkTimer = null;
        }
        this.setAlpha(1); // Make sure player is visible
    }

    isDead(): boolean {
        return this.power <= 0;
    }

    move(directionX: number, directionY: number) {
        // Normalize diagonal movement
        if (directionX !== 0 && directionY !== 0) {
            directionX *= 0.707; // 1/sqrt(2) for diagonal normalization
            directionY *= 0.707;
        }

        const velocityX = directionX * this.speed;
        const velocityY = directionY * this.speed;
        
        this.setVelocity(velocityX, velocityY);
        
        // Move sword(s) with EXACT same velocity as player
        if (this.swordSprite && this.swordSprite.body) {
            (this.swordSprite.body as Phaser.Physics.Arcade.Body).setVelocity(velocityX, velocityY);
        }
        if (this.secondSwordSprite && this.secondSwordSprite.body) {
            (this.secondSwordSprite.body as Phaser.Physics.Arcade.Body).setVelocity(velocityX, velocityY);
        }
    }
    
    updateFacingDirection(mouseX: number, mouseY: number) {
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        this.facingAngle = Math.atan2(dy, dx);
        // Subtract PI/2 to account for sprite's default facing direction (flipped 180 from initial)
        this.setRotation(this.facingAngle - Math.PI / 2);
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            this.lastShootDirectionX = dx / length;
            this.lastShootDirectionY = dy / length;
        }
    }
    
    shoot(bulletGroup: Phaser.GameObjects.Group, enemyGroup?: Phaser.GameObjects.Group) {
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastShotTime < this.shotRate) {
            return;
        }
        
        this.lastShotTime = currentTime;
        
        // Play shoot sound
        const volume = (this.scene as any).volumeCymonLaser || 0.5;
        this.scene.sound.play('cymon_laser', { volume });
        
        // Use facing angle to shoot
        const velocityX = Math.cos(this.facingAngle) * this.shotSpeed;
        const velocityY = Math.sin(this.facingAngle) * this.shotSpeed;
        
        // Create bullet at player position with velocity
        const bullet1 = new Bullet(this.scene, this.x, this.y, velocityX, velocityY);
        bullet1.setTint(0x00ff00); // Green for player bullets
        bullet1.setDepth(9);
        
        // Enable homing if player has the upgrade
        if (this.hasHoming && enemyGroup) {
            bullet1.setHoming(true, enemyGroup);
        }
        
        bulletGroup.add(bullet1);
        
        // If player has 20/20, shoot second bullet
        if (this.hasTwentyTwenty) {
            const bullet2 = new Bullet(this.scene, this.x, this.y, velocityX, velocityY);
            bullet2.setTint(0x00ff00);
            bullet2.setDepth(9);
            
            if (this.hasHoming && enemyGroup) {
                bullet2.setHoming(true, enemyGroup);
            }
            
            bulletGroup.add(bullet2);
        }
    }

    shootDirection(directionX: number, directionY: number, bulletGroup: Phaser.GameObjects.Group, enemyGroup?: Phaser.GameObjects.Group) {
        // Update sprite facing direction FIRST, even if on cooldown
        // Normalize direction (should already be -1, 0, or 1, but normalize just in case)
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        let normalizedX = 0;
        let normalizedY = 0;
        
        if (length > 0) {
            normalizedX = directionX / length;
            normalizedY = directionY / length;
            
            // Update sprite facing direction based on shooting direction
            // Use different sprites for each direction (cymon.png faces down by default)
            if (normalizedX !== 0) {
                this.lastShootDirectionX = normalizedX;
                // Change texture based on horizontal direction
                if (normalizedX > 0) {
                    this.setTexture('cymon-right'); // Right
                } else {
                    this.setTexture('cymon-left'); // Left
                }
            } else if (normalizedY !== 0) {
                this.lastShootDirectionY = normalizedY;
                // Change texture based on vertical direction
                if (normalizedY < 0) {
                    this.setTexture('cymon-up'); // Up
                } else {
                    this.setTexture('cymon'); // Down (default)
                }
            }
        }
        
        const currentTime = this.scene.time.now;
        
        if (currentTime - this.lastShotTime < this.shotRate) {
            return; // Still on cooldown (but facing direction already updated)
        }

        this.lastShotTime = currentTime;

        // Create bullets if we have a valid direction
        if (length > 0) {
            
            if (this.hasTwentyTwenty) {
                // Shoot 2 bullets - one slightly left, one slightly right
                const offsetDistance = 8; // Distance to offset bullets
                // Perpendicular vector for offset (rotate 90 degrees)
                const perpX = -normalizedY; // Perpendicular X
                const perpY = normalizedX;  // Perpendicular Y
                
                // Left bullet
                const leftBullet = new Bullet(
                    this.scene,
                    this.x + perpX * offsetDistance,
                    this.y + perpY * offsetDistance,
                    normalizedX * this.shotSpeed,
                    normalizedY * this.shotSpeed
                );
                leftBullet.setTint(0x33FF00); // Green for player bullets
                leftBullet.setDepth(7);
                if (this.hasHoming && enemyGroup) {
                    leftBullet.setHoming(true, enemyGroup);
                }
                bulletGroup.add(leftBullet);
                
                // Right bullet
                const rightBullet = new Bullet(
                    this.scene,
                    this.x - perpX * offsetDistance,
                    this.y - perpY * offsetDistance,
                    normalizedX * this.shotSpeed,
                    normalizedY * this.shotSpeed
                );
                rightBullet.setTint(0x33FF00); // Green for player bullets
                rightBullet.setDepth(7);
                if (this.hasHoming && enemyGroup) {
                    rightBullet.setHoming(true, enemyGroup);
                }
                bulletGroup.add(rightBullet);
            } else {
                // Normal single bullet
                const bullet = new Bullet(
                    this.scene,
                    this.x,
                    this.y,
                    normalizedX * this.shotSpeed, // velocity x
                    normalizedY * this.shotSpeed  // velocity y
                );
                bullet.setTint(0x33FF00); // Green for player bullets
                bullet.setDepth(7); // Above enemies, below player
                if (this.hasHoming && enemyGroup) {
                    bullet.setHoming(true, enemyGroup);
                }
                bulletGroup.add(bullet);
            }
        }
    }

    // Sword-specific methods
    switchToSword() {
        // Already have a sword, do nothing
        if (this.weaponType === 'sword') {
            return;
        }
        
        // Switch weapon type
        this.weaponType = 'sword';
        
        // Convert shot rate upgrades → swing rate upgrades
        for (let i = 0; i < this.shotRateUpgrades; i++) {
            this.swingRate /= 1.5;
        }
        
        // Convert shot speed upgrades → blade length upgrades
        this.bladeLength = 1 + this.shotSpeedUpgrades;
        
        // If had 20/20, enable dual swords (create second sword sprite)
        if (this.hasTwentyTwenty) {
            // Second sword will be created when we create the first sword
        }
        
        // Create sword sprites
        const sideOffset = 20;
        const initialX = this.x + sideOffset;
        const initialY = this.y - 10;
        
        this.swordSprite = this.scene.physics.add.image(initialX, initialY, 'sword');
        this.updateSwordSprite();
        this.swordSprite.setOrigin(0, 1);
        this.swordSprite.setDepth(11);
        this.swordSprite.setVisible(true);
        
        // Set pixel-perfect rendering for sword
        const swordTexture = this.scene.textures.get('sword');
        if (swordTexture) {
            swordTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // If has 20/20, create second sword
        if (this.hasTwentyTwenty) {
            this.secondSwordSprite = this.scene.physics.add.image(initialX, initialY, 'sword');
            this.updateSwordSprite();
            this.secondSwordSprite.setOrigin(0, 1);
            this.secondSwordSprite.setDepth(11);
            this.secondSwordSprite.setVisible(true);
        }
    }
    
    getWeaponType(): WeaponType {
        return this.weaponType;
    }

    getSwordDamage(): number {
        return this.swordDamage;
    }

    getSwordKnockback(): number {
        return this.swordKnockbackStrength;
    }
    
    getBladeLength(): number {
        return this.bladeLength;
    }
    
    getSwordSprite(): Phaser.Physics.Arcade.Image | null {
        return this.swordSprite;
    }
    
    getSecondSwordSprite(): Phaser.Physics.Arcade.Image | null {
        return this.secondSwordSprite;
    }

    isCurrentlySlashing(): boolean {
        return this.isSlashing;
    }

    upgradeSwordDamage() {
        this.swordDamage *= 1.5;
    }
    
    upgradeBladeLength() {
        if (this.bladeLength < 5) {
            this.bladeLength += 1;
            this.updateSwordSprite();
        }
    }
    
    // Update sword sprite based on blade length
    private updateSwordSprite() {
        if (!this.swordSprite) return;
        
        // Determine sprite key based on blade length
        const spriteKey = this.bladeLength === 1 ? 'sword' : `swordlvl${this.bladeLength}`;
        this.swordSprite.setTexture(spriteKey);
        
        // Sprite file sizes:
        // Level 1: 8x8 file
        // Level 2-5: 16x16 files (with sword pixels placed on the canvas)
        const spriteFileSize = this.bladeLength === 1 ? 8 : 16;
        const displaySize = spriteFileSize * 4; // Always 4x scale
        this.swordSprite.setDisplaySize(displaySize, displaySize);
        
        // Update physics body size to match sprite file
        const swordBody = this.swordSprite.body as Phaser.Physics.Arcade.Body;
        swordBody.setSize(spriteFileSize, spriteFileSize);
        
        // Set pixel-perfect rendering
        const texture = this.scene.textures.get(spriteKey);
        if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Also update second sword if it exists (20/20)
        if (this.secondSwordSprite) {
            this.secondSwordSprite.setTexture(spriteKey);
            this.secondSwordSprite.setDisplaySize(displaySize, displaySize);
            
            const secondSwordBody = this.secondSwordSprite.body as Phaser.Physics.Arcade.Body;
            secondSwordBody.setSize(spriteFileSize, spriteFileSize);
            
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
        }
    }
    
    // Get pixel map for current blade length
    getSwordPixelMap(): Array<[number, number]> {
        const level = this.bladeLength;
        const offset = (level - 1) * 2; // How many rows to shift down
        
        // Base level 1 pattern (8x8)
        const basePixels: Array<[number, number]> = [
            // Row 0
            [6, 0], [7, 0],
            // Row 1
            [5, 1], [6, 1], [7, 1],
            // Row 2
            [4, 2], [5, 2], [6, 2],
            // Row 3
            [1, 3], [3, 3], [4, 3], [5, 3],
            // Row 4
            [1, 4], [2, 4], [3, 4], [4, 4],
            // Row 5
            [1, 5], [2, 5], [3, 5],
            // Row 6
            [0, 6], [1, 6], [2, 6], [3, 6], [4, 6],
            // Row 7
            [0, 7], [1, 7]
        ];
        
        // Shift base pixels down by offset
        const shiftedPixels = basePixels.map(([x, y]) => [x, y + offset] as [number, number]);
        
        // Add new rows for each level above 1
        const newPixels: Array<[number, number]> = [];
        for (let lvl = 2; lvl <= level; lvl++) {
            const rowOffset = (lvl - 2) * 2; // Which pair of rows we're adding
            const baseX = 6 + (lvl - 1) * 2; // Starting X for this level
            
            // Top row: 2 pixels
            newPixels.push([baseX, rowOffset]);
            newPixels.push([baseX + 1, rowOffset]);
            
            // Second row: 3 pixels
            newPixels.push([baseX - 1, rowOffset + 1]);
            newPixels.push([baseX, rowOffset + 1]);
            newPixels.push([baseX + 1, rowOffset + 1]);
        }
        
        return [...newPixels, ...shiftedPixels];
    }
    

    slashDirection(directionX: number, directionY: number, onHit: (hitbox: { x: number, y: number, width: number, height: number, direction: { x: number, y: number } }) => void, bulletGroup?: Phaser.GameObjects.Group, enemyGroup?: Phaser.GameObjects.Group) {
        // Update sprite facing direction FIRST, even if on cooldown
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        let normalizedX = 0;
        let normalizedY = 0;
        
        if (length > 0) {
            normalizedX = directionX / length;
            normalizedY = directionY / length;
            
            // Update facing direction for sword positioning
            this.lastShootDirectionX = normalizedX;
            this.lastShootDirectionY = normalizedY;
            
            // Always use default cymon sprite (no direction switching for mouse movement)
            this.setTexture('cymon');
            
            // Update sword rest position immediately when facing changes
            if (this.swordSprite && !this.isSlashing) {
                this.updateSwordRestPosition();
            }
            // Also update second sword if it exists
            if (this.secondSwordSprite && !this.isSlashing) {
                this.updateSecondSwordRestPosition();
            }
        }
        
        const currentTime = this.scene.time.now;
        
        if (currentTime - this.lastSlashTime < this.swingRate || this.isSlashing) {
            return; // Still on cooldown or mid-slash
        }

        if (length === 0) return; // No direction

        this.lastSlashTime = currentTime;
        this.isSlashing = true;

        // Slash animation - swing across face (90° arc)
        if (this.swordSprite) {
            // Calculate facing angle in radians (-90° for UP to use as reference)
            const facingAngleRad = Math.atan2(this.lastShootDirectionY, this.lastShootDirectionX);
            const facingAngleDeg = facingAngleRad * (180 / Math.PI);
            
            // Base angles for facing UP (-90° facing)
            const upStartAngle = 0;
            const upEndAngle = -90;
            
            // Rotate these angles by how much we've turned from UP
            const rotationOffset = facingAngleDeg - (-90); // How much to rotate from UP reference
            const startAngle = this.slashFromRight ? (upStartAngle + rotationOffset) : (upEndAngle + rotationOffset);
            const endAngle = this.slashFromRight ? (upEndAngle + rotationOffset) : (upStartAngle + rotationOffset);
            
            // Constants for swing motion
            const sideOffset = 20;
            const extendDistance = 7.5;
            
            this.scene.tweens.add({
                targets: { angle: startAngle },
                angle: endAngle,
                duration: 150,
                ease: 'Sine.easeInOut',
                onUpdate: (tween) => {
                    if (!this.swordSprite) return;
                    
                    const progress = tween.progress;
                    const currentAngle = startAngle + (progress * (endAngle - startAngle));
                    
                    // Original motion for UP direction
                    const startHandleX = this.slashFromRight ? sideOffset : -sideOffset;
                    const endHandleX = this.slashFromRight ? -sideOffset : sideOffset;
                    const currentHandleOffsetX = startHandleX + (progress * (endHandleX - startHandleX));
                    const arcOffset = Math.sin(progress * Math.PI) * extendDistance;
                    
                    // Position in "UP-facing" coordinate space
                    const localX = currentHandleOffsetX;
                    const localY = -10 - arcOffset;
                    
                    // Rotate by facing direction
                    const rotationRad = facingAngleRad - (-Math.PI / 2); // Rotation from UP
                    const rotatedX = localX * Math.cos(rotationRad) - localY * Math.sin(rotationRad);
                    const rotatedY = localX * Math.sin(rotationRad) + localY * Math.cos(rotationRad);
                    
                    this.swordSprite.x = this.x + rotatedX;
                    this.swordSprite.y = this.y + rotatedY;
                    this.swordSprite.angle = currentAngle;
                },
                onComplete: () => {
                    this.isSlashing = false;
                    this.slashFromRight = !this.slashFromRight; // Alternate direction for next slash
                    // Snap to rest position immediately (no interpolation)
                    this.snapSwordToRestPosition();
                    
                    // Arkhalis + Bullseye synergy: shoot homing bullet every 3rd swing
                    if (this.weaponType === 'sword' && this.hasHoming && bulletGroup && enemyGroup) {
                        this.swingCounter++;
                        if (this.swingCounter >= 3) {
                            this.swingCounter = 0;
                            
                            // Play shoot sound for sword synergy bullet
                            const volume = (this.scene as any).volumeCymonLaser || 0.5;
        this.scene.sound.play('cymon_laser', { volume });
                            
                            // Shoot bullet in the direction player is facing
                            const velocityX = Math.cos(facingAngleRad) * this.shotSpeed;
                            const velocityY = Math.sin(facingAngleRad) * this.shotSpeed;
                            
                            // Spawn bullets in front of player
                            const forwardOffset = 50;
                            const spawnX = this.x + Math.cos(facingAngleRad) * forwardOffset;
                            const spawnY = this.y + Math.sin(facingAngleRad) * forwardOffset;
                            
                            if (this.hasTwentyTwenty) {
                                // If player has 20/20, shoot two bullets with perpendicular spacing
                                const spacing = 8; // Distance between bullets
                                
                                // Calculate perpendicular offset (perpendicular to facing direction)
                                const perpX = -Math.sin(facingAngleRad);
                                const perpY = Math.cos(facingAngleRad);
                                
                                // First bullet (offset to one side)
                                const bullet1 = new Bullet(
                                    this.scene,
                                    spawnX + perpX * spacing,
                                    spawnY + perpY * spacing,
                                    velocityX,
                                    velocityY
                                );
                                bullet1.setTint(0x00ff00);
                                bullet1.setDepth(9);
                                bullet1.setHoming(true, enemyGroup);
                                bulletGroup.add(bullet1);
                                
                                // Second bullet (offset to the other side)
                                const bullet2 = new Bullet(
                                    this.scene,
                                    spawnX - perpX * spacing,
                                    spawnY - perpY * spacing,
                                    velocityX,
                                    velocityY
                                );
                                bullet2.setTint(0x00ff00);
                                bullet2.setDepth(9);
                                bullet2.setHoming(true, enemyGroup);
                                bulletGroup.add(bullet2);
                            } else {
                                // Single bullet
                                const bullet1 = new Bullet(this.scene, spawnX, spawnY, velocityX, velocityY);
                                bullet1.setTint(0x00ff00);
                                bullet1.setDepth(9);
                                bullet1.setHoming(true, enemyGroup);
                                bulletGroup.add(bullet1);
                            }
                        }
                    }
                }
            });
            
            // Animate second sword if it exists (20/20 dual wielding) - swings in OPPOSITE direction
            if (this.secondSwordSprite) {
                // Second sword swings in opposite direction (crosses the first sword)
                const secondStartAngle = !this.slashFromRight ? (upStartAngle + rotationOffset) : (upEndAngle + rotationOffset);
                const secondEndAngle = !this.slashFromRight ? (upEndAngle + rotationOffset) : (upStartAngle + rotationOffset);
                
                this.scene.tweens.add({
                    targets: { angle: secondStartAngle },
                    angle: secondEndAngle,
                    duration: 150,
                    ease: 'Sine.easeInOut',
                    onUpdate: (tween) => {
                        if (!this.secondSwordSprite) return;
                        
                        const progress = tween.progress;
                        const currentAngle = secondStartAngle + (progress * (secondEndAngle - secondStartAngle));
                        
                        // Opposite motion from first sword
                        const startHandleX = !this.slashFromRight ? sideOffset : -sideOffset; // Opposite
                        const endHandleX = !this.slashFromRight ? -sideOffset : sideOffset; // Opposite
                        const currentHandleOffsetX = startHandleX + (progress * (endHandleX - startHandleX));
                        const arcOffset = Math.sin(progress * Math.PI) * extendDistance;
                        
                        // Position in "UP-facing" coordinate space
                        const localX = currentHandleOffsetX;
                        const localY = -10 - arcOffset;
                        
                        // Rotate by facing direction
                        const rotationRad = facingAngleRad - (-Math.PI / 2); // Rotation from UP
                        const rotatedX = localX * Math.cos(rotationRad) - localY * Math.sin(rotationRad);
                        const rotatedY = localX * Math.sin(rotationRad) + localY * Math.cos(rotationRad);
                        
                        this.secondSwordSprite.x = this.x + rotatedX;
                        this.secondSwordSprite.y = this.y + rotatedY;
                        this.secondSwordSprite.angle = currentAngle;
                    },
                    onComplete: () => {
                        // Snap second sword to rest position immediately (no interpolation)
                        this.snapSecondSwordToRestPosition();
                    }
                });
            }
            
            // Create hitbox that covers the visible sword pixels
            // Call onHit multiple times during the slash animation to check continuously
            this.scene.time.addEvent({
                delay: 16, // Check every frame (~60fps)
                repeat: 9, // 150ms slash / 16ms = ~9 frames
                callback: () => {
                    if (this.swordSprite) {
                        // Sword origin is (0, 1) - handle at bottom-left
                        // Calculate center based on actual sprite file size
                        const spriteFileSize = this.bladeLength === 1 ? 8 : 16;
                        const displaySize = spriteFileSize * 4;
                        const halfSize = displaySize / 2;
                        const swordCenterX = this.swordSprite.x + halfSize;
                        const swordCenterY = this.swordSprite.y - halfSize;
                        
                        onHit({
                            x: swordCenterX,
                            y: swordCenterY,
                            width: 48, // Large hitbox to ensure all sword pixels hit
                            height: 48, // Large hitbox to ensure all sword pixels hit
                            direction: { x: normalizedX, y: normalizedY }
                        });
                    }
                }
            });
        }
    }

    // Snap sword to rest position immediately (no interpolation)
    private snapSwordToRestPosition() {
        if (!this.swordSprite) return;
        
        // Calculate facing angle
        const facingAngleRad = Math.atan2(this.lastShootDirectionY, this.lastShootDirectionX);
        const facingAngleDeg = facingAngleRad * (180 / Math.PI);
        
        // Position in "UP-facing" coordinate space
        const sideDistance = 20;
        const localX = this.slashFromRight ? sideDistance : -sideDistance;
        const localY = -10;
        
        // Rotate by facing direction
        const rotationRad = facingAngleRad - (-Math.PI / 2); // Rotation from UP
        const rotatedX = localX * Math.cos(rotationRad) - localY * Math.sin(rotationRad);
        const rotatedY = localX * Math.sin(rotationRad) + localY * Math.cos(rotationRad);
        
        // Snap to position immediately
        this.swordSprite.x = this.x + rotatedX;
        this.swordSprite.y = this.y + rotatedY;
        
        // Calculate resting angle
        const upBaseAngle = this.slashFromRight ? 0 : -90;
        const rotationOffset = facingAngleDeg - (-90); // How much to rotate from UP reference
        const angleInDegrees = upBaseAngle + rotationOffset;
        
        this.swordSprite.angle = angleInDegrees;
    }

    // Update sword rest position (at the side where it was last swung)
    updateSwordRestPosition() {
        if (!this.swordSprite || this.isSlashing) return;
        
        // Calculate facing angle
        const facingAngleRad = Math.atan2(this.lastShootDirectionY, this.lastShootDirectionX);
        const facingAngleDeg = facingAngleRad * (180 / Math.PI);
        
        // Position in "UP-facing" coordinate space
        const sideDistance = 20;
        const localX = this.slashFromRight ? sideDistance : -sideDistance;
        const localY = -10;
        
        // Rotate by facing direction
        const rotationRad = facingAngleRad - (-Math.PI / 2); // Rotation from UP
        const rotatedX = localX * Math.cos(rotationRad) - localY * Math.sin(rotationRad);
        const rotatedY = localX * Math.sin(rotationRad) + localY * Math.cos(rotationRad);
        
        const targetX = this.x + rotatedX;
        const targetY = this.y + rotatedY;
        
        // Gently pull sword to correct offset
        const dx = targetX - this.swordSprite.x;
        const dy = targetY - this.swordSprite.y;
        
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            this.swordSprite.x += dx * 0.2;
            this.swordSprite.y += dy * 0.2;
        }
        
        // Calculate resting angle
        const upBaseAngle = this.slashFromRight ? 0 : -90;
        const rotationOffset = facingAngleDeg - (-90); // How much to rotate from UP reference
        const angleInDegrees = upBaseAngle + rotationOffset;
        
        this.swordSprite.angle = angleInDegrees;
    }

    // Update sword position (call this in scene update)
    updateSwordPosition() {
        if (this.swordSprite && !this.isSlashing) {
            // Update rest position to follow player
            this.updateSwordRestPosition();
        }
        
        // Update second sword if it exists (20/20 dual wielding)
        if (this.secondSwordSprite && !this.isSlashing) {
            this.updateSecondSwordRestPosition();
        }
    }
    
    // Snap second sword to rest position immediately (no interpolation)
    private snapSecondSwordToRestPosition() {
        if (!this.secondSwordSprite) return;
        
        // Calculate facing angle
        const facingAngleRad = Math.atan2(this.lastShootDirectionY, this.lastShootDirectionX);
        const facingAngleDeg = facingAngleRad * (180 / Math.PI);
        
        // Position in "UP-facing" coordinate space (opposite side from main sword)
        const sideDistance = 20;
        const localX = !this.slashFromRight ? sideDistance : -sideDistance; // Opposite of main sword
        const localY = -10;
        
        // Rotate by facing direction
        const rotationRad = facingAngleRad - (-Math.PI / 2); // Rotation from UP
        const rotatedX = localX * Math.cos(rotationRad) - localY * Math.sin(rotationRad);
        const rotatedY = localX * Math.sin(rotationRad) + localY * Math.cos(rotationRad);
        
        // Snap to position immediately
        this.secondSwordSprite.x = this.x + rotatedX;
        this.secondSwordSprite.y = this.y + rotatedY;
        
        // Calculate resting angle (opposite from main sword)
        const upBaseAngle = !this.slashFromRight ? 0 : -90; // Opposite of main sword
        const rotationOffset = facingAngleDeg - (-90);
        const angleInDegrees = upBaseAngle + rotationOffset;
        
        this.secondSwordSprite.angle = angleInDegrees;
    }

    // Update second sword rest position (opposite hand from first sword)
    private updateSecondSwordRestPosition() {
        if (!this.secondSwordSprite || this.isSlashing) return;
        
        // Calculate facing angle
        const facingAngleRad = Math.atan2(this.lastShootDirectionY, this.lastShootDirectionX);
        const facingAngleDeg = facingAngleRad * (180 / Math.PI);
        
        // Position in "UP-facing" coordinate space (opposite side from main sword)
        const sideDistance = 20;
        const localX = !this.slashFromRight ? sideDistance : -sideDistance; // Opposite of main sword
        const localY = -10;
        
        // Rotate by facing direction
        const rotationRad = facingAngleRad - (-Math.PI / 2); // Rotation from UP
        const rotatedX = localX * Math.cos(rotationRad) - localY * Math.sin(rotationRad);
        const rotatedY = localX * Math.sin(rotationRad) + localY * Math.cos(rotationRad);
        
        const targetX = this.x + rotatedX;
        const targetY = this.y + rotatedY;
        
        // Gently pull sword to correct offset
        const dx = targetX - this.secondSwordSprite.x;
        const dy = targetY - this.secondSwordSprite.y;
        
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            this.secondSwordSprite.x += dx * 0.2;
            this.secondSwordSprite.y += dy * 0.2;
        }
        
        // Calculate resting angle (opposite from main sword)
        const upBaseAngle = !this.slashFromRight ? 0 : -90; // Opposite of main sword
        const rotationOffset = facingAngleDeg - (-90);
        const angleInDegrees = upBaseAngle + rotationOffset;
        
        this.secondSwordSprite.angle = angleInDegrees;
    }

    // Clean up sword sprite on destroy
    destroySword() {
        if (this.swordSprite) {
            this.swordSprite.destroy();
            this.swordSprite = null;
        }
        if (this.secondSwordSprite) {
            this.secondSwordSprite.destroy();
            this.secondSwordSprite = null;
        }
    }
}
