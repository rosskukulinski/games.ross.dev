// Kingdom Bloom — static game data: merge chains, generators, characters, story.

export const COLS = 7;
export const ROWS = 8;
export const CELL_COUNT = COLS * ROWS;

// Each chain has 5 tiers. Merge two identical items to make the next tier.
export const CHAINS = {
  flora: {
    name: 'Garden',
    color: '#58b368',
    tiers: [
      { e: '🌱', n: 'Sprout' },
      { e: '🌿', n: 'Fern Frond' },
      { e: '🪻', n: 'Bluebell' },
      { e: '🌸', n: 'Blossom' },
      { e: '🌳', n: 'Wonder Tree' },
    ],
  },
  light: {
    name: 'Light',
    color: '#f4b942',
    tiers: [
      { e: '✨', n: 'Spark' },
      { e: '🕯️', n: 'Candle' },
      { e: '🏮', n: 'Lantern' },
      { e: '💡', n: 'Glow Lamp' },
      { e: '🌟', n: 'Sunbeam' },
    ],
  },
  tools: {
    name: 'Workshop',
    color: '#7d8ca3',
    tiers: [
      { e: '🪵', n: 'Timber' },
      { e: '🔨', n: 'Hammer' },
      { e: '🪛', n: 'Tool Set' },
      { e: '🧰', n: 'Toolbox' },
      { e: '⚙️', n: 'Marvel Machine' },
    ],
  },
  treats: {
    name: 'Bakery',
    color: '#e26fa5',
    tiers: [
      { e: '🫐', n: 'Berries' },
      { e: '🍯', n: 'Berry Jam' },
      { e: '🧁', n: 'Cupcake' },
      { e: '🥧', n: 'Berry Pie' },
      { e: '🎂', n: 'Festival Cake' },
    ],
  },
};

// Coins earned when selling an item, by tier (1-5).
export const SELL_VALUE = [1, 3, 8, 20, 50];

// Generators live on the board; tapping one spends 1 energy and spawns a
// low-tier item from its chain. unlockAt = number of restored spots required.
export const GENERATORS = {
  sapling: { emoji: '🪴', name: 'Magic Sapling', chain: 'flora', unlockAt: 0 },
  sunwell: { emoji: '⛲', name: 'Sun Well', chain: 'light', unlockAt: 0 },
  tinker: {
    emoji: '🛠️', name: 'Tinker Bench', chain: 'tools', unlockAt: 2,
    announce: { who: 'bramble', text: 'I wheeled my Tinker Bench into the Workshop! Tap it for timber and tools.' },
  },
  cart: {
    emoji: '🛒', name: 'Berry Cart', chain: 'treats', unlockAt: 5,
    announce: { who: 'poppy', text: 'My Berry Cart just rolled in! Tap it for berries — pies and cakes to follow. 🎂' },
  },
};

export const CHARACTERS = {
  pip: { name: 'Pip', role: 'the young ruler', emoji: '🧒', color: '#f4a261' },
  fern: { name: 'Fern', role: 'fox gardener', emoji: '🦊', color: '#e76f51' },
  bramble: { name: 'Bramble', role: 'badger builder', emoji: '🦡', color: '#8d99ae' },
  luna: { name: 'Luna', role: 'owl scholar', emoji: '🦉', color: '#8e7dbe' },
  poppy: { name: 'Poppy', role: 'bunny baker', emoji: '🐰', color: '#f28ab2' },
};

export const PROLOGUE = [
  { who: 'luna', text: 'Long ago, the Sunstone atop the castle kept the kingdom of Bloomvale bright and cheerful.' },
  { who: 'luna', text: 'But one stormy night it cracked — and all the color and sparkle drained away...' },
  { who: 'pip', text: 'Not on my watch! Friends, we are going to fix our kingdom — one little piece at a time.' },
  { who: 'fern', text: 'Tap the 🪴 and ⛲ in the Workshop to make things, then drag two matching items together to merge them into something better!' },
  { who: 'bramble', text: 'Fill our orders to earn stars ⭐ — then spend them in the Kingdom view and I will hammer everything back to beautiful!' },
];

export const FINALE = [
  { who: 'luna', text: 'The Sunstone... it is GLOWING again! The whole kingdom is waking up!' },
  { who: 'pip', text: 'We did it! Bloomvale is blooming brighter than ever. Thank you, friend!' },
  { who: 'poppy', text: 'Cake for everyone! 🎂 You can keep merging and helping — the kingdom always has room for more sparkle!' },
];

