// Kingdom Bloom — static game data: world, zones, build pads, characters, story.

export const WORLD = { w: 2400, h: 800 };

export const CHARACTERS = {
  pip: { name: 'Pip', role: 'the young ruler', emoji: '🧒', color: '#f4a261' },
  fern: { name: 'Fern', role: 'fox gardener', emoji: '🦊', color: '#e76f51' },
  bramble: { name: 'Bramble', role: 'badger builder', emoji: '🦡', color: '#8d99ae' },
  luna: { name: 'Luna', role: 'owl scholar', emoji: '🦉', color: '#8e7dbe' },
  poppy: { name: 'Poppy', role: 'bunny baker', emoji: '🐰', color: '#f28ab2' },
};

export const ZONES = [
  {
    id: 'courtyard', name: 'Castle Courtyard', x0: 0, x1: 800,
    grass: '#82ce6e', grassDark: '#6fbc5c',
    intro: [],
  },
  {
    id: 'village', name: 'Village Row', x0: 800, x1: 1600,
    grass: '#8fd379', grassDark: '#7cc167',
    intro: [
      { who: 'poppy', text: 'Welcome to Village Row! Even my oven went cold... let us wake this place up!' },
      { who: 'bramble', text: 'Quiet stalls, sleepy windmill — plenty for us to rebuild!' },
    ],
  },
  {
    id: 'keep', name: 'Sunstone Keep', x0: 1600, x1: 2400,
    grass: '#7cc98f', grassDark: '#6ab77e',
    intro: [
      { who: 'luna', text: 'The Sunstone Keep. The crack in the great stone is right at the top — I can feel it.' },
      { who: 'pip', text: 'A little more work, friends, and Bloomvale will shine again!' },
    ],
  },
];

