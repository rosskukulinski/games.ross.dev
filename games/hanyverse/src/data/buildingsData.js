// Building and lot definitions for the city

export const DEFAULT_BUILDINGS = [
  // Work buildings (have jobs)
  {
    id: 'vet',
    name: 'Vet Clinic',
    type: 'work',
    gridPosition: { col: 0, row: 0 },
    texture: 'building-vet',
    jobs: ['vet-assistant'],
    npc: { name: 'Dr. Paws', texture: 'npc-vet' }
  },
  {
    id: 'hospital',
    name: 'Hospital',
    type: 'work',
    gridPosition: { col: 2, row: 0 },
    texture: 'building-hospital',
    jobs: ['nurse'],
    npc: { name: 'Dr. Heart', texture: 'npc-doctor' }
  },
  {
    id: 'pizza',
    name: "Pete's Pizza",
    type: 'work',
    gridPosition: { col: 2, row: 2 },
    texture: 'building-pizza',
    jobs: ['pizza-maker', 'waiter', 'delivery'],
    npc: { name: 'Pete', texture: 'npc-pete' }
  },

  // Shops (can buy things)
  {
    id: 'pet-shop',
    name: 'Pet Shop',
    type: 'shop',
    shopType: 'pet-shop',
    gridPosition: { col: 1, row: 0 },
    texture: 'building-vet',
    npc: { name: 'Pet Lady', texture: 'npc-vet' }
  },
  {
    id: 'furniture-store',
    name: 'Furniture Store',
    type: 'shop',
    shopType: 'furniture-store',
    gridPosition: { col: 3, row: 0 },
    texture: 'building-hospital',
    npc: { name: 'Mr. Furnish', texture: 'npc-pete' }
  },
  {
    id: 'clothing-store',
    name: 'Fashion Boutique',
    type: 'shop',
    shopType: 'clothing-store',
    gridPosition: { col: 0, row: 1 },
    texture: 'building-pizza',
    npc: { name: 'Fashionista', texture: 'npc-doctor' }
  },
  {
    id: 'grocery',
    name: 'Grocery Store',
    type: 'shop',
    shopType: 'grocery',
    gridPosition: { col: 3, row: 2 },
    texture: 'building-pizza',
    npc: { name: 'Store Manager', texture: 'npc-pete' }
  },
  {
    id: 'toy-store',
    name: 'Toy Store',
    type: 'shop',
    shopType: 'toy-store',
    gridPosition: { col: 1, row: 3 },
    texture: 'building-vet',
    npc: { name: 'Toy Master', texture: 'npc-vet' }
  },

  // Special buildings
  {
    id: 'airport',
    name: 'Airport',
    type: 'shop',
    shopType: 'airport',
    gridPosition: { col: 4, row: 0 },
    texture: 'building-hospital',
    npc: { name: 'Pilot Pete', texture: 'npc-doctor' }
  },
  {
    id: 'gym',
    name: 'Fitness Center',
    type: 'shop',
    shopType: 'gym',
    gridPosition: { col: 4, row: 2 },
    texture: 'building-vet',
    npc: { name: 'Coach Kim', texture: 'npc-doctor' }
  },

  // More work buildings
  {
    id: 'bank',
    name: 'City Bank',
    type: 'work',
    gridPosition: { col: 2, row: 1 },
    texture: 'building-hospital',
    jobs: ['cashier'],
    npc: { name: 'Mr. Money', texture: 'npc-pete' }
  },
  {
    id: 'fire-station',
    name: 'Fire Station',
    type: 'work',
    gridPosition: { col: 0, row: 3 },
    texture: 'building-vet',
    jobs: ['firefighter'],
    npc: { name: 'Chief Blaze', texture: 'npc-vet' }
  },
  {
    id: 'school',
    name: 'School',
    type: 'work',
    gridPosition: { col: 3, row: 1 },
    texture: 'building-hospital',
    jobs: ['teacher-assistant'],
    npc: { name: 'Principal Pat', texture: 'npc-doctor' }
  },
  {
    id: 'bakery',
    name: 'Bakery',
    type: 'work',
    gridPosition: { col: 2, row: 3 },
    texture: 'building-pizza',
    jobs: ['baker'],
    npc: { name: 'Baker Betty', texture: 'npc-pete' }
  },

  // Player's house (special)
  {
    id: 'player-house',
    name: 'Your House',
    type: 'house',
    gridPosition: { col: 1, row: 1 },
    texture: 'building-vet',
    isPlayerHouse: true
  }
];

