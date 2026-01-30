import Phaser from 'phaser';
import StartScene from './scenes/StartScene';
import GameScene from './scenes/GameScene';
import EndScene from './scenes/EndScene';
import VictoryScene from './scenes/VictoryScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#2d2d2d',
    pixelArt: true, // Enable pixel-perfect rendering (nearest-neighbor scaling)
    render: {
        roundPixels: false // Allow sub-pixel rendering for smooth movement
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    audio: {
        disableWebAudio: false
    },
    scene: [StartScene, GameScene, EndScene, VictoryScene]
};

// Preload font before starting game
const font = new FontFace('Tiny5', 'url(/fonts/Tiny5-Regular.ttf)');
font.load().then((loadedFont) => {
    document.fonts.add(loadedFont);
}).catch((error) => {
    console.error('Font loading failed:', error);
}).finally(() => {
    new Phaser.Game(config);
});
