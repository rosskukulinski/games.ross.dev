// Zone names for clue generation
const ZONE_NAMES = {
  beach: 'the sandy beach',
  grove: 'the palm grove',
  rocks: 'the rocky outcrop',
  village: 'the village path',
  south: 'the southern shore',
  central: 'the island center',
};

// Map column/row ranges to zone names
function getZone(col, row) {
  if (row >= 13) return 'south';
  if (row >= 10 && col <= 6) return 'beach';
  if (col <= 5 && row <= 9) return 'grove';
  if (col >= 12 && row <= 6) return 'rocks';
  if (row <= 6) return 'village';
  return 'central';
}

// Templates for NPC dialogue based on game state
const SAILOR_LINES = [
  items => `I once hid a treasure map near ${ZONE_NAMES[getZone(items.map.col, items.map.row)]}. If ye find it, the island reveals its secrets...`,
  items => `Ye look like an adventurer! I heard there's an old map somewhere around ${ZONE_NAMES[getZone(items.map.col, items.map.row)]}. Start there, says I.`,
  items => `Welcome ashore! A wise sailor always finds the map first. Try looking near ${ZONE_NAMES[getZone(items.map.col, items.map.row)]}.`,
];

const KID_LINES = [
  items => `I found a shiny compass once near ${ZONE_NAMES[getZone(items.compass.col, items.compass.row)]}! But I left it there - too scared of the crabs!`,
  items => `Hey! There's a cool compass near ${ZONE_NAMES[getZone(items.compass.col, items.compass.row)]}. Watch out for crabs though!`,
  items => `Want a hint? Check near ${ZONE_NAMES[getZone(items.compass.col, items.compass.row)]} — I saw something shiny there yesterday!`,
];

const PARROT_LINES = [
  treasure => `SQUAWK! ${treasure.hasAll ? 'The treasure is CLOSE! Dig where the sparkles are, dig dig dig!' : 'Ye need all three tools before Pete tells ye anything! Squawk!'}`,
  treasure => `${treasure.hasAll ? 'Bawk! Pete sees sparkles where X marks the spot! Dig there, dig there!' : 'Come back when ye have the shovel, map, AND compass! Squawk!'}`,
  treasure => `${treasure.hasAll ? 'TREASURE TIME! Follow the sparkles, friend! Bawk bawk!' : 'Three tools ye need: shovel to dig, map to see, compass to guide! Squawk!'}`,
];

export function generateClues(itemPositions, treasurePos) {
  const sailorLine = SAILOR_LINES[Math.floor(Math.random() * SAILOR_LINES.length)];
  const kidLine = KID_LINES[Math.floor(Math.random() * KID_LINES.length)];
  const parrotLine = PARROT_LINES[Math.floor(Math.random() * PARROT_LINES.length)];

  return {
    sailor: sailorLine(itemPositions),
    kid: kidLine(itemPositions),
    parrot: (hasAll) => parrotLine({ hasAll }),
  };
}
