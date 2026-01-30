import Phaser from 'phaser';

export enum ItemType {
    DAMAGE = 'damage',
    SHOT_SPEED = 'shotSpeed',
    SHOT_RATE = 'shotRate',
    SWING_RATE = 'swingRate',
    MOVE_SPEED = 'moveSpeed',
    LUCK = 'luck',
    HEALTH_UP = 'healthUp',
    TWENTY_TWENTY = 'twentyTwenty',
    HOMING = 'homing',
    BLADE_LENGTH = 'bladeLength',
    SWORD = 'sword',
    OVERCLOCK = 'overclock',
    HARDWARE_ACCELERATION = 'hardwareAcceleration',
    ANTIVIRUS_UPDATE = 'antivirusUpdate',
    POWER_BUTTON = 'powerButton'
}

export enum RarityColor {
    COMMON = '#888888',
    RARE = '#1645f5',
    LEGENDARY = '#e8a628',
}

export default class Item extends Phaser.Physics.Arcade.Image {
    private itemType: ItemType;
    private itemName: string;
    private description: string;
    private rarity: string;
    private color: number;

    constructor(scene: Phaser.Scene, x: number, y: number, itemType: ItemType) {
        super(scene, x, y, 'item');
        
        this.itemType = itemType;
        
        // Set color, name, description, and rarity based on item type
        switch (itemType) {
            case ItemType.DAMAGE:
                this.color = 0xff8c42; // Orange
                this.itemName = 'Damage Up';
                this.description = 'DMG +50%';
                this.rarity = 'Common';
                break;
            case ItemType.SHOT_SPEED:
                this.color = 0x9d4edd; // Purple
                this.itemName = 'Shot Speed Up';
                this.description = 'Shot Speed +50%';
                this.rarity = 'Common';
                break;
            case ItemType.SHOT_RATE:
                this.color = 0x1645f5; // Blue (Color 3)
                this.itemName = 'Shot Rate Up';
                this.description = 'Shot Rate +50%';
                this.rarity = 'Common';
                break;
            case ItemType.SWING_RATE:
                this.color = 0x1645f5; // Blue (same as Shot Rate)
                this.itemName = 'Swing Rate Up';
                this.description = 'Swing Rate +50%';
                this.rarity = 'Common';
                break;
            case ItemType.MOVE_SPEED:
                this.color = 0xff5f85; // Pink (Color 4)
                this.itemName = 'Move Speed Up';
                this.description = 'Move Speed +50%';
                this.rarity = 'Common';
                break;
            case ItemType.LUCK:
                this.color = 0x6ded8a; // Old green (exclusively for luck)
                this.itemName = 'Luck Up';
                this.description = 'Luck +1';
                this.rarity = 'Common';
                break;
            case ItemType.HEALTH_UP:
                this.color = 0x5ab0ff; // Bright light blue (same as health containers)
                this.itemName = 'Health Up';
                this.description = 'Max HP +1';
                this.rarity = 'Common';
                break;
            case ItemType.TWENTY_TWENTY:
                this.color = 0x000000; // Black for glasses
                this.itemName = '20/20';
                this.description = 'Shoot 2 shots at once';
                this.rarity = 'Legendary';
                break;
            case ItemType.HOMING:
                this.color = 0xff3333; // Red
                this.itemName = 'Bullseye';
                this.description = 'Homing shots';
                this.rarity = 'Legendary';
                break;
            case ItemType.BLADE_LENGTH:
                this.color = 0x9d4edd; // Purple (same as Shot Speed)
                this.itemName = 'Blade Length Up';
                this.description = 'Blade Length +50%';
                this.rarity = 'Common';
                break;
            case ItemType.SWORD:
                this.color = 0xe8a628; // Gold (legendary color)
                this.itemName = 'Arkhalis';
                this.description = 'Melee combat, +2 Damage';
                this.rarity = 'Legendary';
                break;
            case ItemType.OVERCLOCK:
                this.color = 0x1645f5; // Blue (rare)
                this.itemName = 'Overclock';
                this.description = 'Shot Rate +50%, DMG +50%';
                this.rarity = 'Rare';
                break;
            case ItemType.HARDWARE_ACCELERATION:
                this.color = 0x1645f5; // Blue (rare)
                this.itemName = 'Hardware Acceleration';
                this.description = 'Shot Rate +50%, Shot Speed +50%, Move Speed +50%';
                this.rarity = 'Rare';
                break;
            case ItemType.ANTIVIRUS_UPDATE:
                this.color = 0x1645f5; // Blue (rare)
                this.itemName = 'Antivirus Update';
                this.description = 'Luck +1, Max HP +1, DMG +50%';
                this.rarity = 'Rare';
                break;
            case ItemType.POWER_BUTTON:
                this.color = 0xffffff; // White
                this.itemName = 'Power Button';
                this.description = 'Safely shut the system down';
                this.rarity = 'None'; // No rarity
                break;
        }
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Use special textures for unique items, otherwise use regular item texture
        if (itemType === ItemType.TWENTY_TWENTY) {
            // Create composite with fully transparent 8x8 box + glasses
            const compositeTextureName = 'twentyTwentyComposite';
            if (!scene.textures.exists(compositeTextureName)) {
                const canvas = document.createElement('canvas');
                canvas.width = 8;
                canvas.height = 8;
                const ctx = canvas.getContext('2d')!;
                
                // Draw a fully transparent 8x8 box outline (just for glow detection)
                ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Nearly invisible but detectable
                ctx.fillRect(0, 0, 8, 8);
                
                // Draw the glasses sprite on top at full opacity
                const glassesTexture = scene.textures.get('glasses');
                if (glassesTexture) {
                    const glassesImg = glassesTexture.getSourceImage() as HTMLImageElement;
                    ctx.drawImage(glassesImg, 0, 0, 8, 8);
                }
                
                scene.textures.addCanvas(compositeTextureName, canvas);
            }
            
            this.setTexture(compositeTextureName);
            const texture = scene.textures.get(compositeTextureName);
            if (texture) texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            
            this.setDisplaySize(24, 24); // Display at 24x24 (3x scale)
            this.setOrigin(0.5, 0.5);
            this.x = Math.round(x);
            this.y = Math.round(y);
        } else if (itemType === ItemType.HOMING) {
            this.setTexture('bullseye');
            // For pixel art, use nearest-neighbor scaling to keep it crisp
            const texture = scene.textures.get('bullseye');
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
            // 8x8 sprite displayed as 24x24 (scale 3) for pixel-perfect rendering
            this.setDisplaySize(24, 24);
            this.setOrigin(0.5, 0.5);
            this.x = Math.round(x);
            this.y = Math.round(y);
            // Tint red for legendary homing item
            this.setTint(0xff3333);
        } else if (itemType === ItemType.SWORD) {
            // Create composite with fully transparent 8x8 box + sword sprite
            const compositeTextureName = 'arkhalisComposite';
            if (!scene.textures.exists(compositeTextureName)) {
                const canvas = document.createElement('canvas');
                canvas.width = 8;
                canvas.height = 8;
                const ctx = canvas.getContext('2d')!;
                
                // Draw a fully transparent 8x8 box outline (just for glow detection)
                ctx.fillStyle = 'rgba(255, 255, 255, 0)'; // Nearly invisible but detectable
                ctx.fillRect(0, 0, 8, 8);
                
                // Draw the sword sprite on top at full opacity
                const swordTexture = scene.textures.get('sword');
                if (swordTexture) {
                    const swordImg = swordTexture.getSourceImage() as HTMLImageElement;
                    ctx.drawImage(swordImg, 0, 0, 8, 8);
                }
                
                scene.textures.addCanvas(compositeTextureName, canvas);
            }
            
            this.setTexture(compositeTextureName);
            const texture = scene.textures.get(compositeTextureName);
            if (texture) texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            
            this.setDisplaySize(24, 24); // Display at 24x24 (3x scale)
            this.setOrigin(0.5, 0.5);
            this.x = Math.round(x);
            this.y = Math.round(y);
        } else if (itemType === ItemType.POWER_BUTTON) {
            // Power button is 12x12, display at 84x84 (7x scale)
            this.setTexture('powerbutton');
            const texture = scene.textures.get('powerbutton');
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
            this.setDisplaySize(84, 84); // Display at 84x84 (12x12 * 7)
            this.setOrigin(0.5, 0.5);
            this.x = Math.round(x);
            this.y = Math.round(y);
            // Don't tint - let the sprite show its original colors
        } else if (itemType === ItemType.OVERCLOCK || itemType === ItemType.HARDWARE_ACCELERATION || itemType === ItemType.ANTIVIRUS_UPDATE) {
            // Use the sprite for the new rare items (8x8)
            const textureNames: { [key: string]: string } = {
                [ItemType.OVERCLOCK]: 'overclock',
                [ItemType.HARDWARE_ACCELERATION]: 'hardware',
                [ItemType.ANTIVIRUS_UPDATE]: 'shield'
            };
            const textureName = textureNames[itemType];
            this.setTexture(textureName);
            const texture = scene.textures.get(textureName);
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
            this.setDisplaySize(24, 24); // Display at 24x24 (8x8 * 3)
            this.setOrigin(0.5, 0.5);
            this.x = Math.round(x);
            this.y = Math.round(y);
            // Don't tint - let the sprite show its original colors
        } else {
            this.setTexture('item');
            // For pixel art, use nearest-neighbor scaling to keep it crisp
            const texture = scene.textures.get('item');
            if (texture) {
                texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
            // 8x8 sprite displayed as 24x24 (scale 3) for pixel-perfect rendering
            this.setDisplaySize(24, 24);
            this.setOrigin(0.5, 0.5);
            this.x = Math.round(x);
            this.y = Math.round(y);
            this.setTint(this.color);
        }
        
        // Set physics body size to match original sprite size (8x8) for ALL items
        // Since we use setDisplaySize (not setScale), the body won't be auto-scaled
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(8, 8); // 8x8 original sprite size - exact collision for all items
        
        // Add rarity stripes below the item
        this.createRarityStripes(scene);
        
        // Add levitation animation with rounded values for pixel-perfect movement
        const startY = Math.round(this.y);
        const endY = Math.round(startY - 15);
        scene.tweens.add({
            targets: this,
            y: endY,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                // Round Y position each frame to prevent sub-pixel jitter for all items
                this.y = Math.round(this.y);
                
                // Update stripe positions to follow the item
                const numStripes = this.getData('numStripes');
                if (numStripes) {
                    const itemPixel = 3;
                    const gap = 2 * itemPixel; // 3 display pixels
                    const lineHeight = 1 * itemPixel; // 3 display pixels
                    const lineSpacing = 1 * itemPixel; // 3 display pixels gap between lines
                    
                    for (let i = 0; i < numStripes; i++) {
                        const stripe = this.getData(`stripe${i}`) as Phaser.GameObjects.Graphics;
                        if (stripe && stripe.active) {
                            const offsetY = 12 + gap + (i * (lineHeight + lineSpacing));
                            stripe.setPosition(this.x, this.y + offsetY);
                        }
                    }
                }
            }
        });
    }
    
