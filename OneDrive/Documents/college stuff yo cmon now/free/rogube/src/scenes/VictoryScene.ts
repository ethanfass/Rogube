import Phaser from 'phaser';

export default class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
    }

    preload() {
        // Load win sound
        this.load.audio('win', 'sounds/win.wav');
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background (set to final dark color immediately)
        this.cameras.main.setBackgroundColor(0x1a1a1a);
        
        // Fade FROM white TO transparent (revealing dark background)
        this.cameras.main.fadeIn(1000, 255, 255, 255);
        
        // Play win sound after fade completes and text is visible
        this.cameras.main.once('camerafadeincomplete', () => {
            this.sound.play('win', { volume: 0.5 });
        });

        // "Victory" message in yellow
        const victoryMessage = this.add.text(width / 2, height / 2 - 80, 'Victory', {
            fontSize: '64px',
            fontFamily: 'Tiny5',
            color: '#FFD700' // Gold/Yellow
        });
        victoryMessage.setOrigin(0.5);

        // "you the goat fr" message
        const goatText = this.add.text(width / 2, height / 2, 'you the goat fr', {
            fontSize: '32px',
            fontFamily: 'Tiny5',
            color: '#ffffff' // White text on dark background
        });
        goatText.setOrigin(0.5);

        // Main Menu button
        const buttonWidth = 250;
        const buttonHeight = 60;
        const buttonX = width / 2;
        const buttonY = height / 2 + 100;

        // Main Menu button background
        const mainMenuBg = this.add.graphics();
        mainMenuBg.fillStyle(0x33FF00, 1); // Green
        mainMenuBg.fillRect(
            buttonX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            buttonWidth,
            buttonHeight
        );

        // Main Menu button text
        const mainMenuText = this.add.text(buttonX, buttonY, 'Main Menu', {
            fontSize: '32px',
            fontFamily: 'Tiny5',
            color: '#282828'
        });
        mainMenuText.setOrigin(0.5);

        // Make Main Menu button interactive
        const mainMenuZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight);
        mainMenuZone.setInteractive({ useHandCursor: true });

        // Main Menu button hover effect
        mainMenuZone.on('pointerover', () => {
            mainMenuBg.clear();
            mainMenuBg.fillStyle(0x3FFF11, 1); // Brighter green (hover)
            mainMenuBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        mainMenuZone.on('pointerout', () => {
            mainMenuBg.clear();
            mainMenuBg.fillStyle(0x33FF00, 1); // Green
            mainMenuBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        // Main Menu button click - go to main menu
        mainMenuZone.on('pointerdown', () => {
            this.scene.start('StartScene');
        });
    }
}
