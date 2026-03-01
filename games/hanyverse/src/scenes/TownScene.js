import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { ResponsiveLayout } from '../utils/responsive.js';
import { DEFAULT_BUILDINGS, EMPTY_LOTS } from '../data/buildingsData.js';
import { StorageManager } from '../managers/StorageManager.js';
import Building from '../components/town/Building.js';
import EmptyLot from '../components/town/EmptyLot.js';
import PlayerCharacter from '../components/town/PlayerCharacter.js';

export default class TownScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TownScene' });
  }

  init(data) {
    this.avatarConfig = data?.avatar || null;
  }

  create() {
    this.layout = new ResponsiveLayout(this);
    this.cameras.main.fadeIn(500);

    // Load or initialize player state
    this.playerState = StorageManager.loadPlayerState();

    // City configuration - BIGGER!
    this.cityConfig = {
      worldWidth: 2400,
      worldHeight: 1800,
      blockWidth: 200,
      blockHeight: 160,
      roadWidth: 60,
      sidewalkWidth: 15
    };

    // Create the city
    this.createBackground();
    this.createCityGrid();
    this.createBuildings();
    this.createEmptyLots();
    this.createPlayer();
    this.createUI();

    // Set up camera to follow player
    this.cameras.main.setBounds(0, 0, this.cityConfig.worldWidth, this.cityConfig.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Set up input
    this.setupInput();

    console.log('City loaded - size:', this.cityConfig.worldWidth, 'x', this.cityConfig.worldHeight);
  }

  createBackground() {
    // Create large grass background
    const { worldWidth, worldHeight } = this.cityConfig;

    // Base grass color
    const grassBg = this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x7ec850);
    grassBg.setDepth(-20);

    // Add some grass variation tiles
    const tileSize = 80;
    for (let x = 0; x < worldWidth; x += tileSize) {
      for (let y = 0; y < worldHeight; y += tileSize) {
        if (Math.random() > 0.7) {
          const variation = Phaser.Math.Between(-15, 15);
          const shade = Phaser.Display.Color.ValueToColor('#7ec850').lighten(variation).color;
          const tile = this.add.rectangle(x + tileSize / 2, y + tileSize / 2, tileSize - 2, tileSize - 2, shade, 0.5);
          tile.setDepth(-19);
        }
      }
    }
  }

  createCityGrid() {
    const { worldWidth, worldHeight, blockWidth, blockHeight, roadWidth, sidewalkWidth } = this.cityConfig;

    // Calculate grid
    const cols = Math.floor(worldWidth / (blockWidth + roadWidth));
    const rows = Math.floor(worldHeight / (blockHeight + roadWidth));

    // Create horizontal roads
    for (let row = 0; row <= rows; row++) {
      const y = row * (blockHeight + roadWidth) + roadWidth / 2;

      // Main road
      this.add.rectangle(worldWidth / 2, y, worldWidth, roadWidth, 0x444444).setDepth(-10);

      // Road markings
      for (let x = 0; x < worldWidth; x += 40) {
        this.add.rectangle(x, y, 20, 4, 0xFFFF00).setDepth(-9);
      }

      // Sidewalks
      this.add.rectangle(worldWidth / 2, y - roadWidth / 2 - sidewalkWidth / 2, worldWidth, sidewalkWidth, 0xCCCCCC).setDepth(-8);
      this.add.rectangle(worldWidth / 2, y + roadWidth / 2 + sidewalkWidth / 2, worldWidth, sidewalkWidth, 0xCCCCCC).setDepth(-8);
    }

    // Create vertical roads
    for (let col = 0; col <= cols; col++) {
      const x = col * (blockWidth + roadWidth) + roadWidth / 2;

      // Main road
      this.add.rectangle(x, worldHeight / 2, roadWidth, worldHeight, 0x444444).setDepth(-10);

      // Road markings
      for (let y = 0; y < worldHeight; y += 40) {
        this.add.rectangle(x, y, 4, 20, 0xFFFF00).setDepth(-9);
      }

      // Sidewalks
      this.add.rectangle(x - roadWidth / 2 - sidewalkWidth / 2, worldHeight / 2, sidewalkWidth, worldHeight, 0xCCCCCC).setDepth(-8);
      this.add.rectangle(x + roadWidth / 2 + sidewalkWidth / 2, worldHeight / 2, sidewalkWidth, worldHeight, 0xCCCCCC).setDepth(-8);
    }

    // Create crosswalks at intersections
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const x = col * (blockWidth + roadWidth) + roadWidth / 2;
        const y = row * (blockHeight + roadWidth) + roadWidth / 2;
        this.createCrosswalk(x, y);
      }
    }

    // Store grid info for building placement
    this.gridInfo = { cols, rows };
  }

  createCrosswalk(centerX, centerY) {
    const { roadWidth } = this.cityConfig;
    const stripeWidth = 8;
    const stripeGap = 6;
    const stripeLength = roadWidth - 10;

    // Horizontal crosswalks (above and below intersection)
    [-1, 1].forEach(dir => {
      const y = centerY + dir * (roadWidth / 2 + 20);
      for (let i = -3; i <= 3; i++) {
        this.add.rectangle(centerX + i * (stripeWidth + stripeGap), y, stripeWidth, stripeLength * 0.6, 0xFFFFFF).setDepth(-7);
      }
    });

    // Vertical crosswalks (left and right of intersection)
    [-1, 1].forEach(dir => {
      const x = centerX + dir * (roadWidth / 2 + 20);
      for (let i = -3; i <= 3; i++) {
        this.add.rectangle(x, centerY + i * (stripeWidth + stripeGap), stripeLength * 0.6, stripeWidth, 0xFFFFFF).setDepth(-7);
      }
    });
  }

  createBuildings() {
    this.buildings = [];
    const { blockWidth, blockHeight, roadWidth, sidewalkWidth } = this.cityConfig;

    // Extended building list - more variety!
    const cityBuildings = [
      // Original buildings
      ...DEFAULT_BUILDINGS,
      // More buildings spread across the city
      { id: 'bank', name: 'City Bank', type: 'service', gridPosition: { col: 2, row: 0 }, texture: 'building-hospital', jobs: ['cashier'], npc: { name: 'Mr. Money', texture: 'npc-pete' } },
      { id: 'cafe', name: 'Coffee Shop', type: 'food', gridPosition: { col: 0, row: 2 }, texture: 'building-pizza', jobs: ['waiter'], npc: { name: 'Barista Bob', texture: 'npc-pete' } },
      { id: 'school', name: 'School', type: 'service', gridPosition: { col: 3, row: 1 }, texture: 'building-hospital', jobs: ['teacher-assistant'], npc: { name: 'Principal Pat', texture: 'npc-doctor' } },
      { id: 'fire-station', name: 'Fire Station', type: 'service', gridPosition: { col: 1, row: 3 }, texture: 'building-vet', jobs: ['firefighter'], npc: { name: 'Chief Blaze', texture: 'npc-vet' } },
      { id: 'grocery', name: 'Grocery Store', type: 'shop', gridPosition: { col: 3, row: 3 }, texture: 'building-pizza', jobs: ['cashier', 'stocker'], npc: { name: 'Store Manager', texture: 'npc-pete' } },
      { id: 'gym', name: 'Fitness Center', type: 'service', gridPosition: { col: 4, row: 0 }, texture: 'building-vet', jobs: ['trainer'], npc: { name: 'Coach Kim', texture: 'npc-doctor' } },
      { id: 'library', name: 'Public Library', type: 'service', gridPosition: { col: 4, row: 2 }, texture: 'building-hospital', jobs: ['librarian'], npc: { name: 'Ms. Books', texture: 'npc-doctor' } },
      { id: 'bakery', name: 'Bakery', type: 'food', gridPosition: { col: 2, row: 3 }, texture: 'building-pizza', jobs: ['baker'], npc: { name: 'Baker Betty', texture: 'npc-pete' } },
    ];

    cityBuildings.forEach(buildingData => {
      const { col, row } = buildingData.gridPosition;

      // Calculate position in the city grid
      const x = col * (blockWidth + roadWidth) + roadWidth + blockWidth / 2;
      const y = row * (blockHeight + roadWidth) + roadWidth + blockHeight - 20;

      const building = new Building(this, x, y, buildingData);
      building.setDepth(Math.floor(y / 100));

      building.on('building-selected', (data) => {
        this.onBuildingSelected(data);
      });

      this.buildings.push(building);
    });
  }

  createEmptyLots() {
    this.emptyLots = [];
    const { blockWidth, blockHeight, roadWidth } = this.cityConfig;

    // More empty lots spread across the city
    const cityLots = [
      ...EMPTY_LOTS,
      { id: 'lot-5', gridPosition: { col: 3, row: 0 } },
      { id: 'lot-6', gridPosition: { col: 4, row: 1 } },
      { id: 'lot-7', gridPosition: { col: 0, row: 3 } },
      { id: 'lot-8', gridPosition: { col: 3, row: 2 } },
      { id: 'lot-9', gridPosition: { col: 1, row: 1 } },
      { id: 'lot-10', gridPosition: { col: 4, row: 3 } },
    ];

    const customBuildings = StorageManager.getCustomBuildings();

    cityLots.forEach(lotData => {
      const { col, row } = lotData.gridPosition;

      const x = col * (blockWidth + roadWidth) + roadWidth + blockWidth / 2;
      const y = row * (blockHeight + roadWidth) + roadWidth + blockHeight - 20;

      const lot = new EmptyLot(this, x, y, lotData);
      lot.setDepth(Math.floor(y / 100));

      const existingBuilding = customBuildings.find(b => b.lotId === lotData.id);
      if (existingBuilding) {
        lot.setBuilding(existingBuilding);
      }

      lot.on('lot-selected', (data) => {
        this.onLotSelected(data);
      });

      this.emptyLots.push(lot);
    });
  }

  createPlayer() {
    const { blockWidth, blockHeight, roadWidth } = this.cityConfig;

    // Start player near center of the city
    const startX = 2 * (blockWidth + roadWidth) + roadWidth / 2;
    const startY = 2 * (blockHeight + roadWidth) + roadWidth / 2;

    this.player = new PlayerCharacter(this, startX, startY, this.avatarConfig);
    this.player.setDepth(1000);
  }

  createUI() {
    // UI container that stays fixed to camera
    this.uiContainer = this.add.container(0, 0);
    this.uiContainer.setScrollFactor(0);
    this.uiContainer.setDepth(2000);

    // Header background
    const header = this.add.rectangle(GAME_WIDTH / 2, 35, GAME_WIDTH, 70, 0x000000, 0.7);
    this.uiContainer.add(header);

    // City title
    const title = this.add.text(20, 15, 'Hanyverse City', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.uiContainer.add(title);

    // Player name
    if (this.avatarConfig?.name) {
      const nameText = this.add.text(20, 42, this.avatarConfig.name, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaaaa'
      });
      this.uiContainer.add(nameText);
    }

    // Coin display
    this.coinIcon = this.add.image(GAME_WIDTH - 90, 30, 'coin-icon');
    this.coinIcon.setScale(1.3);
    this.uiContainer.add(this.coinIcon);

    this.coinText = this.add.text(GAME_WIDTH - 60, 30, `${this.playerState.coins}`, {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    this.uiContainer.add(this.coinText);

    // Current job indicator (if player has a job)
    const currentJob = StorageManager.getCurrentJob();
    if (currentJob) {
      const jobText = this.add.text(GAME_WIDTH / 2, 35, `Job: Working`, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#4CAF50',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5);
      this.uiContainer.add(jobText);
    }

    // Mini-map background
    this.createMiniMap();

    // Instructions
    const instructions = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 25, 'Tap anywhere to walk. Tap buildings to enter.', {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: '#00000077',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    this.uiContainer.add(instructions);
  }

  createMiniMap() {
    const mapWidth = 120;
    const mapHeight = 90;
    const mapX = GAME_WIDTH - mapWidth - 10;
    const mapY = GAME_HEIGHT - mapHeight - 45;

    // Mini-map background
    const mapBg = this.add.rectangle(mapX + mapWidth / 2, mapY + mapHeight / 2, mapWidth, mapHeight, 0x333333, 0.8);
    mapBg.setStrokeStyle(2, 0xFFFFFF);
    this.uiContainer.add(mapBg);

    // Scale factors
    const scaleX = mapWidth / this.cityConfig.worldWidth;
    const scaleY = mapHeight / this.cityConfig.worldHeight;

    // Draw buildings on mini-map
    this.buildings.forEach(building => {
      const bx = mapX + building.x * scaleX;
      const by = mapY + building.y * scaleY;
      const dot = this.add.rectangle(bx, by, 4, 4, 0x4CAF50);
      this.uiContainer.add(dot);
    });

    // Draw empty lots on mini-map
    this.emptyLots.forEach(lot => {
      const lx = mapX + lot.x * scaleX;
      const ly = mapY + lot.y * scaleY;
      const dot = this.add.rectangle(lx, ly, 3, 3, 0xFFFF00);
      this.uiContainer.add(dot);
    });

    // Player dot (will update in update loop)
    this.playerDot = this.add.circle(mapX, mapY, 4, 0xFF0000);
    this.uiContainer.add(this.playerDot);

    // Store map config for updates
    this.miniMapConfig = { mapX, mapY, mapWidth, mapHeight, scaleX, scaleY };
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      // Get world position from screen position
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // Ignore if tapping on UI area
      if (pointer.y < 70 || pointer.y > GAME_HEIGHT - 50) return;

      // Check if tapping on a building or lot
      let tappedOnInteractive = false;

      this.buildings.forEach(building => {
        const bounds = building.getBounds();
        if (bounds.contains(worldPoint.x, worldPoint.y)) {
          tappedOnInteractive = true;
        }
      });

      this.emptyLots.forEach(lot => {
        const bounds = lot.getBounds();
        if (bounds.contains(worldPoint.x, worldPoint.y)) {
          tappedOnInteractive = true;
        }
      });

      if (!tappedOnInteractive) {
        // Move player to world position
        this.player.moveTo(worldPoint.x, worldPoint.y);
        this.showTapIndicator(worldPoint.x, worldPoint.y);
      }
    });
  }

  showTapIndicator(x, y) {
    const indicator = this.add.circle(x, y, 15, 0xFFFFFF, 0.4);
    indicator.setDepth(50);

    this.tweens.add({
      targets: indicator,
      scale: 2.5,
      alpha: 0,
      duration: 400,
      onComplete: () => indicator.destroy()
    });
  }

  onBuildingSelected(buildingData) {
    console.log('Building selected:', buildingData.name);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BuildingInteriorScene', {
        building: buildingData,
        avatar: this.avatarConfig,
        playerState: this.playerState
      });
    });
  }

  onLotSelected(lotData) {
    console.log('Lot selected:', lotData.id);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BuildingEditorScene', {
        lot: lotData,
        avatar: this.avatarConfig,
        playerState: this.playerState
      });
    });
  }

  updateCoins(newAmount) {
    this.playerState.coins = newAmount;
    this.coinText.setText(`${newAmount}`);

    this.tweens.add({
      targets: [this.coinIcon, this.coinText],
      scale: { from: 1.3, to: 1.5 },
      duration: 100,
      yoyo: true
    });
  }

  update() {
    // Update player depth based on Y position
    if (this.player) {
      this.player.setDepth(Math.floor(this.player.y) + 500);
    }

    // Update mini-map player position
    if (this.playerDot && this.miniMapConfig) {
      const { mapX, mapY, scaleX, scaleY } = this.miniMapConfig;
      this.playerDot.x = mapX + this.player.x * scaleX;
      this.playerDot.y = mapY + this.player.y * scaleY;
    }
  }
}
