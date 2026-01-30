import Phaser from 'phaser';

export default class StartScene extends Phaser.Scene {
    constructor() {
        super({ key: 'StartScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background
        this.cameras.main.setBackgroundColor(0x1a1a1a);

        // Game title
        const title = this.add.text(width / 2, height / 2 - 100, 'Rogube', {
            fontSize: '64px',
            fontFamily: 'Tiny5',
            color: '#ffffff'
        });
        title.setOrigin(0.5);

        // Pronunciation
        const pronunciation = this.add.text(width / 2, height / 2 - 30, '(row-guh-bay)', {
            fontSize: '24px',
            fontFamily: 'Tiny5',
            color: '#aaaaaa'
        });
        pronunciation.setOrigin(0.5);

        // Play button
        const buttonWidth = 200;
        const buttonHeight = 60;
        const buttonX = width / 2;
        const buttonY = height / 2 + 80;

        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x33FF00, 1); // Green
        buttonBg.fillRect(
            buttonX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            buttonWidth,
            buttonHeight
        );

        // Button text
        const buttonText = this.add.text(buttonX, buttonY, 'Play', {
            fontSize: '32px',
            fontFamily: 'Tiny5',
            color: '#282828'
        });
        buttonText.setOrigin(0.5);

        // Make button interactive
        const buttonZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight);
        buttonZone.setInteractive({ useHandCursor: true });

        // Button hover effect
        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x33FF00, 1); // Green (hover)
            buttonBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x33FF00, 1); // Green
            buttonBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        // Button click
        buttonZone.on('pointerdown', () => {
            // Start game directly without class selection (gunner by default)
            this.scene.start('GameScene', { weaponType: 'gun' });
        });
    }
}
