import Phaser from 'phaser';
import Player, { WeaponType } from '../entities/Player';
import Enemy from '../entities/Enemy';
import ShootingEnemy from '../entities/ShootingEnemy';
import TriangleEnemy from '../entities/TriangleEnemy';
import XEnemy from '../entities/XEnemy';
import MimicEnemy from '../entities/MimicEnemy';
import HealerEnemy from '../entities/HealerEnemy';
import DasherEnemy from '../entities/DasherEnemy';
import RATBoss from '../entities/RATBoss';
import Bullet from '../entities/Bullet';
import PowerCell from '../entities/PowerCell';
import Coin from '../entities/Coin';
import Item, { ItemType } from '../entities/Item';

export default class GameScene extends Phaser.Scene {
    private player!: Player;
    private enemies!: Phaser.GameObjects.Group;
    private bullets!: Phaser.GameObjects.Group;
    private enemyBullets!: Phaser.GameObjects.Group;
    private powerCells!: Phaser.GameObjects.Group;
    private powerDisplay!: Phaser.GameObjects.Group;
    private coins!: Phaser.GameObjects.Group;
    private coinDisplay!: Phaser.GameObjects.Group;
    private items!: Phaser.GameObjects.Group;
    private itemDescriptionText!: Phaser.GameObjects.Text;
    private itemNameText!: Phaser.GameObjects.Text;
    private wasdKeys!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };
    private lastEnemySpawn: number = 0;
    private enemySpawnInterval: number = 2000; // Spawn enemy every 2 seconds
    
    // Wave system
    private currentWave: number = 1;
    private killsNeeded: number = 1;
    private killsThisWave: number = 0;
    private waveActive: boolean = false;
    private enemyPool: string[] = []; // Pool of enemies to spawn this wave
    private enemiesSpawnedThisWave: number = 0;
    private startWaveButton!: Phaser.GameObjects.Zone;
    private startWaveButtonBg!: Phaser.GameObjects.Graphics;
    private startWaveButtonText!: Phaser.GameObjects.Text;
    private waveIndicatorText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;
    
    // Map and minimap
    private mapWidth: number = 3840;
    private mapHeight: number = 2160;
    private minimapGraphics!: Phaser.GameObjects.Graphics;
    private minimapBg!: Phaser.GameObjects.Rectangle;
    private walls!: Phaser.GameObjects.Group;
    
    // Collected items inventory display
    private collectedItems: ItemType[] = [];
    private inventoryContainer!: Phaser.GameObjects.Container;
    
    // Weapon system
    private weaponType: WeaponType = 'gun';
    
    // Spawn warnings tracking
    private activeSpawnWarnings: Phaser.GameObjects.Text[] = [];
    private pendingSpawnTimers: Phaser.Time.TimerEvent[] = [];
    
    // Boss system
    private boss: RATBoss | null = null;
    private bossHealthBar!: Phaser.GameObjects.Graphics;
    private bossHealthBarBg!: Phaser.GameObjects.Graphics;
    private bossHealthBarText!: Phaser.GameObjects.Text;
    private isBossRound: boolean = false;
    
    // VOLUME CONTROLS - Change these numbers (0.0 to 1.0) to adjust each sound
    volumeCoin: number = 0.4;           // Coin pickup
    volumeHP: number = 0.3;             // HP pickup  
    volumeCymonLaser: number = 0.075;     // Player shooting
    volumeEnemyLaser: number = 0.95;     // Enemy shooting
    volumeCymonHpDown: number = 0.1;    // Player taking damage
    volumeCymonItem: number = 0.20;      // Item pickup
    volumeEnemyDeath: number = 0.15;     // Enemy death
    volumeRatExplosion: number = 0.30;   // Boss explosion
    volumeRatDash: number = 0.15;        // Boss dash
    volumeRatDeflecting: number = 0.25;  // Boss deflecting
    volumeWin: number = 0.35;            // Victory sound
    volumeLose: number = 0.30;           // Game over sound

    constructor() {
        super({ key: 'GameScene' });
    }
    

    preload() {
        // Load 8x8 glasses sprite for 20/20 item with pixel-perfect scaling
        // Place your exported PNG file at: public/images/glasses.png
        // (Create the images folder if it doesn't exist)
        // If the image doesn't exist, it will fall back to the programmatically created texture
        try {
            this.load.image('glasses', 'images/glasses.png');
        } catch (e) {
            console.log('glasses.png not found, will use programmatic texture');
        }
        
        // Load new rare item sprites (8x8)
        this.load.image('overclock', 'images/overclock.png');
        this.load.image('hardware', 'images/hardware.png');
        this.load.image('shield', 'images/shield.png');
        this.load.image('powerbutton', 'images/powerbutton.png');
        
        // Load player sprites (cymon) - 4 directions
        this.load.image('cymon', 'images/cymon.png'); // Default/down
        this.load.image('cymon-left', 'images/cymon-left.png');
        this.load.image('cymon-up', 'images/cymon-up.png');
        this.load.image('cymon-right', 'images/cymon-right.png');
        
        // Load sword sprites for duelist class (all blade lengths)
        this.load.image('sword', 'weapons/sword.png'); // Level 1
        this.load.image('swordlvl2', 'weapons/swordlvl2.png'); // Level 2F
        this.load.image('swordlvl3', 'weapons/swordlvl3.png'); // Level 3
        this.load.image('swordlvl4', 'weapons/swordlvl4.png'); // Level 4
        this.load.image('swordlvl5', 'weapons/swordlvl5.png'); // Level 5
        
        // Load R.A.T. Boss sprites
        this.load.image('rat-default', 'images/rat-default.png');
        this.load.image('rat-attack-no-ball', 'images/rat-attack-no-ball.png');
        this.load.image('rat-attack-ball', 'images/rat-attack-ball.png');
        this.load.image('rat-attack-ring', 'images/rat-attack-ring.png');
        this.load.image('rat-defense-no-wall', 'images/rat-defense-no-wall.png');
        this.load.image('rat-defense-with-wall', 'images/rat-defense-with-wall.png');
        this.load.image('rat-flash', 'images/rat-flash.png');
        this.load.image('rat-pause', 'images/rat-pause.png');
        this.load.image('rat-death', 'images/rat-death.png');
        
        // Load sound effects
        this.load.audio('coin', 'sounds/coin.wav');
        this.load.audio('hp', 'sounds/hp.wav');
        this.load.audio('cymon_laser', 'sounds/cymon_laser.wav');
        this.load.audio('enemy_laser', 'sounds/enemy_laser.wav');
        this.load.audio('cymon_hp_down', 'sounds/cymon_hp_down.wav');
        this.load.audio('lose', 'sounds/lose.wav');
        this.load.audio('win', 'sounds/win.wav');
        this.load.audio('rat_deflecting', 'sounds/rat_deflecting.wav');
        this.load.audio('rat_explosion', 'sounds/rat_explosion.wav');
        this.load.audio('rat_dash', 'sounds/rat_dash.wav');
        this.load.audio('cymon_item', 'sounds/cymon_item.wav');
        this.load.audio('enemy_death', 'sounds/enemy_death.wav');
        
        // Load background music
        this.load.audio('mainsong', 'sounds/mainsong.wav');
    }
    
    init(data?: { weaponType?: WeaponType }) {
        // Get weapon type from scene data (passed from ClassSelectScene)
        this.weaponType = data?.weaponType || 'gun';
        // Reset collected items for new game
        this.collectedItems = [];
        // Reset boss state
        this.boss = null;
        this.isBossRound = false;
    }
    
    shutdown() {
        // Clean up boss when scene shuts down
        if (this.boss && this.boss.active) {
            this.boss.destroy();
            this.boss = null;
        }
        if (this.bossHealthBar) {
            this.hideBossHealthBar();
        }
        this.isBossRound = false;
    }

    create() {
        // Clean up any existing boss state
        if (this.boss && this.boss.active) {
            this.boss.destroy();
            this.boss = null;
        }
        if (this.bossHealthBar) {
            this.hideBossHealthBar();
        }
        this.isBossRound = false;
        
        // Set world bounds (larger than viewport)
        this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
        
        // Set camera bounds
        this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
        
        // Create all textures first to avoid texture conflicts
        this.createTextures();

        // Create groups
        this.bullets = this.add.group();
        this.enemyBullets = this.add.group();
        this.enemies = this.add.group();
        this.powerCells = this.add.group();
        this.powerDisplay = this.add.group();
        this.coins = this.add.group();
        this.coinDisplay = this.add.group();
        this.items = this.add.group();
        
        // Start background music (looping) - DISABLED
        // this.mainSong = this.sound.add('mainsong', { loop: true });
        // this.mainSong.play();

        // Create checkered background
        this.createCheckeredBackground();
        
        // Create walls around map boundaries
        this.createWalls();
        
        // Create player (start in center of map)
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        this.player = new Player(this, centerX, centerY, this.weaponType);
        this.player.setDepth(10); // Player depth
        
        // Set up wall collisions with player (after player is created)
        this.physics.add.collider(this.player, this.walls);
        
        // Set camera to follow player (centered, no deadzone, allow sub-pixel movement)
        this.cameras.main.startFollow(this.player, false); // Changed to false - don't round to pixels
        this.cameras.main.setDeadzone(0, 0);
        this.cameras.main.setRoundPixels(false);
        
        // Force camera to not round its own scroll position
        (this.cameras.main as any).roundPixels = false;
        
        // Center camera on player initially
        this.cameras.main.centerOn(centerX, centerY);

        // Create initial power display
        this.updatePowerDisplay();

        // Create initial coin display
        this.updateCoinDisplay();

        // Initialize wave system
        this.initializeWaveSystem();

        // Create stats display
        this.createStatsDisplay();
        
        // Create boss health bar (hidden initially)
        this.createBossHealthBar();
        
        // Create minimap
        this.createMinimap();
        this.createInventoryDisplay();

        // Create input
        if (!this.input.keyboard) {
            console.error('Keyboard input not available');
            return;
        }
        this.wasdKeys = {
            W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
        
        // No click handler needed - we handle it in update loop for continuous shooting

        // Collision detection
        this.physics.add.overlap(
            this.bullets,
            this.enemies,
            this.handleBulletEnemyCollision,
            undefined,
            this
        );

        this.physics.add.overlap(
            this.player,
            this.enemies,
            this.handlePlayerEnemyCollision,
            undefined,
            this
        );

        this.physics.add.overlap(
            this.player,
            this.powerCells,
            this.handlePlayerPowerCellCollision,
            undefined,
            this
        );

        this.physics.add.overlap(
            this.player,
            this.coins,
            this.handlePlayerCoinCollision,
            undefined,
            this
        );

        this.physics.add.overlap(
            this.player,
            this.enemyBullets,
            this.handlePlayerEnemyBulletCollision,
            undefined,
            this
        );

        this.physics.add.overlap(
            this.player,
            this.items,
            this.handlePlayerItemCollision,
            undefined,
            this
        );

        // Create item name text (hidden initially, larger font)
        this.itemNameText = this.add.text(1260, 680, '', {
            fontSize: '20px',
            fontFamily: 'Tiny5',
            color: '#ffffff',
            align: 'right'
        });
        this.itemNameText.setOrigin(1, 1); // Bottom-right anchor
        this.itemNameText.setScrollFactor(0); // Fixed to camera (moves with player)
        this.itemNameText.setVisible(false);
        this.itemNameText.setDepth(200); // HUD depth

        // Create item description text (hidden initially)
        this.itemDescriptionText = this.add.text(1260, 700, '', {
            fontSize: '16px',
            fontFamily: 'Tiny5',
            color: '#ffffff',
            align: 'right'
        });
        this.itemDescriptionText.setOrigin(1, 1); // Bottom-right anchor
        this.itemDescriptionText.setScrollFactor(0); // Fixed to camera (moves with player)
        this.itemDescriptionText.setVisible(false);
        this.itemDescriptionText.setDepth(200); // HUD depth
    }

    update(time: number, delta: number) {
        // Handle player movement (WASD only)
        let moveX = 0;
        let moveY = 0;

        if (this.wasdKeys.A.isDown) {
            moveX = -1;
        } else if (this.wasdKeys.D.isDown) {
            moveX = 1;
        }

        if (this.wasdKeys.W.isDown) {
            moveY = -1;
        } else if (this.wasdKeys.S.isDown) {
            moveY = 1;
        }

        this.player.move(moveX, moveY);

        // Update player facing direction to follow mouse (ALWAYS, every frame)
        // Convert screen coordinates to world coordinates manually
        const pointer = this.input.activePointer;
        const camera = this.cameras.main;
        const mouseX = pointer.x + camera.scrollX;
        const mouseY = pointer.y + camera.scrollY;
        this.player.updateFacingDirection(mouseX, mouseY);
        
        // Handle shooting/attacking with left mouse button (continuous when held)
        if (this.input.activePointer.leftButtonDown()) {
            if (this.player.getWeaponType() === 'sword') {
                // Sword slash in facing direction
                const dx = mouseX - this.player.x;
                const dy = mouseY - this.player.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length > 0) {
                    this.player.slashDirection(dx / length, dy / length, (hitbox) => {
                        this.handleSwordHit(hitbox, 1);
                    }, this.bullets, this.enemies);
                }
            } else {
                // Gun shooting in facing direction
                this.player.shoot(this.bullets, this.enemies);
            }
        }
        
        // Update sword position
        this.player.updateSwordPosition();
        
        // Check sword collision with enemies (for duelist)
        if (this.player.getWeaponType() === 'sword') {
            this.checkSwordEnemyCollision();
        }

        // Only spawn enemies if wave is active and NOT a boss round
        if (this.waveActive && !this.isBossRound) {
            if (time - this.lastEnemySpawn > this.enemySpawnInterval) {
                this.spawnRandomEnemy();
                this.lastEnemySpawn = time;
            }
        }
        
        // Update boss if active
        if (this.boss && this.boss.active) {
            this.boss.update(time, this.player, this.enemyBullets);
            this.updateBossHealthBar();
            
            // Check boss collision with player bullets
            this.physics.overlap(
                this.bullets,
                this.boss,
                (bullet: any) => {
                    this.handleBulletBossCollision(bullet as Bullet);
                },
                undefined,
                this
            );
            
            // Check boss collision with sword
            if (this.player.getWeaponType() === 'sword') {
                this.checkSwordBossCollision();
            }
            
            // Check boss collision with player (damage player)
            // Don't damage player if boss is dying
            if ((this.boss as any).state !== 'dying') {
                this.physics.overlap(
                    this.player,
                    this.boss,
                    () => {
                        // Damage player (contact damage)
                        if (this.player.takeDamage(1)) {
                            // Update power display
                            this.updatePowerDisplay();
                            
                            if (this.player.isDead()) {
                                // Stop background music - DISABLED
                                // if (this.mainSong) {
                                //     this.mainSong.stop();
                                // }
                                this.scene.start('EndScene', {
                                    wave: this.currentWave,
                                    weaponType: this.player.getWeaponType()
                                });
                            }
                        }
                    },
                    undefined,
                    this
                );
            }
        }

        // Check if player is moving
        const playerVelocity = (this.player.body as Phaser.Physics.Arcade.Body).velocity;
        const isPlayerMoving = Math.abs(playerVelocity.x) > 0.1 || Math.abs(playerVelocity.y) > 0.1;

        // Update enemies
        this.enemies.children.entries.forEach((enemy) => {
            if (enemy instanceof XEnemy) {
                (enemy as XEnemy).update(this.player, delta, this.enemyBullets);
            } else if (enemy instanceof ShootingEnemy) {
                (enemy as ShootingEnemy).update(this.player, delta, this.enemyBullets);
            } else if (enemy instanceof TriangleEnemy) {
                (enemy as TriangleEnemy).update(this.player, delta, isPlayerMoving);
            } else if (enemy instanceof MimicEnemy) {
                (enemy as MimicEnemy).update(this.player);
            } else if (enemy instanceof HealerEnemy) {
                (enemy as HealerEnemy).update(this.enemies.getChildren());
            } else if (enemy instanceof DasherEnemy) {
                (enemy as DasherEnemy).update(this.player, delta);
            } else {
                (enemy as Enemy).update(this.player, delta);
            }
        });

        // Update enemy bullets
        this.enemyBullets.children.entries.forEach((bullet) => {
            (bullet as Bullet).update();
        });

        // Update bullets
        this.bullets.children.entries.forEach((bullet) => {
            (bullet as Bullet).update();
        });

        // Update power cells
        this.powerCells.children.entries.forEach((powerCell) => {
            (powerCell as PowerCell).update();
        });

        // Update coins
        this.coins.children.entries.forEach((coin) => {
            (coin as Coin).update();
        });

        // Check item proximity for description
        this.updateItemProximity();
        
        // Update minimap
        this.updateMinimap();
    }

    private updateItemProximity() {
        const proximityDistance = 200; // Distance to show description (increased from 80)
        let closestItem: Item | null = null;
        let closestDistance = Infinity;

        const items = this.items.getChildren() as unknown as Item[];
        for (const itemObj of items) {
            if (itemObj && itemObj.active) {
                const dx = this.player.x - itemObj.x;
                const dy = this.player.y - itemObj.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < proximityDistance && distance < closestDistance) {
                    closestDistance = distance;
                    closestItem = itemObj;
                }
            }
        }

        if (closestItem !== null) {
            let name = closestItem.getName();
            const rarity = closestItem.getRarity();
            let description = closestItem.getDescription();
            const itemType = closestItem.getItemType();
            
            // If player has sword, convert gun stat names to sword equivalents
            if (this.player.getWeaponType() === 'sword') {
                if (itemType === ItemType.SHOT_SPEED) {
                    name = 'Blade Length Up';
                    description = 'Blade Length +1';
                } else if (itemType === ItemType.SHOT_RATE) {
                    name = 'Swing Rate Up';
                    description = 'Swing Rate +50%';
                } else if (itemType === ItemType.OVERCLOCK) {
                    description = 'Swing Rate +50%, DMG +50%';
                } else if (itemType === ItemType.HARDWARE_ACCELERATION) {
                    description = 'Swing Rate +50%, Blade Length +1, Move Speed +50%';
                }
                // Antivirus Update description stays the same (Luck, HP, DMG)
            }
            
            // Set name with rarity (larger font)
            // Clear any existing separate rarity text
            const existingRarityText = this.itemNameText.getData('rarityText') as Phaser.GameObjects.Text | undefined;
            if (existingRarityText) {
                existingRarityText.destroy();
                this.itemNameText.setData('rarityText', undefined);
            }
            
            // Power Button has no rarity display
            if (itemType === ItemType.POWER_BUTTON) {
                // Just show name, no rarity
                this.itemNameText.setText(name);
                this.itemNameText.setStyle({ color: '#ffffff' }); // White name
                this.itemNameText.x = 1260; // Original position
                this.itemNameText.setVisible(true);
            }
            else if (rarity === 'Rare' || rarity === 'Legendary') {
                // For Rare/Legendary items: name in white, rarity in color (separate text objects)
                
                // Measure rarity width
                const tempRarityText = this.add.text(0, 0, `(${rarity})`, {
                    fontSize: '20px',
                    fontFamily: 'Tiny5'
                });
                const rarityWidth = tempRarityText.width;
                tempRarityText.destroy();
                
                const spacing = 5;
                const originalX = 1260; // Always use the fixed original position
                
                // Position name to the left (so it appears first)
                this.itemNameText.setText(name);
                this.itemNameText.setStyle({ color: '#ffffff' }); // White name
                this.itemNameText.x = originalX - rarityWidth - spacing;
                this.itemNameText.setVisible(true);
                
                // Determine rarity color
                const rarityColor = rarity === 'Legendary' ? '#e8a628' : '#1645f5'; // Warm gold for Legendary, Blue for Rare
                
                // Position rarity at the original x (rightmost, so it appears second)
                const rarityText = this.add.text(
                    originalX,
                    this.itemNameText.y,
                    `(${rarity})`,
                    {
                        fontSize: '20px',
                        fontFamily: 'Tiny5',
                        color: rarityColor
                    }
                );
                rarityText.setOrigin(1, 1); // Bottom-right anchor (same as name text)
                rarityText.setScrollFactor(0);
                rarityText.setDepth(200);
                rarityText.setVisible(true);
                
                // Store reference for cleanup
                this.itemNameText.setData('rarityText', rarityText);
            } else {
                // Common items - name in white, rarity in gray (separate text objects)
                
                // Measure rarity width
                const tempRarityText = this.add.text(0, 0, `(${rarity})`, {
                    fontSize: '20px',
                    fontFamily: 'Tiny5'
                });
                const rarityWidth = tempRarityText.width;
                tempRarityText.destroy();
                
                const spacing = 5;
                const originalX = 1260; // Always use the fixed original position
                
                // Position name to the left (so it appears first)
                this.itemNameText.setText(name);
                this.itemNameText.setStyle({ color: '#ffffff' }); // White name
                this.itemNameText.x = originalX - rarityWidth - spacing;
                this.itemNameText.setVisible(true);
                
                // Position rarity at the original x (rightmost, so it appears second)
                const rarityText = this.add.text(
                    originalX,
                    this.itemNameText.y,
                    `(${rarity})`,
                    {
                        fontSize: '20px',
                        fontFamily: 'Tiny5',
                        color: '#888888' // Slightly darker gray for Common
                    }
                );
                rarityText.setOrigin(1, 1); // Bottom-right anchor (same as name text)
                rarityText.setScrollFactor(0);
                rarityText.setDepth(200);
                rarityText.setVisible(true);
                
                // Store reference for cleanup
                this.itemNameText.setData('rarityText', rarityText);
            }
            
            // Set description (smaller font, green)
            this.itemDescriptionText.setText(description);
            this.itemDescriptionText.setStyle({ color: '#6ded8a' }); // Green (Color 2)
            this.itemDescriptionText.setVisible(true);
        } else {
            this.itemNameText.setVisible(false);
            this.itemDescriptionText.setVisible(false);
            // Hide and clean up any separate rarity text if it exists
            const existingRarityText = this.itemNameText.getData('rarityText') as Phaser.GameObjects.Text | undefined;
            if (existingRarityText) {
                existingRarityText.destroy();
                this.itemNameText.setData('rarityText', undefined);
            }
            // Reset name text position in case it was moved for rare items
            this.itemNameText.x = 1260;
        }
    }

    private spawnRandomEnemy() {
        // Check if we've spawned all enemies for this wave
        if (this.enemiesSpawnedThisWave >= this.enemyPool.length) {
            return;
        }
        
        // Get next enemy type from pool
        const enemyType = this.enemyPool[this.enemiesSpawnedThisWave];
        this.enemiesSpawnedThisWave++;
        
        // Calculate spawn position
        const spawnDistance = 350;
        const angle = Phaser.Math.Between(0, 360) * Math.PI / 180;
        let x = this.player.x + Math.cos(angle) * spawnDistance;
        let y = this.player.y + Math.sin(angle) * spawnDistance;
        x = Phaser.Math.Clamp(x, 50, this.mapWidth - 50);
        y = Phaser.Math.Clamp(y, 50, this.mapHeight - 50);
        
        // Determine spawn callback based on enemy type
        let spawnCallback: () => void;
        
        switch (enemyType) {
            case 'cube':
                spawnCallback = () => this.spawnEnemyAt(x, y);
                break;
            case 'shooter':
                spawnCallback = () => this.spawnShootingEnemyAt(x, y);
                break;
            case 'triangle':
                spawnCallback = () => this.spawnTriangleEnemyAt(x, y);
                break;
            case 'xenemy':
                spawnCallback = () => this.spawnXEnemyAt(x, y);
                break;
            case 'mimic':
                spawnCallback = () => this.spawnMimicEnemyAt(x, y);
                break;
            case 'healer':
                spawnCallback = () => this.spawnHealerEnemyAt(x, y);
                break;
            case 'dasher':
                spawnCallback = () => this.spawnDasherEnemyAt(x, y);
                break;
            default:
                spawnCallback = () => this.spawnEnemyAt(x, y);
        }
        
        // Show warning indicator, then spawn
        this.showSpawnWarning(x, y, spawnCallback);
    }
    
    private showSpawnWarning(x: number, y: number, onComplete: () => void) {
        // Create exclamation point warning (start invisible)
        const warning = this.add.text(x, y, '!', {
            fontSize: '48px',
            fontFamily: 'Tiny5',
            color: '#ff0000'
        });
        warning.setOrigin(0.5, 0.5);
        warning.setDepth(100);
        warning.setAlpha(0); // Start invisible
        
        // Track this warning
        this.activeSpawnWarnings.push(warning);
        
        // Blink: invisible -> visible -> invisible -> pause -> spawn
        this.tweens.add({
            targets: warning,
            alpha: 1,
            duration: 300,
            yoyo: true,
            onComplete: () => {
                // Add slight pause before spawning
                const spawnTimer = this.time.delayedCall(300, () => {
                    // Only spawn if warning still exists (hasn't been destroyed by wave end)
                    if (!warning.active) return;
                    
                    // Remove from tracking arrays
                    const warningIndex = this.activeSpawnWarnings.indexOf(warning);
                    if (warningIndex > -1) {
                        this.activeSpawnWarnings.splice(warningIndex, 1);
                    }
                    const timerIndex = this.pendingSpawnTimers.indexOf(spawnTimer);
                    if (timerIndex > -1) {
                        this.pendingSpawnTimers.splice(timerIndex, 1);
                    }
                    
                    warning.destroy();
                    onComplete();
                });
                
                // Track the spawn timer
                this.pendingSpawnTimers.push(spawnTimer);
            }
        });
    }
    
    private spawnDasherEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const dasher = new DasherEnemy(this, x, y, isChampion);
        dasher.setDepth(5);
        this.enemies.add(dasher);
        this.physics.add.collider(dasher, this.walls);
    }

    private spawnEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const enemy = new Enemy(this, x, y, isChampion);
        enemy.setDepth(5);
        this.enemies.add(enemy);
        this.physics.add.collider(enemy, this.walls);
    }

    private spawnShootingEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const shootingEnemy = new ShootingEnemy(this, x, y, isChampion);
        shootingEnemy.setDepth(5);
        this.enemies.add(shootingEnemy);
        this.physics.add.collider(shootingEnemy, this.walls);
    }

    private spawnTriangleEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const triangleEnemy = new TriangleEnemy(this, x, y, isChampion);
        triangleEnemy.setDepth(5);
        this.enemies.add(triangleEnemy);
        this.physics.add.collider(triangleEnemy, this.walls);
    }

    private spawnXEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const xEnemy = new XEnemy(this, x, y, isChampion);
        xEnemy.setDepth(5);
        this.enemies.add(xEnemy);
        this.physics.add.collider(xEnemy, this.walls);
    }

    private spawnMimicEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const mimicEnemy = new MimicEnemy(this, x, y, isChampion);
        mimicEnemy.setDepth(5);
        this.enemies.add(mimicEnemy);
        this.physics.add.collider(mimicEnemy, this.walls);
    }

    private spawnHealerEnemyAt(x: number, y: number) {
        const isChampion = Phaser.Math.Between(1, 100) <= 10;
        const healerEnemy = new HealerEnemy(this, x, y, isChampion);
        healerEnemy.setDepth(5);
        this.enemies.add(healerEnemy);
        this.physics.add.collider(healerEnemy, this.walls);
    }

    private checkSwordEnemyCollision() {
        const sword = this.player.getSwordSprite();
        if (!sword) return;
        
        // Check collision for main sword (sword 1)
        this.checkSingleSwordCollision(sword, 1);
        
        // Check collision for second sword if it exists (20/20 - sword 2)
        const secondSword = this.player.getSecondSwordSprite();
        if (secondSword) {
            this.checkSingleSwordCollision(secondSword, 2);
        }
    }
    
    private checkSingleSwordCollision(sword: Phaser.Physics.Arcade.Image, swordNumber: 1 | 2) {
        // Get pixel map for current blade length from player
        const swordPixels = this.player.getSwordPixelMap();
        
        // Get sprite file size to calculate origin offset
        const bladeLength = this.player.getBladeLength();
        const spriteFileSize = bladeLength === 1 ? 8 : 16;
        
        // Sword rotation in radians
        const angleRad = sword.angle * (Math.PI / 180);
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);
        
        // Pixel size is always 4 (sprites are scaled 4x regardless of base size)
        const pixelSize = 4;
        const hitboxSize = 8; // Hitbox per pixel (4x4 per original pixel)
        
        // Check each pixel
        swordPixels.forEach(([pixelX, pixelY]) => {
            // Convert pixel coords to local position (relative to origin at 0,1)
            // Origin (0,1) means bottom-left, so pixel (0,0) is at top-left
            // For an NxN sprite, pixel (0,0) is N pixels above the origin
            const localX = pixelX * pixelSize;
            const localY = (pixelY - spriteFileSize) * pixelSize; // Offset from bottom
            
            // Rotate the pixel's local position by sword's angle
            const rotatedX = localX * cosAngle - localY * sinAngle;
            const rotatedY = localX * sinAngle + localY * cosAngle;
            
            // Add to sword's world position (centered on pixel)
            const worldX = sword.x + rotatedX + (pixelSize / 2);
            const worldY = sword.y + rotatedY - (pixelSize / 2);
            
            this.handleSwordHit({
                x: worldX,
                y: worldY,
                width: hitboxSize,
                height: hitboxSize,
                direction: { x: 0, y: 0 }
            }, swordNumber);
        });
    }

    private handleSwordHit(hitbox: { x: number, y: number, width: number, height: number, direction: { x: number, y: number } }, swordNumber: 1 | 2) {
        // Check for enemies within the sword hitbox
        const damage = this.player.getSwordDamage();
        const knockbackStrength = this.player.getSwordKnockback();
        
        // Check each enemy for overlap with hitbox
        this.enemies.children.entries.forEach((enemy) => {
            const enemySprite = enemy as Phaser.Physics.Arcade.Image;
            
            // Simple rectangle overlap check
            const enemyBounds = enemySprite.getBounds();
            const hitboxBounds = new Phaser.Geom.Rectangle(
                hitbox.x - hitbox.width / 2,
                hitbox.y - hitbox.height / 2,
                hitbox.width,
                hitbox.height
            );
            
            if (Phaser.Geom.Rectangle.Overlaps(enemyBounds, hitboxBounds)) {
                // Skip collision if triangle enemy is inactive (black)
                if (enemy instanceof TriangleEnemy && (enemy as TriangleEnemy).isInactiveState()) {
                    return;
                }
                
                // Special handling for Mimic enemy when reflecting
                if (enemy instanceof MimicEnemy && (enemy as MimicEnemy).isReflectingState()) {
                    // Reflect sword knockback back at player (2x strength, no damage)
                    const dx = this.player.x - enemySprite.x;
                    const dy = this.player.y - enemySprite.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const reflectedKnockback = knockbackStrength * 2; // 2x the player's knockback
                    const playerKnockbackX = distance > 0 ? (dx / distance) * reflectedKnockback : 0;
                    const playerKnockbackY = distance > 0 ? (dy / distance) * reflectedKnockback : 0;
                    
                    // Push player back (no damage)
                    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
                    playerBody.setVelocity(playerKnockbackX, playerKnockbackY);
                    
                    return; // No damage to mimic, skip rest
                }
                
                // Special handling for Dasher enemy shield
                if (enemy instanceof DasherEnemy && this.isHitOnDasherShield(hitbox.x, hitbox.y, enemy as DasherEnemy)) {
                    // Shield blocks sword - push player back (half of mimic reflection)
                    const dx = this.player.x - enemySprite.x;
                    const dy = this.player.y - enemySprite.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const shieldKnockback = knockbackStrength * 1; // Same as player's knockback (half of mimic's 2x)
                    const playerKnockbackX = distance > 0 ? (dx / distance) * shieldKnockback : 0;
                    const playerKnockbackY = distance > 0 ? (dy / distance) * shieldKnockback : 0;
                    
                    // Push player back (no damage to enemy)
                    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
                    playerBody.setVelocity(playerKnockbackX, playerKnockbackY);
                    
                    return; // No damage to dasher, skip rest
                }
                
                // Check if this enemy can be hit by this specific sword (per-sword cooldown)
                let canBeHit = false;
                if (enemy instanceof XEnemy) {
                    canBeHit = (enemy as XEnemy).canBeHitBySword(swordNumber);
                } else if (enemy instanceof ShootingEnemy) {
                    canBeHit = (enemy as ShootingEnemy).canBeHitBySword(swordNumber);
                } else if (enemy instanceof TriangleEnemy) {
                    canBeHit = (enemy as TriangleEnemy).canBeHitBySword(swordNumber);
                } else if (enemy instanceof MimicEnemy) {
                    canBeHit = (enemy as MimicEnemy).canBeHitBySword(swordNumber);
                } else if (enemy instanceof HealerEnemy) {
                    canBeHit = (enemy as HealerEnemy).canBeHitBySword(swordNumber);
                } else if (enemy instanceof DasherEnemy) {
                    canBeHit = (enemy as DasherEnemy).canBeHitBySword(swordNumber);
                } else if (enemy instanceof Enemy) {
                    canBeHit = (enemy as Enemy).canBeHitBySword(swordNumber);
                }
                
                if (!canBeHit) {
                    return; // On cooldown for this sword, skip
                }
                
                // Record this hit
                if (enemy instanceof XEnemy) {
                    (enemy as XEnemy).recordSwordHit(swordNumber);
                } else if (enemy instanceof ShootingEnemy) {
                    (enemy as ShootingEnemy).recordSwordHit(swordNumber);
                } else if (enemy instanceof TriangleEnemy) {
                    (enemy as TriangleEnemy).recordSwordHit(swordNumber);
                } else if (enemy instanceof MimicEnemy) {
                    (enemy as MimicEnemy).recordSwordHit(swordNumber);
                } else if (enemy instanceof HealerEnemy) {
                    (enemy as HealerEnemy).recordSwordHit(swordNumber);
                } else if (enemy instanceof DasherEnemy) {
                    (enemy as DasherEnemy).recordSwordHit(swordNumber);
                } else if (enemy instanceof Enemy) {
                    (enemy as Enemy).recordSwordHit(swordNumber);
                }
                
                // Calculate knockback direction from player to enemy
                const dx = enemySprite.x - this.player.x;
                const dy = enemySprite.y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const knockbackX = distance > 0 ? (dx / distance) * knockbackStrength : 0;
                const knockbackY = distance > 0 ? (dy / distance) * knockbackStrength : 0;
                
                // Get drop rate multiplier from enemy (1 for normal, 2 for champion)
                let dropRateMultiplier = 1;
                
                // Calculate particle spawn position at edge of enemy (back side from hit direction)
                const exitAngle = Math.atan2(dy, dx); // Direction of hit (exit side)
                
                if (enemy instanceof XEnemy) {
                    dropRateMultiplier = (enemy as XEnemy).getDropRateMultiplier();
                    const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                    const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                    const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                    this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                    (enemy as XEnemy).takeDamage(damage, (x: number, y: number) => {
                        this.onEnemyDeath(x, y, dropRateMultiplier);
                    }, knockbackX, knockbackY);
                } else if (enemy instanceof ShootingEnemy) {
                    dropRateMultiplier = (enemy as ShootingEnemy).getDropRateMultiplier();
                    const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                    const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                    const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                    this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                    (enemy as ShootingEnemy).takeDamage(damage, (x: number, y: number) => {
                        this.onEnemyDeath(x, y, dropRateMultiplier);
                    }, knockbackX, knockbackY);
                } else if (enemy instanceof TriangleEnemy) {
                    dropRateMultiplier = (enemy as TriangleEnemy).getDropRateMultiplier();
                    const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                    const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                    const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                    this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                    (enemy as TriangleEnemy).takeDamage(damage, (x: number, y: number) => {
                        this.onEnemyDeath(x, y, dropRateMultiplier);
                    }, knockbackX, knockbackY);
                } else if (enemy instanceof MimicEnemy) {
                    dropRateMultiplier = (enemy as MimicEnemy).getDropRateMultiplier();
                    const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                    const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                    const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                    this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                    const mimicEnemy = enemy as MimicEnemy;
                    mimicEnemy.takeDamage(damage, (x: number, y: number) => {
                        // Check if mini mimics were spawned and add them to enemies group
                        const mini1 = mimicEnemy.getData('miniMimic1');
                        const mini2 = mimicEnemy.getData('miniMimic2');
                        if (mini1) this.enemies.add(mini1);
                        if (mini2) this.enemies.add(mini2);
                        
                        // Only count as kill if it's a mini mimic (main mimic splits, doesn't count)
                        if (mimicEnemy.isMiniMimic()) {
                            this.onEnemyDeath(x, y, dropRateMultiplier);
                        }
                    }, knockbackX, knockbackY);
                } else if (enemy instanceof HealerEnemy) {
                    dropRateMultiplier = (enemy as HealerEnemy).getDropRateMultiplier();
                    const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                    const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                    const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                    this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                    (enemy as HealerEnemy).takeDamage(damage, (x: number, y: number) => {
                        this.onEnemyDeath(x, y, dropRateMultiplier);
                    }, knockbackX, knockbackY);
                } else if (enemy instanceof DasherEnemy) {
                    // Angle-based shield check for DasherEnemy
                    const dasherEnemy = enemy as DasherEnemy;
                    
                    // Only damage if NOT hitting the front shield
                    if (!this.isHitOnDasherShield(hitbox.x, hitbox.y, dasherEnemy)) {
                        dropRateMultiplier = dasherEnemy.getDropRateMultiplier();
                        const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                        const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                        const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                        this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                        dasherEnemy.takeDamage(damage, (x: number, y: number) => {
                            this.onEnemyDeath(x, y, dropRateMultiplier);
                        }, knockbackX, knockbackY);
                    }
                } else {
                    dropRateMultiplier = (enemy as Enemy).getDropRateMultiplier();
                    const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                    const enemyParticleX = enemySprite.x + Math.cos(exitAngle) * enemySpawnDist;
                    const enemyParticleY = enemySprite.y + Math.sin(exitAngle) * enemySpawnDist;
                    this.spawnHitParticles(enemyParticleX, enemyParticleY, -dx, -dy, dropRateMultiplier === 2);
                    (enemy as Enemy).takeDamage(damage, (x: number, y: number) => {
                        this.onEnemyDeath(x, y, dropRateMultiplier);
                    }, knockbackX, knockbackY);
                }
            }
        });
    }

    private spawnHitParticles(x: number, y: number, directionX: number, directionY: number, isChampion: boolean = false, sizeMultiplier: number = 1) {
        // Spawn 3-5 particles
        const particleCount = Phaser.Math.Between(3, 5);
        
        // Normalize direction and REVERSE it (particles fly opposite to hit direction)
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        const normalizedX = length > 0 ? -directionX / length : -1;
        const normalizedY = length > 0 ? -directionY / length : 0;
        
        // Champion enemies bleed purple, normal enemies bleed red
        const particleColor = isChampion ? 0x9d4edd : 0xff0000;
        
        for (let i = 0; i < particleCount; i++) {
            // Random size between 3-8 pixels (increased from 2-6), scaled by multiplier
            const baseSize = Phaser.Math.Between(3, 7);
            const size = baseSize * sizeMultiplier;
            
            // Create particle as a simple colored rectangle
            const particle = this.add.rectangle(x, y, size, size, particleColor);
            particle.setDepth(15); // Above everything
            
            // Add some random spread to the direction (±30 degrees)
            const spreadAngle = Phaser.Math.FloatBetween(-0.5, 0.5); // radians
            const cos = Math.cos(spreadAngle);
            const sin = Math.sin(spreadAngle);
            const spreadX = normalizedX * cos - normalizedY * sin;
            const spreadY = normalizedX * sin + normalizedY * cos;
            
            // Random speed between 30-60 (much slower)
            const speed = Phaser.Math.Between(75, 125);
            
            // Animate particle - start fast, slow down like mimic dash
            this.tweens.add({
                targets: particle,
                x: particle.x + spreadX * speed,
                y: particle.y + spreadY * speed,
                alpha: 0,
                duration: 600, // Longer duration for slower fade
                ease: 'Quint.Out', // Strong deceleration like mimic dash
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }

    private handleBulletEnemyCollision = (bullet: any, enemy: any) => {
        // Get bullet velocity and position for knockback/collision BEFORE destroying
        const bulletObj = bullet as Bullet;
        const bulletBody = bulletObj.body as Phaser.Physics.Arcade.Body;
        const bulletKnockbackStrength = 50; // Fixed knockback for bullets
        
        // Save bullet CENTER position for pixel-perfect collision (before destroying)
        // Use sprite center, not body top-left
        const bulletX = bulletObj.x;
        const bulletY = bulletObj.y;
        
        // Normalize bullet velocity and apply knockback strength
        const length = Math.sqrt(bulletBody.velocity.x * bulletBody.velocity.x + bulletBody.velocity.y * bulletBody.velocity.y);
        const knockbackX = length > 0 ? (bulletBody.velocity.x / length) * bulletKnockbackStrength : 0;
        const knockbackY = length > 0 ? (bulletBody.velocity.y / length) * bulletKnockbackStrength : 0;
        
        // Store bullet direction for particles
        const bulletDirX = bulletBody.velocity.x;
        const bulletDirY = bulletBody.velocity.y;
        
        // Special handling for Mimic enemy when reflecting
        if (enemy instanceof MimicEnemy && (enemy as MimicEnemy).isReflectingState()) {
            // Reflect bullet back at player instead of destroying it
            const bulletVel = bulletBody.velocity;
            bulletBody.setVelocity(-bulletVel.x, -bulletVel.y);
            // Make bullet damage player (move from player bullets to enemy bullets)
            this.bullets.remove(bullet, false, false);
            this.enemyBullets.add(bullet);
            return; // Don't damage mimic
        }
        
        (bullet as Bullet).destroy();
        
        // Skip collision if triangle enemy is inactive (black)
        if (enemy instanceof TriangleEnemy && (enemy as TriangleEnemy).isInactiveState()) {
            return;
        }
        
        const damage = this.player.getDamage();
        
        // Get drop rate multiplier from enemy (1 for normal, 2 for champion)
        let dropRateMultiplier = 1;
        
        // Calculate particle spawn position at edge of enemy (back side from bullet direction)
        const exitAngle = Math.atan2(bulletDirY, bulletDirX); // Direction of bullet (exit side)
        
        if (enemy instanceof XEnemy) {
            dropRateMultiplier = (enemy as XEnemy).getDropRateMultiplier();
            const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
            const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
            const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
            this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
            (enemy as XEnemy).takeDamage(damage, (x: number, y: number) => {
                this.onEnemyDeath(x, y, dropRateMultiplier);
            }, knockbackX, knockbackY);
        } else if (enemy instanceof ShootingEnemy) {
            dropRateMultiplier = (enemy as ShootingEnemy).getDropRateMultiplier();
            const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
            const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
            const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
            this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
            (enemy as ShootingEnemy).takeDamage(damage, (x: number, y: number) => {
                this.onEnemyDeath(x, y, dropRateMultiplier);
            }, knockbackX, knockbackY);
        } else if (enemy instanceof TriangleEnemy) {
            dropRateMultiplier = (enemy as TriangleEnemy).getDropRateMultiplier();
            const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
            const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
            const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
            this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
            (enemy as TriangleEnemy).takeDamage(damage, (x: number, y: number) => {
                this.onEnemyDeath(x, y, dropRateMultiplier);
            }, knockbackX, knockbackY);
        } else if (enemy instanceof MimicEnemy) {
            dropRateMultiplier = (enemy as MimicEnemy).getDropRateMultiplier();
            const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
            const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
            const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
            this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
            const mimicEnemy = enemy as MimicEnemy;
            mimicEnemy.takeDamage(damage, (x: number, y: number) => {
                // Check if mini mimics were spawned and add them to enemies group
                const mini1 = mimicEnemy.getData('miniMimic1');
                const mini2 = mimicEnemy.getData('miniMimic2');
                if (mini1) this.enemies.add(mini1);
                if (mini2) this.enemies.add(mini2);
                
                // Only count as kill if it's a mini mimic (main mimic splits, doesn't count)
                if (mimicEnemy.isMiniMimic()) {
                    this.onEnemyDeath(x, y, dropRateMultiplier);
                }
            }, knockbackX, knockbackY);
        } else if (enemy instanceof HealerEnemy) {
            dropRateMultiplier = (enemy as HealerEnemy).getDropRateMultiplier();
            const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
            const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
            const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
            this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
            (enemy as HealerEnemy).takeDamage(damage, (x: number, y: number) => {
                this.onEnemyDeath(x, y, dropRateMultiplier);
            }, knockbackX, knockbackY);
        } else if (enemy instanceof DasherEnemy) {
            // Angle-based shield check for DasherEnemy
            const dasherEnemy = enemy as DasherEnemy;
            
            // Only damage if NOT hitting the front shield
            if (!this.isHitOnDasherShield(bulletX, bulletY, dasherEnemy)) {
                dropRateMultiplier = dasherEnemy.getDropRateMultiplier();
                const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
                const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
                const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
                this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
                dasherEnemy.takeDamage(damage, (x: number, y: number) => {
                    this.onEnemyDeath(x, y, dropRateMultiplier);
                }, knockbackX, knockbackY);
            }
        } else {
            dropRateMultiplier = (enemy as Enemy).getDropRateMultiplier();
            const enemySpawnDist = dropRateMultiplier === 2 ? 20 : 12;
            const particleX = enemy.x + Math.cos(exitAngle) * enemySpawnDist;
            const particleY = enemy.y + Math.sin(exitAngle) * enemySpawnDist;
            this.spawnHitParticles(particleX, particleY, -bulletDirX, -bulletDirY, dropRateMultiplier === 2);
            (enemy as Enemy).takeDamage(damage, (x: number, y: number) => {
                this.onEnemyDeath(x, y, dropRateMultiplier);
            }, knockbackX, knockbackY);
        }
    }

    private isHitOnDasherShield(hitX: number, hitY: number, enemy: DasherEnemy): boolean {
        // Convert hit position to sprite-local coordinates
        const localX = hitX - enemy.x;
        const localY = hitY - enemy.y;
        
        // Rotate by inverse of enemy rotation to get sprite-space coordinates
        const cos = Math.cos(-enemy.rotation);
        const sin = Math.sin(-enemy.rotation);
        const spriteX = localX * cos - localY * sin;
        const spriteY = localX * sin + localY * cos;
        
        // Black pixels are on the RIGHT side (column 7) and TOP side (row 0, columns 2-7)
        // In sprite space (centered, 8x8):
        // - Right side means spriteX > 2 (right half of sprite)
        // - Top side means spriteY < -2 (top half of sprite)
        
        // If hit on right or top edge, it's hitting the black shield
        return spriteX > 2 || spriteY < -2;
    }
    
    private handleBulletBossCollision(bullet: Bullet) {
        if (!this.boss || !this.boss.active) return;
        
        const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
        
        // Check if boss is in defense mode
        if (this.boss.isDefending()) {
            // Check if hit from the side the boss is facing (bottom side with wall)
            // Boss rotation is angleToPlayer - PI/2, so the facing angle is rotation + PI/2
            const facingAngle = this.boss.rotation + Math.PI / 2;
            
            // Calculate angle from boss to bullet
            const dx = bullet.x - this.boss.x;
            const dy = bullet.y - this.boss.y;
            const angleToBullet = Math.atan2(dy, dx);
            
            // Calculate angle difference
            let angleDiff = angleToBullet - facingAngle;
            // Normalize to -PI to PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // If bullet is within ~90 degrees of the facing direction (front arc), reflect it
            if (Math.abs(angleDiff) < Math.PI / 2) {
                // Reflect bullet back at player (like mimic)
                const bulletVel = bulletBody.velocity;
                bulletBody.setVelocity(-bulletVel.x, -bulletVel.y);
                this.bullets.remove(bullet, false, false);
                this.enemyBullets.add(bullet);
                return;
            }
        }
        
        // Normal damage
        const bulletKnockbackStrength = 50;
        const length = Math.sqrt(bulletBody.velocity.x * bulletBody.velocity.x + bulletBody.velocity.y * bulletBody.velocity.y);
        const knockbackX = length > 0 ? (bulletBody.velocity.x / length) * bulletKnockbackStrength : 0;
        const knockbackY = length > 0 ? (bulletBody.velocity.y / length) * bulletKnockbackStrength : 0;
        
        // Spawn particles on exit side (same direction as bullet travels through)
        // Bullet goes through and pops out the other side
        const exitAngle = Math.atan2(bulletBody.velocity.y, bulletBody.velocity.x);
        const spawnDistance = 112; // Half of 224 (boss size)
        const particleX = this.boss.x + Math.cos(exitAngle) * spawnDistance;
        const particleY = this.boss.y + Math.sin(exitAngle) * spawnDistance;
        // Pass negative direction so particles fly OUT (spawnHitParticles reverses it)
        this.spawnHitParticles(particleX, particleY, -bulletBody.velocity.x, -bulletBody.velocity.y, false, 2);
        
        const damage = this.player.getDamage();
        this.boss.takeDamage(damage, (_x: number, _y: number) => {
            // Boss death
            this.onBossDeath();
        }, knockbackX, knockbackY);
        
        bullet.destroy();
    }
    
    private checkSwordBossCollision() {
        if (!this.boss || !this.boss.active) return;
        
        const sword = this.player.getSwordSprite();
        const secondSword = this.player.getSecondSwordSprite();
        
        // Check main sword
        if (sword) {
            this.checkSingleSwordBossCollision(sword, 1);
        }
        
        // Check second sword (if 20/20)
        if (secondSword) {
            this.checkSingleSwordBossCollision(secondSword, 2);
        }
    }
    
    private checkSingleSwordBossCollision(sword: Phaser.Physics.Arcade.Image, swordNumber: 1 | 2) {
        if (!this.boss || !this.boss.active) return;
        
        // Use physics overlap for collision detection
        this.physics.overlap(
            sword,
            this.boss,
            () => {
            // Null check (TypeScript guard)
            if (!this.boss) return;
            
            // Check per-sword cooldown
            if (!this.boss.canBeHitBySword(swordNumber)) {
                return; // On cooldown for this sword
            }
            
            // Check if boss is in defense mode
            if (this.boss.isDefending()) {
                // Check if hit from the side the boss is facing (bottom side with wall)
                // Boss rotation is angleToPlayer - PI/2, so the facing angle is rotation + PI/2
                const facingAngle = this.boss.rotation + Math.PI / 2;
                
                // Calculate angle from boss to sword
                const dx = sword.x - this.boss.x;
                const dy = sword.y - this.boss.y;
                const angleToSword = Math.atan2(dy, dx);
                
                // Calculate angle difference
                let angleDiff = angleToSword - facingAngle;
                // Normalize to -PI to PI
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                // If sword is within ~90 degrees of the facing direction (front arc), reflect it
                if (Math.abs(angleDiff) < Math.PI / 2) {
                    // Reflect sword hit - intense knockback like mimic
                    const knockbackStrength = this.player.getSwordKnockback();
                    const playerDx = this.player.x - this.boss.x;
                    const playerDy = this.player.y - this.boss.y;
                    const distance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
                    const reflectedKnockback = knockbackStrength * 2;
                    const playerKnockbackX = distance > 0 ? (playerDx / distance) * reflectedKnockback : 0;
                    const playerKnockbackY = distance > 0 ? (playerDy / distance) * reflectedKnockback : 0;
                    
                    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
                    playerBody.setVelocity(playerKnockbackX, playerKnockbackY);
                    return;
                }
            }
            
            // Record hit
            this.boss.recordSwordHit(swordNumber);
            
            // Normal sword damage
            const damage = this.player.getSwordDamage();
            const knockbackStrength = this.player.getSwordKnockback();
            const dx = this.boss.x - this.player.x;
            const dy = this.boss.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const knockbackX = distance > 0 ? (dx / distance) * knockbackStrength : 0;
            const knockbackY = distance > 0 ? (dy / distance) * knockbackStrength : 0;
            
            // Spawn particles on exit side (opposite from player)
            // Sword hits from player side, particles exit the far side
            const exitAngle = Math.atan2(dy, dx); // Direction away from player
            const spawnDistance = 112; // Half of 224 (boss size)
            const particleX = this.boss.x + Math.cos(exitAngle) * spawnDistance;
            const particleY = this.boss.y + Math.sin(exitAngle) * spawnDistance;
            // Pass negative direction so particles fly OUT (spawnHitParticles reverses it)
            this.spawnHitParticles(particleX, particleY, -dx, -dy, false, 2);
            
            this.boss.takeDamage(damage, (_x: number, _y: number) => {
                // Boss death
                this.onBossDeath();
            }, knockbackX, knockbackY);
            },
            undefined,
            this
        );
    }
    
    private onBossDeath() {
        this.hideBossHealthBar();
        this.boss = null;
        
        // Spawn Power Button item in center instead of normal items
        const centerX = this.mapWidth / 2 + 5; // Slight offset to the right
        const centerY = this.mapHeight / 2;
        const powerButton = new Item(this, centerX, centerY, ItemType.POWER_BUTTON);
        powerButton.setDepth(8);
        this.items.add(powerButton);
    }

    private handlePlayerEnemyCollision = (player: any, enemy: any) => {
        // Handle player taking damage
        const playerObj = player as Player;
        
        // Skip collision if triangle enemy is inactive (black)
        if (enemy instanceof TriangleEnemy && (enemy as TriangleEnemy).isInactiveState()) {
            return;
        }
        
        // Get damage amount from enemy (1 for normal, 2 for champion)
        const damageAmount = (enemy as Enemy).getDamageToPlayer();
        
        if (playerObj.takeDamage(damageAmount)) {
            // Damage was taken, push enemy away
            const playerBody = playerObj.body as Phaser.Physics.Arcade.Body;
            const enemyBody = (enemy as Enemy | ShootingEnemy | TriangleEnemy | XEnemy | MimicEnemy).body as Phaser.Physics.Arcade.Body;
            const dx = playerBody.x - enemyBody.x;
            const dy = playerBody.y - enemyBody.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                enemyBody.setVelocity(
                    (dx / distance) * -100,
                    (dy / distance) * -100
                );
            }

            // Update power display
            this.updatePowerDisplay();

            // Check if player is dead
            if (playerObj.isDead()) {
                // Stop background music - DISABLED
                // if (this.mainSong) {
                //     this.mainSong.stop();
                // }
                // Transition to end scene with wave data
                this.scene.start('EndScene', { 
                    wave: this.currentWave,
                    weaponType: this.player.getWeaponType()
                });
            }
        }
    }

    private handlePlayerEnemyBulletCollision = (player: any, bullet: any) => {
        const playerObj = player as Player;
        
        if (playerObj.takeDamage(1)) {
            (bullet as Bullet).destroy();
            
            // Update power display
            this.updatePowerDisplay();

            // Check if player is dead
            if (playerObj.isDead()) {
                // Stop background music - DISABLED
                // if (this.mainSong) {
                //     this.mainSong.stop();
                // }
                // Transition to end scene
                this.scene.start('EndScene', { 
                    wave: this.currentWave,
                    weaponType: this.player.getWeaponType()
                });
            }
        }
    }

    private handlePlayerPowerCellCollision = (player: any, powerCell: any) => {
        (player as Player).addPower(1);
        (powerCell as PowerCell).destroy();
        this.updatePowerDisplay();
        this.updateCoinDisplay();
        this.updateStatsDisplay();
        
        // Play HP pickup sound
        this.sound.play('hp', { volume: this.volumeHP });
    }

    private handlePlayerItemCollision = (player: any, item: any) => {
        const itemObj = item as Item;
        const playerObj = player as Player;
        
        // Check if item is purchasable
        const isPurchasable = itemObj.getData('isPurchasable');
        const cost = itemObj.getData('cost') || 0;
        
        if (isPurchasable) {
            // Check if player has enough coins
            if (playerObj.getCoins() >= cost) {
                // Purchase item
                playerObj.spendCoins(cost);
                this.updateCoinDisplay();
            } else {
                // Not enough coins, don't collect
                return;
            }
        }
        
        // Apply stat upgrade (1.5x multiplier) and show feedback
        let statLineIndex = 0; // Which line to show the increment on
        let oldValue = 0;
        let newValue = 0;
        
        switch (itemObj.getItemType()) {
            case ItemType.DAMAGE:
                if (playerObj.getWeaponType() === 'sword') {
                    oldValue = playerObj.getSwordDamage();
                    playerObj.upgradeSwordDamage();
                    newValue = playerObj.getSwordDamage();
                } else {
                    oldValue = playerObj.getDamage();
                    playerObj.upgradeDamage();
                    newValue = playerObj.getDamage();
                }
                statLineIndex = 0; // Top line (DMG)
                break;
            case ItemType.SHOT_SPEED:
                // If player has sword, convert to Blade Length
                if (playerObj.getWeaponType() === 'sword') {
                    oldValue = playerObj.getBladeLength();
                    playerObj.upgradeBladeLength();
                    newValue = playerObj.getBladeLength();
                    statLineIndex = 1; // Second line (Blade Length)
                } else {
                    oldValue = playerObj.getShotSpeed() / 100; // Scaled value
                    playerObj.upgradeShotSpeed();
                    newValue = playerObj.getShotSpeed() / 100; // Scaled value
                    statLineIndex = 1; // Second line (Shot Speed)
                }
                break;
            case ItemType.BLADE_LENGTH:
                oldValue = playerObj.getBladeLength();
                playerObj.upgradeBladeLength();
                newValue = playerObj.getBladeLength();
                statLineIndex = 1; // Second line (Blade Length)
                break;
            case ItemType.SHOT_RATE:
                // If player has sword, convert to Swing Rate
                if (playerObj.getWeaponType() === 'sword') {
                    oldValue = Math.round(1000 / playerObj.getSwingRate() * 10) / 10; // Swings per second
                    playerObj.upgradeSwingRate();
                    newValue = Math.round(1000 / playerObj.getSwingRate() * 10) / 10; // Swings per second
                    statLineIndex = 2; // Third line (Swing Rate)
                } else {
                    oldValue = Math.round(1000 / playerObj.getShotRate() * 10) / 10; // Shots per second
                    playerObj.upgradeShotRate();
                    newValue = Math.round(1000 / playerObj.getShotRate() * 10) / 10; // Shots per second
                    statLineIndex = 2; // Third line (Shot Rate)
                }
                break;
            case ItemType.SWING_RATE:
                oldValue = Math.round(1000 / playerObj.getSwingRate() * 10) / 10; // Swings per second
                playerObj.upgradeSwingRate();
                newValue = Math.round(1000 / playerObj.getSwingRate() * 10) / 10; // Swings per second
                statLineIndex = 2; // Third line (Swing Rate)
                break;
            case ItemType.MOVE_SPEED:
                oldValue = playerObj.getMovementSpeed() / 100; // Scaled value
                playerObj.upgradeMoveSpeed();
                newValue = playerObj.getMovementSpeed() / 100; // Scaled value
                statLineIndex = 3; // Fourth line (Move Speed)
                break;
            case ItemType.LUCK:
                oldValue = playerObj.getLuck();
                playerObj.upgradeLuck();
                newValue = playerObj.getLuck();
                statLineIndex = 4; // Bottom line (Luck)
                break;
            case ItemType.HEALTH_UP:
                playerObj.upgradeMaxPower();
                this.updatePowerDisplay(); // Update health display immediately
                statLineIndex = -1; // No stat line indicator for health
                break;
            case ItemType.TWENTY_TWENTY:
                playerObj.enableTwentyTwenty();
                statLineIndex = 2; // Shot Rate line (middle) - doesn't really matter for this item
                break;
            case ItemType.HOMING:
                playerObj.enableHoming();
                statLineIndex = -1; // No stat line indicator
                break;
            case ItemType.SWORD:
                oldValue = playerObj.getDamage();
                playerObj.switchToSword();
                newValue = playerObj.getDamage();
                statLineIndex = 0; // Top line (DMG) - shows +2
                break;
            case ItemType.OVERCLOCK:
                // Combines Shot Rate Up + Damage Up
                if (playerObj.getWeaponType() === 'sword') {
                    // Apply damage up
                    let dmgOld = playerObj.getSwordDamage();
                    playerObj.upgradeSwordDamage();
                    let dmgNew = playerObj.getSwordDamage();
                    this.showStatUpgradeFeedback(0, dmgNew - dmgOld, false, dmgNew); // DMG line
                    
                    // Apply swing rate up
                    let rateOld = Math.round(1000 / playerObj.getSwingRate() * 10) / 10;
                    playerObj.upgradeSwingRate();
                    let rateNew = Math.round(1000 / playerObj.getSwingRate() * 10) / 10;
                    this.showStatUpgradeFeedback(2, rateNew - rateOld, false, rateNew); // Swing Rate line
                } else {
                    // Apply damage up
                    let dmgOld = playerObj.getDamage();
                    playerObj.upgradeDamage();
                    let dmgNew = playerObj.getDamage();
                    this.showStatUpgradeFeedback(0, dmgNew - dmgOld, false, dmgNew); // DMG line
                    
                    // Apply shot rate up
                    let rateOld = Math.round(1000 / playerObj.getShotRate() * 10) / 10;
                    playerObj.upgradeShotRate();
                    let rateNew = Math.round(1000 / playerObj.getShotRate() * 10) / 10;
                    this.showStatUpgradeFeedback(2, rateNew - rateOld, false, rateNew); // Shot Rate line
                }
                statLineIndex = -1; // Already showed feedback
                break;
            case ItemType.HARDWARE_ACCELERATION:
                // Combines Shot Rate Up + Shot Speed Up + Move Speed Up
                if (playerObj.getWeaponType() === 'sword') {
                    // Apply swing rate up
                    let rateOld = Math.round(1000 / playerObj.getSwingRate() * 10) / 10;
                    playerObj.upgradeSwingRate();
                    let rateNew = Math.round(1000 / playerObj.getSwingRate() * 10) / 10;
                    this.showStatUpgradeFeedback(2, rateNew - rateOld, false, rateNew); // Swing Rate line
                    
                    // Apply blade length up
                    let lengthOld = playerObj.getBladeLength();
                    playerObj.upgradeBladeLength();
                    let lengthNew = playerObj.getBladeLength();
                    this.showStatUpgradeFeedback(1, lengthNew - lengthOld, false, lengthNew); // Blade Length line
                    
                    // Apply move speed up
                    let speedOld = playerObj.getMovementSpeed() / 100;
                    playerObj.upgradeMoveSpeed();
                    let speedNew = playerObj.getMovementSpeed() / 100;
                    this.showStatUpgradeFeedback(3, speedNew - speedOld, false, speedNew); // Move Speed line
                } else {
                    // Apply shot rate up
                    let rateOld = Math.round(1000 / playerObj.getShotRate() * 10) / 10;
                    playerObj.upgradeShotRate();
                    let rateNew = Math.round(1000 / playerObj.getShotRate() * 10) / 10;
                    this.showStatUpgradeFeedback(2, rateNew - rateOld, false, rateNew); // Shot Rate line
                    
                    // Apply shot speed up
                    let speedOld = playerObj.getShotSpeed() / 100;
                    playerObj.upgradeShotSpeed();
                    let speedNew = playerObj.getShotSpeed() / 100;
                    this.showStatUpgradeFeedback(1, speedNew - speedOld, false, speedNew); // Shot Speed line
                    
                    // Apply move speed up
                    let moveOld = playerObj.getMovementSpeed() / 100;
                    playerObj.upgradeMoveSpeed();
                    let moveNew = playerObj.getMovementSpeed() / 100;
                    this.showStatUpgradeFeedback(3, moveNew - moveOld, false, moveNew); // Move Speed line
                }
                statLineIndex = -1; // Already showed feedback
                break;
            case ItemType.ANTIVIRUS_UPDATE:
                // Combines Luck Up + HP Up + Damage Up
                if (playerObj.getWeaponType() === 'sword') {
                    // Apply luck up
                    let luckOld = playerObj.getLuck();
                    playerObj.upgradeLuck();
                    let luckNew = playerObj.getLuck();
                    this.showStatUpgradeFeedback(4, luckNew - luckOld, false, luckNew); // Luck line
                    
                    // Apply health up
                    playerObj.upgradeMaxPower();
                    this.updatePowerDisplay();
                    
                    // Apply damage up
                    let dmgOld = playerObj.getSwordDamage();
                    playerObj.upgradeSwordDamage();
                    let dmgNew = playerObj.getSwordDamage();
                    this.showStatUpgradeFeedback(0, dmgNew - dmgOld, false, dmgNew); // DMG line
                } else {
                    // Apply luck up
                    let luckOld = playerObj.getLuck();
                    playerObj.upgradeLuck();
                    let luckNew = playerObj.getLuck();
                    this.showStatUpgradeFeedback(4, luckNew - luckOld, false, luckNew); // Luck line
                    
                    // Apply health up
                    playerObj.upgradeMaxPower();
                    this.updatePowerDisplay();
                    
                    // Apply damage up
                    let dmgOld = playerObj.getDamage();
                    playerObj.upgradeDamage();
                    let dmgNew = playerObj.getDamage();
                    this.showStatUpgradeFeedback(0, dmgNew - dmgOld, false, dmgNew); // DMG line
                }
                statLineIndex = -1; // Already showed feedback
                break;
            case ItemType.POWER_BUTTON:
                // Victory! Trigger ending sequence
                this.triggerVictorySequence();
                statLineIndex = -1; // No stat changes
                break;
        }
        
        // Show temporary upgrade feedback text next to the upgraded stat
        const increment = newValue - oldValue;
        this.showStatUpgradeFeedback(statLineIndex, increment, false, newValue);
        
        // Add item to collected items inventory (at the beginning for most recent first)
        this.collectedItems.unshift(itemObj.getItemType());
        this.updateInventoryDisplay();
        
        // Destroy cost text if it exists (Item's destroy will also clean it up as backup)
        const costText = itemObj.getData('costText') as Phaser.GameObjects.Text;
        if (costText && costText.active) {
            costText.destroy();
        }
        
        // Play item pickup sound (including power button)
        const itemSound = this.sound.add('cymon_item');
        itemSound.play({ volume: this.volumeCymonItem });
        
        // Fade out over last 200ms of the sound
        this.time.delayedCall(itemSound.duration * 1000 - 200, () => {
            if (itemSound.isPlaying) {
                this.tweens.add({
                    targets: itemSound,
                    volume: 0,
                    duration: 200,
                    onComplete: () => {
                        itemSound.stop();
                        itemSound.destroy();
                    }
                });
            }
        });
        
        itemObj.destroy();
        this.itemNameText.setVisible(false);
        this.itemDescriptionText.setVisible(false);
        this.updateStatsDisplay();
    }

    private handlePlayerCoinCollision = (player: any, coin: any) => {
        (player as Player).addCoins(1);
        (coin as Coin).destroy();
        this.updateCoinDisplay();
        
        // Play coin pickup sound
        this.sound.play('coin', { volume: this.volumeCoin });
    }

    private onEnemyDeath(x: number, y: number, dropRateMultiplier: number = 1) {
        // Play enemy death sound
        this.sound.play('enemy_death', { volume: this.volumeEnemyDeath });
        
        // Determine drops (luck affects drop rates)
        const luck = this.player.getLuck();
        const baseHeartChance = 5 * dropRateMultiplier; // 5% base chance (10% for champions)
        const baseCoinChance = 10 * dropRateMultiplier; // 10% base chance (20% for champions)
        // Luck increases coin chance by 5% per point, heart chance by 2.5% per point
        const heartChance = baseHeartChance + luck * 2.5; // 2.5% per luck point
        const coinChance = baseCoinChance + luck * 5; // 5% per luck point
        
        const shouldDropPowerCell = Phaser.Math.Between(1, 100) <= heartChance;
        const shouldDropCoin = Phaser.Math.Between(1, 100) <= coinChance;
        
        // Drop priority: if both drop and player is at full health, drop coin. Otherwise drop heart.
        if (shouldDropPowerCell && shouldDropCoin) {
            if (this.player.getPower() >= this.player.getMaxPower()) {
                // Full health, drop coin
                const coin = new Coin(this, x, y);
                coin.setDepth(8); // Above enemies, below player
                this.coins.add(coin);
            } else {
                // Not full health, drop heart
                const powerCell = new PowerCell(this, x, y);
                powerCell.setDepth(8); // Above enemies, below player
                this.powerCells.add(powerCell);
            }
        } else if (shouldDropPowerCell) {
            const powerCell = new PowerCell(this, x, y);
            this.powerCells.add(powerCell);
        } else if (shouldDropCoin) {
            const coin = new Coin(this, x, y);
            this.coins.add(coin);
        }

        // Track wave kills
        if (this.waveActive) {
            this.killsThisWave++;
            this.updateWaveIndicator();
            this.updateStatsDisplay();

            // Check if wave is complete (but not for boss rounds - boss death handles that)
            if (this.killsThisWave >= this.killsNeeded && !this.isBossRound) {
                this.completeWave();
            }
        }
    }

    private initializeWaveSystem() {
        this.currentWave = 1;
        this.killsNeeded = this.calculateKillsNeeded(1);
        this.killsThisWave = 0;
        this.waveActive = false;

        // Create start wave button
        this.createStartWaveButton();

        // Create wave indicator
        this.createWaveIndicator();
    }

    private createStartWaveButton() {
        const buttonWidth = 180;
        const buttonHeight = 50;
        const buttonX = 640; // Center top (1280/2)
        const buttonY = 30;

        // Button background
        this.startWaveButtonBg = this.add.graphics();
        this.startWaveButtonBg.fillStyle(0x33FF00, 1); // Green
        this.startWaveButtonBg.fillRect(
            buttonX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            buttonWidth,
            buttonHeight
        );
        this.startWaveButtonBg.setScrollFactor(0); // Fixed to camera (moves with player)
        this.startWaveButtonBg.setDepth(200); // HUD depth

        // Button text
        this.startWaveButtonText = this.add.text(buttonX, buttonY, 'Start Wave', {
            fontSize: '24px',
            fontFamily: 'Tiny5',
            color: '#282828'
        });
        this.startWaveButtonText.setOrigin(0.5);
        this.startWaveButtonText.setScrollFactor(0); // Fixed to camera (moves with player)
        this.startWaveButtonText.setDepth(201); // Above button bg

        // Make button interactive
        this.startWaveButton = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight);
        this.startWaveButton.setInteractive({ useHandCursor: true });
        this.startWaveButton.setScrollFactor(0); // Fixed to camera (moves with player)
        this.startWaveButton.setDepth(202); // Above everything for interaction

        // Button hover effect
        this.startWaveButton.on('pointerover', () => {
            this.startWaveButtonBg.clear();
            this.startWaveButtonBg.setScrollFactor(0); // Keep fixed to camera
            this.startWaveButtonBg.fillStyle(0x33FF00, 1); // Green (hover)
            this.startWaveButtonBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        this.startWaveButton.on('pointerout', () => {
            this.startWaveButtonBg.clear();
            this.startWaveButtonBg.setScrollFactor(0); // Keep fixed to camera
            this.startWaveButtonBg.fillStyle(0x33FF00, 1); // Green
            this.startWaveButtonBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        // Button click
        this.startWaveButton.on('pointerdown', () => {
            this.startWave();
        });
    }

    private createWaveIndicator() {
        this.waveIndicatorText = this.add.text(10, 5, 'Wave: 1', {
            fontSize: '24px',
            fontFamily: 'Tiny5',
            color: '#ffffff'
        });
        this.waveIndicatorText.setOrigin(0, 0); // Top-left anchor
        this.waveIndicatorText.setScrollFactor(0); // Fixed to camera (moves with player)
        this.waveIndicatorText.setDepth(200); // HUD depth
        this.updateWaveIndicator();
    }

    private updateWaveIndicator() {
        if (this.waveActive) {
            this.waveIndicatorText.setText(`Wave: ${this.currentWave} (${this.killsThisWave}/${this.killsNeeded})`);
        } else {
            this.waveIndicatorText.setText(`Wave: ${this.currentWave}`);
        }
    }

    private startWave() {
        // Destroy all existing items and their cost text indicators when starting the wave
        const itemsToDestroy = this.items.getChildren() as unknown as Item[];
        itemsToDestroy.forEach((item) => {
            const costText = item.getData('costText');
            if (costText && costText.active) {
                costText.destroy();
            }
            item.destroy();
        });
        this.items.clear(true, true);

        // Also destroy any orphaned cost text that might exist (cleanup any "5" or "15" text objects)
        const allChildren = this.children.list.slice(); // Copy array to avoid modification during iteration
        allChildren.forEach((child) => {
            if (child instanceof Phaser.GameObjects.Text && (child.text === '5' || child.text === '15') && child.active) {
                child.destroy();
            }
        });

        // Hide item description text
        this.itemNameText.setVisible(false);
        this.itemDescriptionText.setVisible(false);

        this.waveActive = true;
        this.killsThisWave = 0;
        this.enemiesSpawnedThisWave = 0;
        
        // Check if this is wave 1 (boss round) - TESTING
        this.isBossRound = this.currentWave === 8;
        
        if (this.isBossRound) {
            // Boss round: show special spawn sequence
            this.spawnBossSequence();
        } else {
            // Setup enemy pool and spawn interval for this wave
            this.setupWaveEnemies();
        }
        
        this.updateWaveIndicator();
        this.hideStartWaveButton();
    }
    
    private setupWaveEnemies() {
        // Define enemy pools for each wave
        const waveCompositions: { [key: number]: { [enemyType: string]: number } } = {
            1: { cube: 4, shooter: 1 },
            2: { cube: 7, shooter: 2, triangle: 1 },
            3: { cube: 8, shooter: 4, triangle: 2, xenemy: 1 },
            4: { cube: 8, shooter: 5, triangle: 3, xenemy: 3, mimic: 1 },
            5: { cube: 7, shooter: 5, triangle: 5, xenemy: 4, mimic: 3, healer: 1 },
            6: { cube: 10, shooter: 3, triangle: 4, xenemy: 5, mimic: 4, healer: 3, dasher: 1 },
            7: { cube: 10, shooter: 5, triangle: 3, xenemy: 4, mimic: 5, healer: 3, dasher: 5 }
        };
        
        // Define spawn intervals for each wave (in milliseconds)
        const waveIntervals: { [key: number]: number } = {
            1: 2500, // 2.50s
            2: 2250, // 2.25s
            3: 2000, // 2.00s
            4: 1750, // 1.75s
            5: 1500, // 1.50s
            6: 1250, // 1.25s
            7: 1000  // 1.00s
        };
        
        // Set spawn interval for this wave
        this.enemySpawnInterval = waveIntervals[this.currentWave] || 1000;
        
        // Build enemy pool array
        this.enemyPool = [];
        const composition = waveCompositions[this.currentWave];
        
        if (composition) {
            for (const [enemyType, count] of Object.entries(composition)) {
                for (let i = 0; i < count; i++) {
                    this.enemyPool.push(enemyType);
                }
            }
            
            // Shuffle the enemy pool (Fisher-Yates shuffle)
            for (let i = this.enemyPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.enemyPool[i], this.enemyPool[j]] = [this.enemyPool[j], this.enemyPool[i]];
            }
            
            // Make sure healer is not in first or second position
            for (let attempt = 0; attempt < 10; attempt++) {
                const firstIsHealer = this.enemyPool[0] === 'healer';
                const secondIsHealer = this.enemyPool.length > 1 && this.enemyPool[1] === 'healer';
                
                if (!firstIsHealer && !secondIsHealer) break;
                
                // Find a non-healer position to swap with
                for (let i = 2; i < this.enemyPool.length; i++) {
                    if (this.enemyPool[i] !== 'healer') {
                        if (firstIsHealer) {
                            [this.enemyPool[0], this.enemyPool[i]] = [this.enemyPool[i], this.enemyPool[0]];
                        } else if (secondIsHealer) {
                            [this.enemyPool[1], this.enemyPool[i]] = [this.enemyPool[i], this.enemyPool[1]];
                        }
                        break;
                    }
                }
            }
            
            // Set kills needed to total enemies in pool
            this.killsNeeded = this.enemyPool.length;
        }
    }

    private completeWave() {
        this.waveActive = false;
        
        // Kill all remaining enemies - get all children as an array
        const enemiesToKill = this.enemies.getChildren() as (Enemy | ShootingEnemy)[];
        
        // Destroy all enemies
        enemiesToKill.forEach((enemy) => {
            if (enemy && enemy.active) {
                enemy.destroy();
            }
        });

        // Clear all groups to make sure everything is gone
        this.enemies.clear(true, true);
        
        // Clear all projectiles (player bullets and enemy bullets)
        this.bullets.clear(true, true);
        this.enemyBullets.clear(true, true);
        
        // Cancel all pending spawn timers and destroy active spawn warnings
        this.pendingSpawnTimers.forEach((timer) => {
            if (timer) {
                timer.remove();
            }
        });
        this.pendingSpawnTimers = [];
        
        this.activeSpawnWarnings.forEach((warning) => {
            if (warning && warning.active) {
                warning.destroy();
            }
        });
        this.activeSpawnWarnings = [];
        
        // Clean up boss if still active
        if (this.boss && this.boss.active) {
            this.boss.destroy();
            this.boss = null;
        }
        this.isBossRound = false;

        // Advance to next wave FIRST (so we know which wave items to spawn)
        this.currentWave++;
        this.killsNeeded = this.calculateKillsNeeded(this.currentWave);
        this.killsThisWave = 0;
        
        // Spawn items in the middle of the room (available during intermission)
        this.spawnItem();

        // Show start wave button for next wave
        this.showStartWaveButton();
        this.updateWaveIndicator();
        this.updateStatsDisplay();
    }

    private spawnItem() {
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        
        // Weighted rarity system for free items
        // Roll a random number to determine rarity
        const rarityRoll = Math.random();
        let freeItemType: ItemType;
        
        // Common items (60% chance)
        const commonItems = this.player.getWeaponType() === 'sword' 
            ? [ItemType.DAMAGE, ItemType.BLADE_LENGTH, ItemType.SWING_RATE, ItemType.MOVE_SPEED, ItemType.LUCK, ItemType.HEALTH_UP]
            : [ItemType.DAMAGE, ItemType.SHOT_SPEED, ItemType.SHOT_RATE, ItemType.MOVE_SPEED, ItemType.LUCK, ItemType.HEALTH_UP];
        
        // Rare items (30% chance)
        const rareItems: ItemType[] = [
            ItemType.OVERCLOCK,
            ItemType.HARDWARE_ACCELERATION,
            ItemType.ANTIVIRUS_UPDATE
        ];
        
        // Legendary items (10% chance) - filter out already collected ones
        const allLegendaryItems: ItemType[] = [ItemType.TWENTY_TWENTY, ItemType.HOMING, ItemType.SWORD];
        const availableLegendaryItems = allLegendaryItems.filter(item => !this.collectedItems.includes(item));
        
        if (rarityRoll < 0.6) {
            // Common (60%)
            freeItemType = commonItems[Phaser.Math.Between(0, commonItems.length - 1)];
        } else if (rarityRoll < 0.9) {
            // Rare (30%)
            freeItemType = rareItems[Phaser.Math.Between(0, rareItems.length - 1)];
        } else {
            // Legendary (10%) - if available, otherwise give rare
            if (availableLegendaryItems.length > 0) {
                freeItemType = availableLegendaryItems[Phaser.Math.Between(0, availableLegendaryItems.length - 1)];
            } else {
                // All legendaries collected, give rare instead
                freeItemType = rareItems[Phaser.Math.Between(0, rareItems.length - 1)];
            }
        }
        
        // Spawn free item in the middle of the room
        const freeItem = new Item(this, centerX, centerY, freeItemType);
        freeItem.setDepth(8); // Above enemies, below player
        this.items.add(freeItem);
        
        // Spawn purchasable item (different from free items)
        // For purchasable items, use common items only (rare/legendary are only free drops)
        let purchasableCommonItems: ItemType[];
        if (this.player.getWeaponType() === 'sword') {
            purchasableCommonItems = [ItemType.DAMAGE, ItemType.BLADE_LENGTH, ItemType.SWING_RATE, ItemType.MOVE_SPEED, ItemType.LUCK, ItemType.HEALTH_UP];
        } else {
            purchasableCommonItems = [ItemType.DAMAGE, ItemType.SHOT_SPEED, ItemType.SHOT_RATE, ItemType.MOVE_SPEED, ItemType.LUCK, ItemType.HEALTH_UP];
        }
        const purchasableTypes = purchasableCommonItems.filter(type => type !== freeItemType);
        const purchasableType = purchasableTypes[Phaser.Math.Between(0, purchasableTypes.length - 1)];
        
        // Spawn purchasable item in the middle-right of the room (relative to center)
        const purchasableItem = new Item(this, centerX + 100, centerY, purchasableType);
        purchasableItem.setData('cost', 5);
        purchasableItem.setData('isPurchasable', true);
        purchasableItem.setDepth(8); // Above enemies, below player
        this.items.add(purchasableItem);
        
        // Add cost indicator text under purchasable item
        const costText = this.add.text(centerX + 100, centerY + 47.5, '5', {
            fontSize: '24px',
            fontFamily: 'Tiny5',
            color: '#ffd700' // Better gold color
        });
        costText.setOrigin(0.5);
        costText.setDepth(9);
        purchasableItem.setData('costText', costText);
    }

    private calculateKillsNeeded(wave: number): number {
        // Calculate total enemies for each wave
        const waveTotals: { [key: number]: number } = {
            1: 5,   // 4 cubes + 1 shooter
            2: 10,  // 7 cubes + 2 shooters + 1 triangle
            3: 15,  // 8 cubes + 4 shooters + 2 triangles + 1 xenemy
            4: 20,  // 8 cubes + 5 shooters + 3 triangles + 3 xenemy + 1 mimic
            5: 25,  // 7 cubes + 5 shooters + 5 triangles + 4 xenemy + 3 mimic + 1 healer
            6: 30,  // 10 cubes + 3 shooters + 4 triangles + 5 xenemy + 4 mimic + 3 healer + 1 dasher
            7: 35,  // 10 cubes + 5 shooters + 3 triangles + 4 xenemy + 5 mimic + 3 healer + 5 dasher
            8: 1    // Boss (R.A.T.)
        };
        
        return waveTotals[wave] || 1;
    }

    private hideStartWaveButton() {
        this.startWaveButton.setVisible(false);
        this.startWaveButtonBg.setVisible(false);
        this.startWaveButtonText.setVisible(false);
    }

    private showStartWaveButton() {
        this.startWaveButton.setVisible(true);
        this.startWaveButtonBg.setVisible(true);
        this.startWaveButtonText.setVisible(true);
    }

    private createStatsDisplay() {
        // Line spacing configuration - change this value to adjust spacing
        const extraLineSpacing = 3; // Extra pixels between stat lines
        
        this.statsText = this.add.text(30, 712, '', {
            fontSize: '16.5px',
            fontFamily: 'Tiny5',
            color: '#ffffff'
        });
        this.statsText.setOrigin(0, 1); // Bottom-left anchor
        this.statsText.setScrollFactor(0); // Fixed to camera (moves with player)
        this.statsText.setDepth(200); // HUD depth
        // Increase line spacing
        this.statsText.setLineSpacing(extraLineSpacing);
        // Shift text up to keep middle line (Shot Rate) in same position
        // With 5 lines, middle is line 3 (index 2). Extra spacing affects 2 gaps above and 2 below
        // To keep middle in place, shift up by: (extraLineSpacing * 2 gaps) = extraLineSpacing * 2
        this.statsText.y -= extraLineSpacing * 2;
        // Store spacing value for dot positioning
        this.statsText.setData('lineSpacing', extraLineSpacing);
        this.updateStatsDisplay();
    }
    
    private createBossHealthBar() {
        // Create boss health bar at bottom of screen (hidden initially)
        const barWidth = 400;
        const barHeight = 30;
        const barX = 640; // Center of screen (1280/2)
        const barY = 700; // Bottom of screen
        
        // Background bar
        this.bossHealthBarBg = this.add.graphics();
        this.bossHealthBarBg.fillStyle(0x000000, 0.7);
        this.bossHealthBarBg.fillRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight);
        this.bossHealthBarBg.setScrollFactor(0);
        this.bossHealthBarBg.setDepth(200);
        this.bossHealthBarBg.setVisible(false);
        
        // Health bar
        this.bossHealthBar = this.add.graphics();
        this.bossHealthBar.setScrollFactor(0);
        this.bossHealthBar.setDepth(201);
        this.bossHealthBar.setVisible(false);
        
        // Boss name text
        this.bossHealthBarText = this.add.text(barX, barY - 40, 'R.A.T.', {
            fontSize: '48px',
            fontFamily: 'Tiny5',
            color: '#ff0000'
        });
        this.bossHealthBarText.setOrigin(0.5, 0.5);
        this.bossHealthBarText.setScrollFactor(0);
        this.bossHealthBarText.setDepth(202);
        this.bossHealthBarText.setVisible(false);
    }
    
    private updateBossHealthBar() {
        if (!this.boss) return;
        
        const barWidth = 400;
        const barHeight = 30;
        const barX = 640;
        const barY = 700;
        
        const healthPercent = this.boss.getHealth() / this.boss.getMaxHealth();
        const currentWidth = barWidth * healthPercent;
        
        this.bossHealthBar.clear();
        this.bossHealthBar.fillStyle(0xff0000, 1);
        this.bossHealthBar.fillRect(barX - barWidth / 2, barY - barHeight / 2, currentWidth, barHeight);
    }
    
    private showBossHealthBar() {
        this.bossHealthBarBg.setVisible(true);
        this.bossHealthBar.setVisible(true);
        this.bossHealthBarText.setVisible(true);
    }
    
    private hideBossHealthBar() {
        this.bossHealthBarBg.setVisible(false);
        this.bossHealthBar.setVisible(false);
        this.bossHealthBarText.setVisible(false);
    }
    
    private spawnBossSequence() {
        // Show 3 large "!" in center of map that blink 3 times
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        const spacing = 45; // Spaced out a bit
        
        // Create 3 warnings
        const warning1 = this.add.text(centerX - spacing, centerY, '!', {
            fontSize: '172px', // Larger size
            fontFamily: 'Tiny5',
            color: '#ff0000'
        });
        warning1.setOrigin(0.5, 0.5);
        warning1.setDepth(200);
        warning1.setAlpha(0);
        
        const warning2 = this.add.text(centerX, centerY, '!', {
            fontSize: '172px', // Larger size
            fontFamily: 'Tiny5',
            color: '#ff0000'
        });
        warning2.setOrigin(0.5, 0.5);
        warning2.setDepth(200);
        warning2.setAlpha(0);
        
        const warning3 = this.add.text(centerX + spacing, centerY, '!', {
            fontSize: '172px', // Larger size
            fontFamily: 'Tiny5',
            color: '#ff0000'
        });
        warning3.setOrigin(0.5, 0.5);
        warning3.setDepth(200);
        warning3.setAlpha(0);
        
        const warnings = [warning1, warning2, warning3];
        
        // Blink sequence: invis -> vis -> invis -> vis -> invis -> vis -> invis (3 complete blinks)
        let blinkCount = 0;
        const maxBlinks = 7; // 7 phases = 3 complete blinks + start invisible
        
        this.time.addEvent({
            delay: 300,
            repeat: maxBlinks - 1,
            callback: () => {
                const isVisible = blinkCount % 2 === 1;
                warnings.forEach(w => w.setAlpha(isVisible ? 1 : 0));
                blinkCount++;
            }
        });
        
        // After blinking, destroy warnings and spawn boss
        this.time.delayedCall(300 * maxBlinks + 200, () => {
            warnings.forEach(w => w.destroy());
            this.spawnBoss();
        });
    }
    
    private spawnBoss() {
        // Spawn boss at distance 800 from player (off-screen)
        const spawnDistance = 800;
        const angle = Phaser.Math.Between(0, 360) * Math.PI / 180;
        const x = this.player.x + Math.cos(angle) * spawnDistance;
        const y = this.player.y + Math.sin(angle) * spawnDistance;
        // Don't clamp - allow boss to spawn off-screen
        
        this.boss = new RATBoss(this, x, y);
        this.boss.setPlayer(this.player);
        // NO COLLIDERS - boss should NEVER collide with anything (walls, player, etc.)
        
        // Show boss health bar
        this.showBossHealthBar();
        this.updateBossHealthBar();
    }

    private updateStatsDisplay() {
        // Show appropriate damage based on weapon type
        const damage = this.player.getWeaponType() === 'sword' 
            ? this.player.getSwordDamage() 
            : this.player.getDamage();
        const shotSpeed = this.player.getShotSpeed();
        const shotRate = this.player.getShotRate();
        const swingRate = this.player.getSwingRate();
        const movementSpeed = this.player.getMovementSpeed();
        
        // Scale speeds to match damage scale (divide by 100)
        const scaledShotSpeed = shotSpeed / 100;
        const scaledMoveSpeed = movementSpeed / 100;
        
        // Convert rates to per second for readability
        const shotsPerSecond = Math.round(1000 / shotRate * 10) / 10;
        const swingsPerSecond = Math.round(1000 / swingRate * 10) / 10;
        
        const luck = this.player.getLuck();
        
        // Different stats display for sword vs gun
        let stats: string;
        if (this.player.getWeaponType() === 'sword') {
            const bladeLength = this.player.getBladeLength();
            stats = `DMG: ${damage}\n` +
                   `Blade Length: ${bladeLength}\n` +
                   `Swing Rate: ${swingsPerSecond}/s\n` +
                   `Move Speed: ${scaledMoveSpeed}\n` +
                   `Luck: ${luck}`;
        } else {
            stats = `DMG: ${damage}\n` +
                   `Shot Speed: ${scaledShotSpeed}\n` +
                   `Shot Rate: ${shotsPerSecond}/s\n` +
                   `Move Speed: ${scaledMoveSpeed}\n` +
                   `Luck: ${luck}`;
        }
        
        this.statsText.setText(stats);
        
        // Create colored dots next to stats
        this.updateStatDots();
    }

    private updateStatDots() {
        // Clear existing dots
        const existingDots = this.statsText.getData('dots') as Phaser.GameObjects.Image[] | undefined;
        if (existingDots) {
            existingDots.forEach(dot => dot.destroy());
        }

        const dots: Phaser.GameObjects.Image[] = [];
        const textX = this.statsText.x;
        const textY = this.statsText.y; // Bottom of text (since origin is 0, 1)
        const dotSize = 8;
        const dotOffsetX = -15; // Position to the left of stat values (negative = left)
        const baseLineHeight = 18; // Base line height for Tiny5 font at 16px
        const extraLineSpacing = this.statsText.getData('lineSpacing') || 3; // Get stored spacing value
        const lineHeight = baseLineHeight + extraLineSpacing; // Total line height including spacing
        
        // Calculate actual line positions from the text object
        // Text origin is bottom-left, so we calculate from bottom up
        // Each line's center Y position
        const lineCenterOffset = -7; // Offset to center dots on text lines
        
        // DMG - Orange dot (top line, index 0, 4 lines up from bottom)
        const dmgY = textY - (lineHeight * 4) + lineCenterOffset;
        const dmgDot = this.add.image(textX + dotOffsetX, dmgY, 'statDot');
        dmgDot.setTint(0xff8c42); // Orange
        dmgDot.setDisplaySize(dotSize, dotSize);
        dmgDot.setScrollFactor(0); // Fixed to camera (moves with player)
        dmgDot.setVisible(true);
        dmgDot.setDepth(1000);
        dots.push(dmgDot);

        // Shot Speed - Purple dot (second line, index 1, 3 lines up)
        const speedY = textY - (lineHeight * 3) + lineCenterOffset;
        const speedDot = this.add.image(textX + dotOffsetX, speedY, 'statDot');
        speedDot.setTint(0x9d4edd); // Purple
        speedDot.setDisplaySize(dotSize, dotSize);
        speedDot.setScrollFactor(0); // Fixed to camera (moves with player)
        speedDot.setVisible(true);
        speedDot.setDepth(1000);
        dots.push(speedDot);

        // Shot Rate - Blue dot (third line, index 2, 2 lines up - middle line)
        const rateY = textY - (lineHeight * 2) + lineCenterOffset;
        const rateDot = this.add.image(textX + dotOffsetX, rateY, 'statDot');
        rateDot.setTint(0x1645f5); // Blue (Color 3)
        rateDot.setDisplaySize(dotSize, dotSize);
        rateDot.setScrollFactor(0); // Fixed to camera (moves with player)
        rateDot.setVisible(true);
        rateDot.setDepth(1000); // Ensure it's on top
        dots.push(rateDot);

        // Move Speed - Pink dot (fourth line, index 3, 1 line up from bottom)
        const moveY = textY - lineHeight + lineCenterOffset;
        const moveDot = this.add.image(textX + dotOffsetX, moveY, 'statDot');
        moveDot.setTint(0xff5f85); // Pink (Color 4)
        moveDot.setDisplaySize(dotSize, dotSize);
        moveDot.setScrollFactor(0); // Fixed to camera (moves with player)
        moveDot.setVisible(true);
        moveDot.setDepth(1000);
        dots.push(moveDot);

        // Luck - Old green dot (bottom line, index 4)
        const luckY = textY + lineCenterOffset;
        const luckDot = this.add.image(textX + dotOffsetX, luckY, 'statDot');
        luckDot.setTint(0x6ded8a); // Old green (exclusively for luck)
        luckDot.setDisplaySize(dotSize, dotSize);
        luckDot.setScrollFactor(0); // Fixed to camera (moves with player)
        luckDot.setVisible(true);
        luckDot.setDepth(1000);
        dots.push(luckDot);

        this.statsText.setData('dots', dots);
    }

    // TEMPORARY: Test feedback text to adjust positioning

    private showStatUpgradeFeedback(statLineIndex: number, increment: number, isPermanent: boolean = false, currentStatValue?: number) {
        // Skip for items without stat line display (like Health Up)
        if (statLineIndex < 0 || increment === 0) return;
        
        // HORIZONTAL OFFSETS FOR EACH STAT (adjust these values to change positioning)
        // statLineIndex: 0=DMG, 1=Shot/Blade Speed, 2=Shot/Swing Rate, 3=Move Speed, 4=Luck
        const statOffsets = [
            15,  // DMG horizontal offset (line 0)
            17.5,  // Shot/Blade Speed horizontal offset (line 1)
            10,  // Shot/Swing Rate horizontal offset (line 2)
            15,  // Move Speed horizontal offset (line 3)
            15   // Luck horizontal offset (line 4)
        ];
        
        const textX = this.statsText.x;
        const textY = this.statsText.y; // Bottom of text (since origin is 0, 1)
        const baseLineHeight = 18; // Base line height for Tiny5 font at 16px (match stat dots)
        const extraLineSpacing = this.statsText.getData('lineSpacing') || 3; // Get stored spacing value
        const lineHeight = baseLineHeight + extraLineSpacing; // Total line height including spacing
        const lineCenterOffset = -7.5; // Offset to center on text lines
        
        // Calculate position for the stat line (from bottom up)
        const yPos = textY - (lineHeight * (4 - statLineIndex)) + lineCenterOffset;
        
        // Get the specific stat line to measure its width
        const statsLines = this.statsText.text.split('\n');
        let statLineText = '';
        if (statLineIndex >= 0 && statLineIndex < statsLines.length) {
            statLineText = statsLines[statLineIndex];
        }
        
        // Measure THIS specific line's width
        const tempText = this.add.text(0, 0, statLineText, {
            fontSize: '16.5px',
            fontFamily: 'Tiny5'
        });
        const textWidth = tempText.width;
        tempText.destroy();
        
        // Determine digit count based on current stat value (AFTER upgrade)
        let digitCount = 1;
        if (currentStatValue !== undefined) {
            // Use the provided current stat value to count digits
            const statValueStr = currentStatValue.toString();
            // Count total digits (excluding decimal point)
            // "2.5" = 2 digits, "2.25" = 3 digits, "20" = 2 digits, "100" = 3 digits
            digitCount = statValueStr.replace('.', '').length;
        } else {
            // Fall back to extracting from stat line text (for testing/default)
            const numericMatch = statLineText.match(/:\s*([\d.]+)/);
            if (numericMatch) {
                const statValueStr = numericMatch[1];
                digitCount = statValueStr.replace('.', '').length;
            }
        }
        
        // Format increment to show appropriate decimal places
        let feedbackText = '+';
        if (Number.isInteger(increment)) {
            feedbackText += increment.toString();
        } else {
            // Round to 1 decimal place for cleaner display
            feedbackText += (Math.round(increment * 10) / 10).toFixed(1);
        }
        
        // Get the base horizontal offset for this stat
        let horizontalOffset = statOffsets[statLineIndex] || 12;
        
        // Adjust offset based on digit count
        // Double digits: +10, Triple digits: +20
        if (digitCount === 2) {
            horizontalOffset += 10;
        } else if (digitCount >= 3) {
            horizontalOffset += 20;
        }
        
        // Create feedback text in green, positioned right after this stat line
        const feedbackX = textX + textWidth + horizontalOffset;
        const upgradeText = this.add.text(feedbackX, yPos, feedbackText, {
            fontSize: '14px',
            fontFamily: 'Tiny5',
            color: '#6ded8a' // Green
        });
        upgradeText.setOrigin(0, 0.5);
        upgradeText.setScrollFactor(0); // Fixed to camera like stats text
        upgradeText.setDepth(1001); // Above everything
        
        // Add gentle hover/levitation effect (like items, but smaller movement)
        this.tweens.add({
            targets: upgradeText,
            y: yPos - 2,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // If permanent (for testing), keep it. Otherwise fade out after pickup
        if (!isPermanent) {
            this.tweens.add({
                targets: upgradeText,
                alpha: 0,
                duration: 500,
                delay: 2500, // Show for 2.5 seconds before fading
                ease: 'Power2',
                onComplete: () => {
                    upgradeText.destroy();
                }
            });
        }
    }

    private updatePowerDisplay() {
        // Clear existing power display
        this.powerDisplay.clear(true, true);

        const power = this.player.getPower();
        const maxPower = this.player.getMaxPower();
        const cubeSize = 20;
        const spacing = 25;
        const startX = 18.75;
        const startY = 48.75; // Moved down a bit more

        // Create bright light blue cubes for each power point
        for (let i = 0; i < maxPower; i++) {
            const cube = this.add.image(
                startX + i * spacing,
                startY,
                'powerCube'
            );
            cube.setDisplaySize(cubeSize, cubeSize);
            cube.setScrollFactor(0); // Fixed to camera (moves with player)
            cube.setDepth(200); // HUD depth
            
            // Dim cubes that represent lost power - use tint for better visibility
            if (i >= power) {
                cube.setAlpha(0.3);
                cube.setTint(0x666666); // Dark gray tint for lost health
            }
            
            this.powerDisplay.add(cube);
        }
    }

    private updateCoinDisplay() {
        // Clear existing coin display
        this.coinDisplay.clear(true, true);

        const coins = this.player.getCoins();
        const coinSize = 20;
        const startX = 18.75;
        const startY = 77.5; // Below health display (moved down)

        // Create coin sprite
        const coinSprite = this.add.image(startX, startY, 'coin');
        coinSprite.setDisplaySize(coinSize, coinSize);
        coinSprite.setScrollFactor(0); // Fixed to camera (moves with player)
        coinSprite.setDepth(200); // HUD depth
        this.coinDisplay.add(coinSprite);

        // Create coin count text (moved higher and closer)
        const coinText = this.add.text(startX + 21, startY - 1, coins.toString(), {
            fontSize: '24px',
            fontFamily: 'Tiny5',
            color: '#ffd700' // Better gold color
        });
        coinText.setOrigin(0, 0.5);
        coinText.setScrollFactor(0); // Fixed to camera (moves with player)
        coinText.setDepth(200); // HUD depth
        this.coinDisplay.add(coinText);
    }

    private createTextures() {
        // Create player texture: simple green block
        if (!this.textures.exists('player')) {
            const graphics = this.add.graphics();
            const size = 30;
            
            graphics.fillStyle(0x6ded8a, 1); // Green (Color 2)
            graphics.fillRect(0, 0, size, size);
            
            graphics.generateTexture('player', size, size);
            graphics.destroy();
        }

        // Create bullet texture (white base - will be tinted green for player, red for enemies)
        if (!this.textures.exists('bullet')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base
            graphics.fillRect(0, 0, 8, 8);
            graphics.generateTexture('bullet', 8, 8);
            graphics.destroy();
        }

        // Create enemy texture (8x8 white base, will be tinted and scaled)
        if (!this.textures.exists('enemy')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base
            graphics.fillRect(0, 0, 8, 8);
            graphics.generateTexture('enemy', 8, 8);
            graphics.destroy();
        }

        // Create power cell texture (bright light blue)
        if (!this.textures.exists('powerCell')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x5ab0ff, 1); // Bright light blue (fits palette)
            graphics.fillRect(0, 0, 15, 15);
            graphics.generateTexture('powerCell', 15, 15);
            graphics.destroy();
        }

        // Create power cube texture for UI (bright light blue)
        if (!this.textures.exists('powerCube')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x5ab0ff, 1); // Bright light blue (fits palette)
            graphics.fillRect(0, 0, 20, 20);
            graphics.generateTexture('powerCube', 20, 20);
            graphics.destroy();
        }

        // Create shooting enemy texture (8x8 diamond shape - solid pixels)
        if (!this.textures.exists('shootingEnemy')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base, will be tinted
            
            // Draw diamond pixel by pixel (8x8 grid)
            // Row 0 (top)
            graphics.fillRect(3, 0, 2, 1);
            // Row 1
            graphics.fillRect(2, 1, 4, 1);
            // Row 2
            graphics.fillRect(1, 2, 6, 1);
            // Row 3
            graphics.fillRect(0, 3, 8, 1);
            // Row 4
            graphics.fillRect(0, 4, 8, 1);
            // Row 5
            graphics.fillRect(1, 5, 6, 1);
            // Row 6
            graphics.fillRect(2, 6, 4, 1);
            // Row 7 (bottom)
            graphics.fillRect(3, 7, 2, 1);
            
            graphics.generateTexture('shootingEnemy', 8, 8);
            graphics.destroy();
        }

        // Create triangle enemy texture (8x8 triangle shape - solid pixels, gradual angles)
        if (!this.textures.exists('triangleEnemy')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base, will be tinted
            
            // Draw triangle pixel by pixel (8x8 grid, pointing up, narrower top and gradual angle)
            // Row 0 (top point - narrower)
            graphics.fillRect(3, 0, 2, 1);
            // Row 1
            graphics.fillRect(3, 1, 2, 1);
            // Row 2
            graphics.fillRect(2, 2, 4, 1);
            // Row 3
            graphics.fillRect(2, 3, 4, 1);
            // Row 4
            graphics.fillRect(1, 4, 6, 1);
            // Row 5
            graphics.fillRect(1, 5, 6, 1);
            // Row 6
            graphics.fillRect(0, 6, 8, 1);
            // Row 7 (bottom)
            graphics.fillRect(0, 7, 8, 1);
            
            graphics.generateTexture('triangleEnemy', 8, 8);
            graphics.destroy();
        }

        // Create X enemy texture (8x8 X shape - solid pixels)
        if (!this.textures.exists('xEnemy')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base, will be tinted
            
            // Draw X pixel by pixel (8x8 grid)
            // Top-left to bottom-right diagonal
            graphics.fillRect(0, 0, 2, 2);
            graphics.fillRect(1, 1, 2, 2);
            graphics.fillRect(2, 2, 2, 2);
            graphics.fillRect(3, 3, 2, 2);
            graphics.fillRect(4, 4, 2, 2);
            graphics.fillRect(5, 5, 2, 2);
            graphics.fillRect(6, 6, 2, 2);
            
            // Top-right to bottom-left diagonal
            graphics.fillRect(6, 0, 2, 2);
            graphics.fillRect(5, 1, 2, 2);
            graphics.fillRect(4, 2, 2, 2);
            // Center already filled by other diagonal
            graphics.fillRect(2, 4, 2, 2);
            graphics.fillRect(1, 5, 2, 2);
            graphics.fillRect(0, 6, 2, 2);
            
            graphics.generateTexture('xEnemy', 8, 8);
            graphics.destroy();
        }

        // Create mimic enemy texture (8x8 chest shape - solid pixels)
        if (!this.textures.exists('mimicEnemy')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base, will be tinted
            
            // Draw chest pixel by pixel (8x8 grid) per user's layout
            // Row 0 - empty (no pixels)
            // Row 1
            graphics.fillRect(2, 1, 4, 1);
            // Row 2
            graphics.fillRect(1, 2, 6, 1);
            // Rows 3-6 (full width)
            graphics.fillRect(0, 3, 8, 1);
            graphics.fillRect(0, 4, 8, 1);
            graphics.fillRect(0, 5, 8, 1);
            graphics.fillRect(0, 6, 8, 1);
            // Row 7 - empty (no pixels)
            
            graphics.generateTexture('mimicEnemy', 8, 8);
            graphics.destroy();
        }

        // Create healer enemy texture (8x8 plus shape with extensions)
        if (!this.textures.exists('healerEnemy')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1); // White base, will be tinted pink
            
            // Draw plus with extensions pixel by pixel (8x8 grid)
            // Row 0 - top extension
            // Top horizontal bar
            graphics.fillRect(2, 0, 4, 1);

            // Vertical stem (top)
            graphics.fillRect(3, 1, 2, 1);
            graphics.fillRect(3, 2, 2, 1);

            // Left vertical bar
            graphics.fillRect(0, 2, 1, 4);

            // Center horizontal bar
            graphics.fillRect(0, 3, 8, 1);
            graphics.fillRect(0, 4, 8, 1);

            // Right vertical bar
            graphics.fillRect(7, 2, 1, 4);

            // Vertical stem (bottom)
            graphics.fillRect(3, 5, 2, 1);
            graphics.fillRect(3, 6, 2, 1);

            // Bottom horizontal bar
            graphics.fillRect(2, 7, 4, 1);

            
            graphics.generateTexture('healerEnemy', 8, 8);
            graphics.destroy();
        }

        // Create dasher enemy texture (8x8 arrow shape - black border, red inside)
        if (!this.textures.exists('dasherEnemy')) {
            // Use canvas for precise color control
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // Fill with transparency
                ctx.clearRect(0, 0, 8, 8);

                /* =========================
                BLACK BORDER (no tint)
                ========================= */
                ctx.fillStyle = '#000000';

                // Full top edge (entire row 0)
                ctx.fillRect(0, 0, 8, 1);

                // Full right edge (entire column 7)
                ctx.fillRect(7, 0, 1, 8);

                /* =========================
                INNER SHAPE (tintable) - Arrow body
                ========================= */
                ctx.fillStyle = '#FFFFFF';

                // Row 0 - now all black (skip)

                // Row 1 (columns 1-6)
                ctx.fillRect(1, 1, 6, 1);

                // Row 2 (columns 2-6)
                ctx.fillRect(2, 2, 5, 1);

                // Row 3 (columns 3-6) - arrow tip
                ctx.fillRect(3, 3, 4, 1);

                // Row 4 (columns 2-6)
                ctx.fillRect(2, 4, 5, 1);

                // Row 5 (columns 1-3, 5-6)
                ctx.fillRect(1, 5, 3, 1);
                ctx.fillRect(5, 5, 2, 1);

                // Row 6 (columns 0-2, 6)
                ctx.fillRect(0, 6, 3, 1);
                ctx.fillRect(6, 6, 1, 1);

                // Row 7 (columns 0-1)
                ctx.fillRect(0, 7, 2, 1);

            }
            
            this.textures.addCanvas('dasherEnemy', canvas);
        }

        // Create glasses texture (20/20 item) - only if image not loaded
        // If you have an 8x8 sprite image, place it at public/images/glasses.png
        // and it will be loaded in preload() instead of creating programmatically
        

        // Create bullseye texture (8x8 for homing item)
        if (!this.textures.exists('bullseye')) {
            const graphics = this.add.graphics();
            const size = 8;
            
            graphics.fillStyle(0xffffff, 1); // White base (will be tinted red)
            
            // Outer ring (circle outline)
            // Top row
            graphics.fillRect(2, 0, 4, 1);
            // Second row
            graphics.fillRect(1, 1, 1, 1);
            graphics.fillRect(6, 1, 1, 1);
            // Left and right edges
            graphics.fillRect(0, 2, 1, 4);
            graphics.fillRect(7, 2, 1, 4);
            // Second to last row
            graphics.fillRect(1, 6, 1, 1);
            graphics.fillRect(6, 6, 1, 1);
            // Bottom row
            graphics.fillRect(2, 7, 4, 1);
            
            // Center dot (2x2)
            graphics.fillRect(3, 3, 2, 2);
            
            graphics.generateTexture('bullseye', size, size);
            graphics.destroy();
        }

        // Create 8x8 plus textures for each stat item type (for inventory display)
        const statItemTypes = [
            { name: 'inventoryDamage', color: 0xff8c42 }, // Orange (matches item pickup)
            { name: 'inventoryShotSpeed', color: 0x9d4edd }, // Purple (matches item pickup)
            { name: 'inventoryBladeLength', color: 0x9d4edd }, // Purple (same as Shot Speed)
            { name: 'inventoryShotRate', color: 0x1645f5 }, // Blue (matches item pickup)
            { name: 'inventorySwingRate', color: 0x1645f5 }, // Blue (same as Shot Rate)
            { name: 'inventoryMoveSpeed', color: 0xff5f85 }, // Pink (matches item pickup)
            { name: 'inventoryLuck', color: 0x6ded8a },
            { name: 'inventoryHealthUp', color: 0x5ab0ff }
        ];

        statItemTypes.forEach(itemType => {
            if (!this.textures.exists(itemType.name)) {
                const graphics = this.add.graphics();
                const size = 8;
                
                graphics.fillStyle(itemType.color, 1);
                
                // Draw 8x8 plus sign (pixel perfect)
                // Vertical bar (middle 2 columns)
                graphics.fillRect(3, 0, 2, 8);
                // Horizontal bar (middle 2 rows)
                graphics.fillRect(0, 3, 8, 2);
                
                graphics.generateTexture(itemType.name, size, size);
                graphics.destroy();
            }
        });

        // Create item texture (plus shape) - 8x8 pixel art
        if (!this.textures.exists('item')) {
            const graphics = this.add.graphics();
            const size = 8;
            
            graphics.fillStyle(0xffffff, 1); // White base, will be tinted
            
            // Draw 8x8 plus sign (pixel perfect, same as inventory items)
            // Vertical bar (middle 2 columns)
            graphics.fillRect(3, 0, 2, 8);
            // Horizontal bar (middle 2 rows)
            graphics.fillRect(0, 3, 8, 2);
            
            graphics.generateTexture('item', size, size);
            graphics.destroy();
        }

        // Create stat dot texture
        if (!this.textures.exists('statDot')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff, 1);
            graphics.fillRect(0, 0, 10, 10);
            graphics.generateTexture('statDot', 10, 10);
            graphics.destroy();
        }

        // Create coin texture (square, gold)
        if (!this.textures.exists('coin')) {
            const graphics = this.add.graphics();
            const size = 15;
            
            // Draw square shape with a nicer gold/yellow color
            graphics.fillStyle(0xffd700, 1); // Better gold color
            graphics.fillRect(0, 0, size, size);
            
            graphics.generateTexture('coin', size, size);
            graphics.destroy();
        }
    }

    private createCheckeredBackground() {
        const tileSize = 50; // Size of each checkered square
        const color1 = 0x252525; // Medium dark gray
        const color2 = 0x2d2d2d; // Slightly lighter gray (more contrast but still neutral)
        
        const backgroundGraphics = this.add.graphics();
        
        // Draw checkered pattern across entire map
        for (let x = 0; x < this.mapWidth; x += tileSize) {
            for (let y = 0; y < this.mapHeight; y += tileSize) {
                // Alternate colors based on position
                const isEvenX = Math.floor(x / tileSize) % 2 === 0;
                const isEvenY = Math.floor(y / tileSize) % 2 === 0;
                const color = (isEvenX === isEvenY) ? color1 : color2;
                
                backgroundGraphics.fillStyle(color, 1);
                backgroundGraphics.fillRect(x, y, tileSize, tileSize);
            }
        }
        
        // Set depth to be behind everything (walls, enemies, player, etc.)
        backgroundGraphics.setDepth(0);
    }

    private createWalls() {
        this.walls = this.add.group();
        const wallThickness = 20;
        
        // Top wall
        const topWall = this.add.rectangle(this.mapWidth / 2, wallThickness / 2, this.mapWidth, wallThickness, 0x000000);
        this.physics.add.existing(topWall, true);
        this.walls.add(topWall);
        
        // Bottom wall
        const bottomWall = this.add.rectangle(this.mapWidth / 2, this.mapHeight - wallThickness / 2, this.mapWidth, wallThickness, 0x000000);
        this.physics.add.existing(bottomWall, true);
        this.walls.add(bottomWall);
        
        // Left wall
        const leftWall = this.add.rectangle(wallThickness / 2, this.mapHeight / 2, wallThickness, this.mapHeight, 0x000000);
        this.physics.add.existing(leftWall, true);
        this.walls.add(leftWall);
        
        // Right wall
        const rightWall = this.add.rectangle(this.mapWidth - wallThickness / 2, this.mapHeight / 2, wallThickness, this.mapHeight, 0x000000);
        this.physics.add.existing(rightWall, true);
        this.walls.add(rightWall);
        
        // Note: Player collision is set up after player is created
        // Enemy collision will be set up when enemies are created
    }

    private createMinimap() {
        // Minimap with 16:9 aspect ratio to match map
        const minimapWidth = 180;
        const minimapHeight = 101; // 16:9 ratio (180 * 9/16 = 101.25)
        // Position minimap fully in top-right (ensure it's fully visible)
        // Screen width is 1280, so position at 1280 - minimapWidth - padding
        const minimapX = 1280 - minimapWidth - 10;
        const minimapY = 10;
        
        // Background for minimap (fixed to camera) - this is the "shaded box" (map)
        // Rectangle origin is center by default, so we need to position it correctly
        this.minimapBg = this.add.rectangle(minimapX + minimapWidth / 2, minimapY + minimapHeight / 2, minimapWidth, minimapHeight, 0x1a1a1a, 0.8);
        this.minimapBg.setScrollFactor(0); // Fixed to camera
        this.minimapBg.setDepth(300); // Above HUD
        // No stroke - just the shaded background
        
        // Graphics for drawing minimap (fixed to camera)
        this.minimapGraphics = this.add.graphics();
        this.minimapGraphics.setScrollFactor(0);
        this.minimapGraphics.setDepth(301);
    }

    private triggerVictorySequence() {
        // Fade screen to white
        this.cameras.main.fadeOut(2000, 255, 255, 255);
        
        // Wait for fade to complete, then go to victory scene
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('VictoryScene');
        });
    }

    private updateMinimap() {
        if (!this.minimapGraphics || !this.player || !this.minimapBg) return;
        
        const minimapWidth = 180;
        const minimapHeight = 101;
        // Get minimap position from the background rectangle
        const minimapX = this.minimapBg.x - minimapWidth / 2;
        const minimapY = this.minimapBg.y - minimapHeight / 2;
        const scaleX = minimapWidth / this.mapWidth;
        const scaleY = minimapHeight / this.mapHeight;
        
        // Clear previous frame
        this.minimapGraphics.clear();
        
        // Draw player viewport (camera view) - green box navigating around the map
        const camera = this.cameras.main;
        // Calculate viewport position in minimap coordinates
        // When player is at map center, viewport should be centered in minimap
        const viewportX = minimapX + camera.worldView.x * scaleX;
        const viewportY = minimapY + camera.worldView.y * scaleY;
        const viewportWidth = camera.width * scaleX;
        const viewportHeight = camera.height * scaleY;
        
        // Draw viewport box (clamp to minimap bounds if needed)
        const clampedX = Math.max(minimapX, Math.min(viewportX, minimapX + minimapWidth - viewportWidth));
        const clampedY = Math.max(minimapY, Math.min(viewportY, minimapY + minimapHeight - viewportHeight));
        const clampedWidth = Math.min(viewportWidth, minimapX + minimapWidth - clampedX);
        const clampedHeight = Math.min(viewportHeight, minimapY + minimapHeight - clampedY);
        
        this.minimapGraphics.lineStyle(2, 0x33FF00, 1); // Green outline for viewport
        this.minimapGraphics.strokeRect(clampedX, clampedY, clampedWidth, clampedHeight);
        
        // Draw enemies on minimap (only if within minimap bounds)
        this.enemies.children.entries.forEach((enemy: any) => {
            if (enemy && enemy.active) {
                const enemyX = minimapX + enemy.x * scaleX;
                const enemyY = minimapY + enemy.y * scaleY;
                // Only draw if within minimap bounds
                if (enemyX >= minimapX && enemyX <= minimapX + minimapWidth &&
                    enemyY >= minimapY && enemyY <= minimapY + minimapHeight) {
                    this.minimapGraphics.fillStyle(0xFF1100, 1); // Bright bright red for enemies
                    this.minimapGraphics.fillRect(enemyX - 2, enemyY - 2, 4, 4); // 4x4 pixels
                }
            }
        });
        
        // Draw boss on minimap (4x size of normal enemies - 16x16 pixels)
        if (this.boss && this.boss.active) {
            const bossX = minimapX + this.boss.x * scaleX;
            const bossY = minimapY + this.boss.y * scaleY;
            // Only draw if within minimap bounds
            if (bossX >= minimapX && bossX <= minimapX + minimapWidth &&
                bossY >= minimapY && bossY <= minimapY + minimapHeight) {
                this.minimapGraphics.fillStyle(0xFF1100, 1); // Same red as enemies
                this.minimapGraphics.fillRect(bossX - 8, bossY - 8, 16, 16); // 16x16 (4x the 4x4 enemy dot)
            }
        }
    }

    private createInventoryDisplay() {
        // Create container for inventory items below minimap
        const minimapWidth = 180;
        const minimapHeight = 101;
        const minimapX = 1280 - minimapWidth - 10;
        const minimapY = 10;
        const inventoryY = minimapY + minimapHeight + 10; // 10px padding below minimap
        
        // Create container at the inventory position
        this.inventoryContainer = this.add.container(minimapX, inventoryY);
        this.inventoryContainer.setScrollFactor(0); // Fixed to camera
        this.inventoryContainer.setDepth(300); // Same depth as minimap
    }

    private updateInventoryDisplay() {
        // Clear existing display
        this.inventoryContainer.removeAll(true);
        
        const minimapWidth = 180;
        const itemSize = 16; // 8x8 texture scaled 2x
        const itemsPerRow = 4;
        const slotWidth = minimapWidth / itemsPerRow; // 37.5px per slot
        const rowHeight = itemSize + 30; // 4px vertical spacing
        
        // Display items (most recent first)
        this.collectedItems.forEach((itemType, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            
            // Center each item in its slot
            const x = col * slotWidth + (slotWidth - itemSize) / 2;
            const y = row * rowHeight;
            
            // Get texture name based on type
            let textureName = '';
            let tintColor = 0xffffff;
            
            // Handle Power Button specially (12x12 sprite at 7x scale) - early return
            if (itemType === ItemType.POWER_BUTTON) {
                // Power button is 7x scale, so 12 * 7 = 84, but scale proportionally to inventory
                const powerButtonSize = (itemSize / 8) * 12 * (7 / 3); // 7x instead of 3x
                const pbSprite = this.add.image(x + itemSize / 2, y + itemSize / 2, 'powerbutton');
                pbSprite.setDisplaySize(powerButtonSize, powerButtonSize);
                pbSprite.setAlpha(0.6);
                this.inventoryContainer.add(pbSprite);
                return; // Skip rest of logic
            }
            
            switch (itemType) {
                case ItemType.DAMAGE:
                    textureName = 'inventoryDamage';
                    break;
                case ItemType.SHOT_SPEED:
                    textureName = 'inventoryShotSpeed';
                    break;
                case ItemType.SHOT_RATE:
                    textureName = 'inventoryShotRate';
                    break;
                case ItemType.SWING_RATE:
                    textureName = 'inventorySwingRate';
                    break;
                case ItemType.MOVE_SPEED:
                    textureName = 'inventoryMoveSpeed';
                    break;
                case ItemType.LUCK:
                    textureName = 'inventoryLuck';
                    break;
                case ItemType.HEALTH_UP:
                    textureName = 'inventoryHealthUp';
                    break;
                case ItemType.TWENTY_TWENTY:
                    textureName = 'glasses';
                    break;
                case ItemType.HOMING:
                    textureName = 'bullseye';
                    tintColor = 0xff3333;
                    break;
                case ItemType.BLADE_LENGTH:
                    textureName = 'inventoryBladeLength';
                    break;
                case ItemType.SWORD:
                    textureName = 'sword';
                    break;
                case ItemType.OVERCLOCK:
                    textureName = 'overclock';
                    break;
                case ItemType.HARDWARE_ACCELERATION:
                    textureName = 'hardware';
                    break;
                case ItemType.ANTIVIRUS_UPDATE:
                    textureName = 'shield';
                    break;
            }
            
            if (textureName) {
                // Use sprite texture
                const sprite = this.add.image(x + itemSize / 2, y + itemSize / 2, textureName);
                sprite.setDisplaySize(itemSize, itemSize);
                sprite.setAlpha(0.6); // Semi-transparent
                
                // Apply tint if needed
                if (tintColor !== 0xffffff) {
                    sprite.setTint(tintColor);
                }
                
                this.inventoryContainer.add(sprite);
            }
        });
    }

}
