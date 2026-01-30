import Phaser from 'phaser';

export default class ClassSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClassSelectScene' });
    }

    preload() {
        // Load assets needed for class select screen
        this.load.image('cymon', 'images/cymon.png');
        this.load.image('sword', 'weapons/sword.png');
        this.load.image('bullet', 'images/bullet.png');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background
        this.cameras.main.setBackgroundColor(0x1a1a1a);

        // Title
        const title = this.add.text(width / 2, 80, 'Choose Class', {
            fontSize: '48px',
            fontFamily: 'Tiny5',
            color: '#ffffff'
        });
        title.setOrigin(0.5);

        // Create bullet texture if not exists (for gunner display)
        if (!this.textures.exists('bulletDisplay')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x33FF00, 1); // Green bullet
            graphics.fillRect(0, 0, 8, 8);
            graphics.generateTexture('bulletDisplay', 8, 8);
            graphics.destroy();
        }

        // === GUNNER CLASS (Left side) ===
        const gunnerX = width / 4;
        const classY = height / 2 - 20;
        
        // Gunner button background
        const gunnerBg = this.add.graphics();
        gunnerBg.fillStyle(0x333333, 1);
        gunnerBg.fillRect(gunnerX - 100, classY - 80, 200, 200);
        
        // Gunner label
        const gunnerLabel = this.add.text(gunnerX, classY - 60, 'Gunner', {
            fontSize: '28px',
            fontFamily: 'Tiny5',
            color: '#33FF00'
        });
        gunnerLabel.setOrigin(0.5);

        // Cymon sprite for gunner
        const gunnerCymon = this.add.image(gunnerX - 20, classY + 20, 'cymon');
        gunnerCymon.setDisplaySize(40, 40); // 8x8 * 5
        const cymonTexture = this.textures.get('cymon');
        if (cymonTexture) {
            cymonTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }

        // Bullet in front of cymon (shooting right)
        const gunnerBullet = this.add.image(gunnerX + 30, classY + 20, 'bulletDisplay');
        gunnerBullet.setDisplaySize(16, 16); // 8x8 * 2
        
        // Gunner description
        const gunnerDesc = this.add.text(gunnerX, classY + 80, 'Ranged attacks\n1 DMG per shot', {
            fontSize: '14px',
            fontFamily: 'Tiny5',
            color: '#aaaaaa',
            align: 'center'
        });
        gunnerDesc.setOrigin(0.5);

        // Gunner interactive zone
        const gunnerZone = this.add.zone(gunnerX, classY + 20, 200, 200);
        gunnerZone.setInteractive({ useHandCursor: true });
        
        gunnerZone.on('pointerover', () => {
            gunnerBg.clear();
            gunnerBg.fillStyle(0x444444, 1);
            gunnerBg.fillRect(gunnerX - 100, classY - 80, 200, 200);
            gunnerBg.lineStyle(2, 0x33FF00, 1);
            gunnerBg.strokeRect(gunnerX - 100, classY - 80, 200, 200);
        });
        
        gunnerZone.on('pointerout', () => {
            gunnerBg.clear();
            gunnerBg.fillStyle(0x333333, 1);
            gunnerBg.fillRect(gunnerX - 100, classY - 80, 200, 200);
        });
        
        gunnerZone.on('pointerdown', () => {
            this.scene.start('GameScene', { weaponType: 'gun' });
        });

        // === DUELIST CLASS (Right side) ===
        const duelistX = (width / 4) * 3;
        
        // Duelist button background
        const duelistBg = this.add.graphics();
        duelistBg.fillStyle(0x333333, 1);
        duelistBg.fillRect(duelistX - 100, classY - 80, 200, 200);
        
        // Duelist label
        const duelistLabel = this.add.text(duelistX, classY - 60, 'Duelist', {
            fontSize: '28px',
            fontFamily: 'Tiny5',
            color: '#ff5f85' // Pink
        });
        duelistLabel.setOrigin(0.5);

        // Cymon sprite for duelist
        const duelistCymon = this.add.image(duelistX - 20, classY + 20, 'cymon');
        duelistCymon.setDisplaySize(40, 40); // 8x8 * 5

        // Sword in front of cymon
        const duelistSword = this.add.image(duelistX + 30, classY + 20, 'sword');
        duelistSword.setDisplaySize(32, 32); // 8x8 * 4 (matches in-game)
        duelistSword.setAngle(0); // Angled like being held (top-right is tip)
        const swordTexture = this.textures.get('sword');
        if (swordTexture) {
            swordTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
        
        // Duelist description
        const duelistDesc = this.add.text(duelistX, classY + 80, 'Melee attacks\n3 DMG per hit', {
            fontSize: '14px',
            fontFamily: 'Tiny5',
            color: '#aaaaaa',
            align: 'center'
        });
        duelistDesc.setOrigin(0.5);

        // Duelist interactive zone
        const duelistZone = this.add.zone(duelistX, classY + 20, 200, 200);
        duelistZone.setInteractive({ useHandCursor: true });
        
        duelistZone.on('pointerover', () => {
            duelistBg.clear();
            duelistBg.fillStyle(0x444444, 1);
            duelistBg.fillRect(duelistX - 100, classY - 80, 200, 200);
            duelistBg.lineStyle(2, 0xff5f85, 1);
            duelistBg.strokeRect(duelistX - 100, classY - 80, 200, 200);
        });
        
        duelistZone.on('pointerout', () => {
            duelistBg.clear();
            duelistBg.fillStyle(0x333333, 1);
            duelistBg.fillRect(duelistX - 100, classY - 80, 200, 200);
        });
        
        duelistZone.on('pointerdown', () => {
            this.scene.start('GameScene', { weaponType: 'sword' });
        });

        // Back button
        const backText = this.add.text(width / 2, height - 50, '< Back', {
            fontSize: '20px',
            fontFamily: 'Tiny5',
            color: '#666666'
        });
        backText.setOrigin(0.5);
        backText.setInteractive({ useHandCursor: true });
        
        backText.on('pointerover', () => {
            backText.setColor('#ffffff');
        });
        
        backText.on('pointerout', () => {
            backText.setColor('#666666');
        });
        
        backText.on('pointerdown', () => {
            this.scene.start('StartScene');
        });
    }
}