    private createRarityStripes(scene: Phaser.Scene) {
        // Item pixels are 3 display pixels (8x8 sprite -> 24x24 display)
        const itemPixel = 3;
        
        // Get rarity color
        let rarityColor = 0x888888; // Common (gray)
        if (this.rarity === 'Rare') {
            rarityColor = 0x1645f5; // Gold
        } else if (this.rarity === 'Legendary') {
            rarityColor = 0xe8a628; // Blue
        }
        
        // Pedestal design (in item pixels):
        // - 1 pixel gap below item
        // - Line 1: 10 pixels wide (all rarities)
        // - 1 pixel gap
        // - Line 2: 6 pixels wide (rare & legendary only)
        // - 1 pixel gap
        // - Line 3: 2 pixels wide (legendary only)
        // Each line is 1 pixel tall
        
        const gap = 1 * itemPixel; // 3 display pixels
        const lineHeight = 1 * itemPixel; // 3 display pixels
        const lineSpacing = 1 * itemPixel; // 3 display pixels gap between lines
        
        const stripeWidths = [10 * itemPixel, 6 * itemPixel, 2 * itemPixel]; // [30, 18, 6] display pixels
        let numStripes = 1; // Common: 1 line
        if (this.rarity === 'Rare') numStripes = 2;
        if (this.rarity === 'Legendary') numStripes = 3;
        
        for (let i = 0; i < numStripes; i++) {
            const stripe = scene.add.graphics();
            stripe.fillStyle(rarityColor, 1);
            
            const width = stripeWidths[i];
            stripe.fillRect(-width / 2, 0, width, lineHeight);
            
            // Position: below item + gap + line offset
            // 12 is half the item display height (24/2)
            const offsetY = 12 + gap + (i * (lineHeight + lineSpacing));
            stripe.setPosition(this.x, this.y + offsetY);
            stripe.setDepth(this.depth);
            
            // Store reference for updates and cleanup
            this.setData(`stripe${i}`, stripe);
        }
        
        this.setData('numStripes', numStripes);
    }

    getItemType(): ItemType {
        return this.itemType;
    }

    getName(): string {
        return this.itemName;
    }

    getDescription(): string {
        return this.description;
    }

    getRarity(): string {
        return this.rarity;
    }

    getColor(): number {
        return this.color;
    }

    destroy() {
        // Clean up rarity stripes
        const numStripes = this.getData('numStripes');
        if (numStripes) {
            for (let i = 0; i < numStripes; i++) {
                const stripe = this.getData(`stripe${i}`) as Phaser.GameObjects.Graphics;
                if (stripe) {
                    stripe.destroy();
                }
            }
        }
        
        // Clean up cost text if it exists
        const costText = this.getData('costText') as Phaser.GameObjects.Text;
        if (costText && costText.active) {
            costText.destroy();
        }
        
        super.destroy();
    }
}