export const EMPTY_LOTS = [
  { id: 'lot-1', gridPosition: { col: 0, row: 2 } },
  { id: 'lot-2', gridPosition: { col: 1, row: 2 } },
  { id: 'lot-3', gridPosition: { col: 4, row: 1 } },
  { id: 'lot-4', gridPosition: { col: 4, row: 3 } },
  { id: 'lot-5', gridPosition: { col: 3, row: 3 } },
  { id: 'lot-6', gridPosition: { col: 0, row: 4 } },
  { id: 'lot-7', gridPosition: { col: 1, row: 4 } },
  { id: 'lot-8', gridPosition: { col: 2, row: 4 } },
  { id: 'lot-9', gridPosition: { col: 3, row: 4 } },
  { id: 'lot-10', gridPosition: { col: 4, row: 4 } },
];

// Building blocks for the editor
export const BUILDING_BLOCKS = [
  { key: 'block-cube', name: 'Cube', texture: 'block-cube', category: 'basic' },
  { key: 'block-tall', name: 'Tall Block', texture: 'block-tall', category: 'basic' },
  { key: 'block-wide', name: 'Wide Block', texture: 'block-wide', category: 'basic' },
  { key: 'block-roof-flat', name: 'Flat Roof', texture: 'block-roof-flat', category: 'roof' },
  { key: 'block-roof-pointed', name: 'Pointed Roof', texture: 'block-roof-pointed', category: 'roof' }
];

// Decorations for building editor
export const DECORATIONS = [
  { key: 'deco-tree-small', name: 'Small Tree', texture: 'deco-tree-small', category: 'nature' },
  { key: 'deco-tree-large', name: 'Large Tree', texture: 'deco-tree-large', category: 'nature' },
  { key: 'deco-flowers', name: 'Flowers', texture: 'deco-flowers', category: 'nature' },
  { key: 'deco-swing', name: 'Swing', texture: 'deco-swing', category: 'play' },
  { key: 'deco-slide', name: 'Slide', texture: 'deco-slide', category: 'play' },
  { key: 'deco-bench', name: 'Bench', texture: 'deco-bench', category: 'furniture' }
];

// Categories for the building editor
export const BUILDING_CATEGORIES = [
  { key: 'basic', name: 'Blocks', icon: 'icon-blocks' },
  { key: 'roof', name: 'Roofs', icon: 'icon-roof' },
  { key: 'nature', name: 'Nature', icon: 'icon-nature' },
  { key: 'play', name: 'Play', icon: 'icon-play' },
  { key: 'furniture', name: 'Decor', icon: 'icon-decor' }
];

// Building types players can create
export const BUILDING_TYPES = [
  { key: 'shop', name: 'Shop', icon: 'icon-shop' },
  { key: 'restaurant', name: 'Restaurant', icon: 'icon-restaurant' },
  { key: 'house', name: 'House', icon: 'icon-house' },
  { key: 'park', name: 'Park', icon: 'icon-park' }
];

// Helper functions
export function getBuildingById(id) {
  return DEFAULT_BUILDINGS.find(b => b.id === id);
}

export function getLotById(id) {
  return EMPTY_LOTS.find(l => l.id === id);
}

export function getBlocksByCategory(category) {
  return BUILDING_BLOCKS.filter(b => b.category === category);
}

export function getDecorationsByCategory(category) {
  return DECORATIONS.filter(d => d.category === category);
}

export function getWorkBuildings() {
  return DEFAULT_BUILDINGS.filter(b => b.type === 'work');
}

export function getShopBuildings() {
  return DEFAULT_BUILDINGS.filter(b => b.type === 'shop');
}