export const CHAPTERS = [
  {
    id: 'courtyard',
    name: 'Castle Courtyard',
    emoji: '🏰',
    intro: [
      { who: 'pip', text: 'Here we are — the Castle Courtyard. It used to sparkle during the Spring Festival!' },
      { who: 'bramble', text: 'Cracked fountain, wobbly gate... nothing my hammer cannot fix. Earn some stars, Pip!' },
    ],
    spots: [
      { id: 'gate', name: 'Castle Gate', cost: 1, line: { who: 'bramble', text: 'Gate is fixed! Now visitors can actually get IN to the kingdom.' } },
      { id: 'fountain', name: 'Old Fountain', cost: 2, line: { who: 'fern', text: 'Listen — the fountain is singing again! The bluebirds will be thrilled.' } },
      { id: 'garden', name: 'Royal Garden', cost: 2, line: { who: 'fern', text: 'Roses, bluebells, sunpetals! My garden is back! 🌸' } },
      { id: 'statue', name: 'Founder Statue', cost: 3, line: { who: 'luna', text: 'Queen Marigold shines again. She founded Bloomvale with a single magic seed, you know.' } },
      { id: 'lamps', name: 'Courtyard Lamps', cost: 3, line: { who: 'pip', text: 'Look at them glow! No more tripping over cobblestones after sunset.' } },
    ],
    done: [
      { who: 'pip', text: 'The courtyard is beautiful! Next stop — the village. Poppy misses her bakery!' },
    ],
  },
  {
    id: 'village',
    name: 'Village Row',
    emoji: '🏡',
    intro: [
      { who: 'poppy', text: 'Welcome to Village Row! Or... what is left of it. Even my oven went cold. 😢' },
      { who: 'bramble', text: 'Broken bridge, tired windmill, leaky roofs. Good thing we are the best fix-it crew in the land!' },
    ],
    spots: [
      { id: 'bridge', name: 'River Bridge', cost: 3, line: { who: 'bramble', text: 'The bridge holds! I jumped on it twelve times to make sure.' } },
      { id: 'bakery', name: 'Poppy’s Bakery', cost: 3, line: { who: 'poppy', text: 'My oven is warm again! First batch of honey buns goes to YOU.' } },
      { id: 'market', name: 'Market Stalls', cost: 4, line: { who: 'pip', text: 'Fresh fruit! Shiny trinkets! The market is buzzing again!' } },
      { id: 'mill', name: 'Old Windmill', cost: 4, line: { who: 'luna', text: 'The windmill turns! Flour for Poppy, breeze for everyone.' } },
      { id: 'cottages', name: 'Cottage Roofs', cost: 5, line: { who: 'fern', text: 'Snug roofs and smoking chimneys — the villagers are dancing in the street!' } },
    ],
    done: [
      { who: 'poppy', text: 'The village smells like fresh bread again! Only one place left... the Sunstone Keep.' },
    ],
  },
  {
    id: 'keep',
    name: 'Sunstone Keep',
    emoji: '🌟',
    intro: [
      { who: 'luna', text: 'The Sunstone Keep. The crack in the great stone is right at the top.' },
      { who: 'pip', text: 'I can feel it — a little more kindness and hard work, and Bloomvale will shine again!' },
    ],
    spots: [
      { id: 'stairs', name: 'Grand Stairs', cost: 4, line: { who: 'bramble', text: 'Stairs are solid! Race you to the top — loser fixes the next kingdom.' } },
      { id: 'tower', name: 'Watch Tower', cost: 4, line: { who: 'pip', text: 'Our banner flies again! You can see the whole kingdom from up here.' } },
      { id: 'doors', name: 'Great Doors', cost: 5, line: { who: 'bramble', text: 'Golden doors, good as new. They only squeak a LITTLE now.' } },
      { id: 'observatory', name: 'Observatory', cost: 5, line: { who: 'luna', text: 'My telescope works! Tonight we count every star we earned. ⭐' } },
      { id: 'sunstone', name: 'The Sunstone', cost: 6, line: { who: 'pip', text: 'Everyone hold hands... here goes... THE SUNSTONE IS GLOWING!' } },
    ],
    done: [],
  },
];

export function spotById(id) {
  for (const ch of CHAPTERS) {
    const spot = ch.spots.find((s) => s.id === id);
    if (spot) return spot;
  }
  return null;
}

export function chapterOfSpot(id) {
  return CHAPTERS.find((ch) => ch.spots.some((s) => s.id === id));
}

export const TOTAL_SPOTS = CHAPTERS.reduce((n, ch) => n + ch.spots.length, 0);