// Pad types:
//  producer — spawns coins nearby (value, period ms)
//  booster  — multiplies coin value of producers in its zone (mult)
//  helper   — spawns a friend who auto-collects coins in their zone (who)
//  gate     — opens the next zone (opens = zone index)
//  finale   — wins the game
export const PADS = [
  // --- Zone 0: Castle Courtyard ---
  {
    id: 'well', zone: 0, x: 150, y: 310, cost: 0, type: 'producer', value: 1, period: 2600,
    emoji: '🪣', name: 'Wishing Well', prebuilt: true,
  },
  {
    id: 'fountain', zone: 0, x: 350, y: 250, cost: 30, type: 'producer', value: 1, period: 2000,
    emoji: '⛲', name: 'Old Fountain',
    line: { who: 'fern', text: 'The fountain sings again! Coins sparkle in the water — scoop them up!' },
  },
  {
    id: 'garden', zone: 0, x: 560, y: 520, cost: 60, type: 'producer', value: 2, period: 2600,
    emoji: '🌸', name: 'Royal Garden',
    line: { who: 'fern', text: 'My roses! My bluebells! The garden pays in shiny petals... I mean coins!' },
  },
  {
    id: 'lamps', zone: 0, x: 250, y: 560, cost: 80, type: 'booster', mult: 1.5,
    emoji: '🏮', name: 'Courtyard Lamps',
    line: { who: 'pip', text: 'So bright! The whole courtyard works twice as cheerfully now.' },
  },
  {
    id: 'fern', zone: 0, x: 620, y: 210, cost: 100, type: 'helper', who: 'fern',
    emoji: '🦊', name: 'Hire Fern',
    line: { who: 'fern', text: 'Reporting for duty! I will scamper around and gather coins while you build.' },
  },
  {
    id: 'gate1', zone: 0, x: 770, y: 400, cost: 250, type: 'gate', opens: 1,
    emoji: '🔓', name: 'Village Gate',
    line: { who: 'bramble', text: 'The gate is open! Village Row, here we come!' },
  },

  // --- Zone 1: Village Row ---
  {
    id: 'bakery', zone: 1, x: 960, y: 260, cost: 200, type: 'producer', value: 5, period: 3000,
    emoji: '🥐', name: 'Poppy’s Bakery',
    line: { who: 'poppy', text: 'The oven is warm! Fresh buns bring the customers — and their coins.' },
  },
  {
    id: 'market', zone: 1, x: 1260, y: 540, cost: 300, type: 'producer', value: 5, period: 2500,
    emoji: '🍎', name: 'Market Stalls',
    line: { who: 'pip', text: 'Fresh fruit! Shiny trinkets! The market is buzzing again!' },
  },
  {
    id: 'windmill', zone: 1, x: 1460, y: 230, cost: 350, type: 'booster', mult: 1.5,
    emoji: '🌾', name: 'Old Windmill',
    line: { who: 'luna', text: 'The windmill turns — flour for Poppy and a breeze for the whole village!' },
  },
  {
    id: 'poppy', zone: 1, x: 1060, y: 560, cost: 400, type: 'helper', who: 'poppy',
    emoji: '🐰', name: 'Hire Poppy',
    line: { who: 'poppy', text: 'I will hop around and collect coins while the buns bake. Teamwork!' },
  },
  {
    id: 'gate2', zone: 1, x: 1570, y: 400, cost: 800, type: 'gate', opens: 2,
    emoji: '🔓', name: 'Keep Bridge',
    line: { who: 'bramble', text: 'The bridge to Sunstone Keep is standing! I jumped on it twelve times to make sure.' },
  },

  // --- Zone 2: Sunstone Keep ---
  {
    id: 'stairs', zone: 2, x: 1760, y: 540, cost: 600, type: 'producer', value: 10, period: 3000,
    emoji: '🧱', name: 'Grand Stairs',
    line: { who: 'bramble', text: 'Grand stairs, good as new! Visitors toss a coin for luck on every step.' },
  },
  {
    id: 'observatory', zone: 2, x: 2060, y: 220, cost: 700, type: 'producer', value: 20, period: 4000,
    emoji: '🔭', name: 'Observatory',
    line: { who: 'luna', text: 'My telescope works! Stargazers pay a coin a peek — science AND profit.' },
  },
  {
    id: 'luna', zone: 2, x: 1880, y: 210, cost: 900, type: 'helper', who: 'luna',
    emoji: '🦉', name: 'Hire Luna',
    line: { who: 'luna', text: 'I shall glide about and fetch coins. Very dignified coin-fetching, of course.' },
  },
  {
    id: 'doors', zone: 2, x: 2240, y: 500, cost: 1000, type: 'producer', value: 20, period: 3500,
    emoji: '🚪', name: 'Great Doors',
    line: { who: 'bramble', text: 'Golden doors! Royal visitors are already lining up with gifts.' },
  },
  {
    id: 'sunstone', zone: 2, x: 2000, y: 360, cost: 1500, type: 'finale',
    emoji: '🌟', name: 'The Sunstone',
    line: { who: 'pip', text: 'Everyone hold hands... here goes... THE SUNSTONE IS GLOWING!' },
  },
];

export const PROLOGUE = [
  { who: 'luna', text: 'Long ago, the Sunstone kept the kingdom of Bloomvale bright and cheerful... until it cracked, and everything went quiet and gray.' },
  { who: 'pip', text: 'Not on my watch! We are going to rebuild our kingdom — starting right here in the courtyard.' },
  { who: 'fern', text: 'See the coins popping out of the old well? Just walk over them to scoop them up!' },
  { who: 'bramble', text: 'Then stand on a glowing circle and your coins will build what is missing. Off you go, little ruler!' },
];

export const FINALE = [
  { who: 'luna', text: 'The Sunstone shines! The whole kingdom is waking up — look at all that color!' },
  { who: 'pip', text: 'We did it! Bloomvale is blooming brighter than ever. Thank you, friend!' },
  { who: 'poppy', text: 'Cake for everyone! 🎂 Your kingdom keeps earning — stay and play as long as you like!' },
];

export const TOTAL_BUILDS = PADS.filter((p) => !p.prebuilt).length;
