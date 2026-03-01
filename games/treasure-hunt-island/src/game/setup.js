import { TILE } from './constants.js';
import { createPlayer } from './player.js';
import { createNPCs } from './npcs.js';
import { createCrabs } from './crabs.js';
import { ITEM_POOLS, createItems } from './items.js';
import { generateClues } from './clues.js';

// Predefined dig spots (on sand or grass tiles)
const DIG_SPOTS = [
  { col: 3, row: 11 },
  { col: 14, row: 13 },
  { col: 5, row: 5 },
  { col: 13, row: 3 },
  { col: 7, row: 9 },
  { col: 15, row: 11 },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function newGame() {
  const treasureSpot = pickRandom(DIG_SPOTS);

  // Pick item positions (avoid placing items on treasure spot)
  const shovelPos = pickRandom(ITEM_POOLS.shovel.filter(
    p => !(p.col === treasureSpot.col && p.row === treasureSpot.row)
  ));
  const mapPos = pickRandom(ITEM_POOLS.map.filter(
    p => !(p.col === treasureSpot.col && p.row === treasureSpot.row)
  ));
  const compassPos = pickRandom(ITEM_POOLS.compass.filter(
    p => !(p.col === treasureSpot.col && p.row === treasureSpot.row)
  ));

  const clues = generateClues(
    { map: mapPos, compass: compassPos },
    treasureSpot
  );

  const npcs = createNPCs();
  // Set dialogue queues
  npcs[0].dialogueQueue = [clues.sailor]; // Old Sailor
  npcs[1].dialogueQueue = [clues.kid];     // Island Kid
  // Parrot Pete's dialogue is dynamic, set in game loop

  return {
    player: createPlayer(),
    npcs,
    crabs: createCrabs(),
    items: createItems(shovelPos, mapPos, compassPos),
    treasure: {
      col: treasureSpot.col,
      row: treasureSpot.row,
      x: treasureSpot.col * TILE + TILE / 2,
      y: treasureSpot.row * TILE + TILE / 2,
      found: false,
    },
    inventory: { shovel: false, map: false, compass: false },
    clues,
    sparkles: [],
    digAnim: null,
    startTime: performance.now(),
    message: null,
    messageUntil: 0,
  };
}
