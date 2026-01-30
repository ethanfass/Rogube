import Phaser from 'phaser';

export default class EndScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EndScene' });
    }

    preload() {
        // Load lose sound
        this.load.audio('lose', 'sounds/lose.wav');
    }

    create(data?: { wave?: number; weaponType?: 'gun' | 'sword'; isEndlessMode?: boolean; endlessTotalKills?: number; endlessWave?: number }) {
        // Play lose sound
        this.sound.play('lose', { volume: 0.5 });
        const { width, height } = this.cameras.main;

        // Background (same as game)
        this.cameras.main.setBackgroundColor(0x2d2d2d);

        // "You died" message
        const deathMessage = this.add.text(width / 2, height / 2 - 120, 'You Died', {
            fontSize: '64px',
            fontFamily: 'Tiny5',
            color: '#FF1100' // Bright red (same as enemy color)
        });
        deathMessage.setOrigin(0.5);

        // Wave reached message
        let yPosition = height / 2 - 60;
        const waveReached = data?.wave || 1;
        const waveText = this.add.text(width / 2, yPosition, `Wave reached: ${waveReached}`, {
            fontSize: '32px',
            fontFamily: 'Tiny5',
            color: '#ffffff'
        });
        waveText.setOrigin(0.5);
        
        // Endless mode stats
        if (data?.isEndlessMode) {
            yPosition += 40;
            const endlessWaveText = this.add.text(width / 2, yPosition, `Endless waves completed: ${(data?.endlessWave || 1) - 1}`, {
                fontSize: '28px',
                fontFamily: 'Tiny5',
                color: '#ffffff'
            });
            endlessWaveText.setOrigin(0.5);
            
            yPosition += 35;
            const totalKillsText = this.add.text(width / 2, yPosition, `Total endless kills: ${data?.endlessTotalKills || 0}`, {
                fontSize: '28px',
                fontFamily: 'Tiny5',
                color: '#6ded8a' // Green highlight
            });
            totalKillsText.setOrigin(0.5);
        }

        // Play again button (adjust position based on endless mode)
        const buttonWidth = 250;
        const buttonHeight = 60;
        const buttonX = width / 2;
        const buttonY = data?.isEndlessMode ? height / 2 + 90 : height / 2 + 60;

        // Play Again button background
        const playAgainBg = this.add.graphics();
        playAgainBg.fillStyle(0x33FF00, 1); // Green
        playAgainBg.fillRect(
            buttonX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            buttonWidth,
            buttonHeight
        );

        // Play Again button text
        const playAgainText = this.add.text(buttonX, buttonY, 'Play Again', {
            fontSize: '32px',
            fontFamily: 'Tiny5',
            color: '#282828'
        });
        playAgainText.setOrigin(0.5);

        // Make Play Again button interactive
        const playAgainZone = this.add.zone(buttonX, buttonY, buttonWidth, buttonHeight);
        playAgainZone.setInteractive({ useHandCursor: true });

        // Play Again button hover effect
        playAgainZone.on('pointerover', () => {
            playAgainBg.clear();
            playAgainBg.fillStyle(0x3FFF11, 1); // Brighter green (hover)
            playAgainBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        playAgainZone.on('pointerout', () => {
            playAgainBg.clear();
            playAgainBg.fillStyle(0x33FF00, 1); // Green
            playAgainBg.fillRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        // Play Again button click - restart the game with class selection
        playAgainZone.on('pointerdown', () => {
            this.scene.start('GameScene', { weaponType: 'gun' }); // Always start with gun
        });

        // Main Menu button
        const mainMenuY = buttonY + 80;

        // Main Menu button background
        const mainMenuBg = this.add.graphics();
        mainMenuBg.fillStyle(0xAAAAAA, 1); // Light gray
        mainMenuBg.fillRect(
            buttonX - buttonWidth / 2,
            mainMenuY - buttonHeight / 2,
            buttonWidth,
            buttonHeight
        );

        // Main Menu button text
        const mainMenuText = this.add.text(buttonX, mainMenuY, 'Main Menu', {
            fontSize: '32px',
            fontFamily: 'Tiny5',
            color: '#282828'
        });
        mainMenuText.setOrigin(0.5);

        // Make Main Menu button interactive
        const mainMenuZone = this.add.zone(buttonX, mainMenuY, buttonWidth, buttonHeight);
        mainMenuZone.setInteractive({ useHandCursor: true });

        // Main Menu button hover effect
        mainMenuZone.on('pointerover', () => {
            mainMenuBg.clear();
            mainMenuBg.fillStyle(0xCCCCCC, 1); // Lighter gray (hover)
            mainMenuBg.fillRect(
                buttonX - buttonWidth / 2,
                mainMenuY - buttonHeight / 2,
                buttonWidth,
                buttonHeight
            );
        });

        mainMenuZone.on('pointerout', () => {
            mainMenuBg.clear();
            mainMenuBg.fillStyle(0xAAAAAA, 1); // Light gray
            mainMenuBg.fillRect(
                buttonX - buttonWidth / 2,
                mainMenuY - buttonHeight / 2,
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
