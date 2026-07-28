/**
 * The entire buildable catalogue, as one declarative table.
 *
 * Everything you can add to the resort — rooms, amenities, decor, staff,
 * land and personal perks — is a `BuildDef` with a drain-to-buy pad somewhere
 * in the world. `requires` gates what's visible, which keeps the number of
 * glowing pads on screen at any moment down to about five.
 *
 * There is no shop menu and no text to read: you walk onto a pad, coins pour
 * out of your bank into it, and the thing builds itself.
 */

export type BuildKind = "room" | "amenity" | "decor" | "staff" | "plot" | "perk";
export type StaffRole = "maid" | "porter" | "clerk" | "lifeguard" | "waiter";

export interface BuildDef {
  id: string;
  kind: BuildKind;
  name: string;
  /** One short kid-readable line, shown on the pad sign. */
  blurb: string;
  emoji: string;
  cost: number;
  /** Build ids that must exist before this pad appears at all. */
  requires: string[];
  /** Spatial lot this occupies (rooms + amenities). */
  lot?: string;
  /** Explicit pad position for things that don't sit on a lot. */
  pad?: { x: number; z: number };
  /** Door plate number, for rooms. */
  roomNo?: number;
  /** Permanent bump to the star rating. */
  stars?: number;
  /** Raises how fast new guests turn up. */
  draw?: number;
  /** Multiplies what every guest pays. */
  rateMul?: number;
  /** Override the pad pictogram, which otherwise comes from `kind`. */
  glyph?: "icecream";
  role?: StaffRole;
  /** Plot tier this unlocks (index into PLOT_TIERS). */
  tier?: number;
  /** Multiplies the cash pickup radius. */
  magnet?: number;
  /** Multiplies how fast the manager does jobs. */
  workMul?: number;
  /** Multiplies the manager's walking speed. */
  speedMul?: number;
}

export const BUILDS: readonly BuildDef[] = [
  /* ------------------------------------------------------------- rooms --- */
  {
    id: "room2",
    kind: "room",
    name: "Room 2",
    blurb: "One more bed!",
    emoji: "🛏️",
    cost: 18,
    requires: [],
    lot: "s1",
    roomNo: 2,
  },
  {
    id: "room3",
    kind: "room",
    name: "Room 3",
    blurb: "More beds, more guests",
    emoji: "🛏️",
    cost: 60,
    requires: ["room2"],
    lot: "n2",
    roomNo: 3,
  },
  {
    id: "room4",
    kind: "room",
    name: "Room 4",
    blurb: "The line gets shorter",
    emoji: "🛏️",
    cost: 150,
    requires: ["room3"],
    lot: "s2",
    roomNo: 4,
  },
  {
    id: "room5",
    kind: "room",
    name: "Room 5",
    blurb: "A proper little hotel",
    emoji: "🛏️",
    cost: 340,
    requires: ["plot2"],
    lot: "n3",
    roomNo: 5,
  },
  {
    id: "room6",
    kind: "room",
    name: "Room 6",
    blurb: "Six happy guests at once",
    emoji: "🛏️",
    cost: 620,
    requires: ["room5"],
    lot: "n4",
    roomNo: 6,
  },
  {
    id: "room7",
    kind: "room",
    name: "Room 7",
    blurb: "Nearly a resort now",
    emoji: "🛏️",
    cost: 1100,
    requires: ["plot3"],
    lot: "n5",
    roomNo: 7,
  },
  {
    id: "room8",
    kind: "room",
    name: "Room 8",
    blurb: "The whole north wing",
    emoji: "🛏️",
    cost: 1900,
    requires: ["room7"],
    lot: "n6",
    roomNo: 8,
  },

  /* ---------------------------------------------------------- amenities --- */
  {
    id: "bathrooms",
    kind: "amenity",
    name: "Bath House",
    blurb: "Everyone freshens up",
    emoji: "🚿",
    cost: 240,
    requires: ["plot2"],
    lot: "s3",
    stars: 0.3,
    draw: 1,
  },
  {
    id: "pool",
    kind: "amenity",
    name: "Swimming Pool",
    blurb: "Splash! Watch for floaties",
    emoji: "🏊",
    cost: 700,
    requires: ["plot2", "room5"],
    lot: "s4",
    stars: 0.5,
    draw: 3,
  },
  {
    id: "slide",
    kind: "amenity",
    name: "Water Slide",
    blurb: "Wheeeee!",
    emoji: "🛝",
    cost: 1600,
    requires: ["pool"],
    pad: { x: 15, z: -4.0 },
    stars: 0.4,
    draw: 3,
  },
  {
    id: "restaurant",
    kind: "amenity",
    name: "Fancy Restaurant",
    blurb: "Guests pay a lot more",
    emoji: "🍽️",
    cost: 2400,
    requires: ["plot3"],
    lot: "s5",
    stars: 0.4,
    draw: 3,
    rateMul: 1.25,
  },
  {
    id: "gym",
    kind: "amenity",
    name: "Hotel Gym",
    blurb: "Get those steps in",
    emoji: "🏋️",
    cost: 3200,
    requires: ["plot4"],
    lot: "n7",
    stars: 0.3,
    draw: 2,
  },
  {
    id: "spa",
    kind: "amenity",
    name: "Bubbly Spa",
    blurb: "The fanciest thing you own",
    emoji: "🛁",
    cost: 5000,
    requires: ["plot4"],
    lot: "s6",
    stars: 0.5,
    draw: 3,
  },

  /* -------------------------------------------------------------- staff --- */
  {
    id: "maid",
    kind: "staff",
    name: "Housekeeper",
    blurb: "Cleans rooms for you",
    emoji: "🧹",
    cost: 110,
    requires: ["room2"],
    pad: { x: -12, z: -6.0 },
    role: "maid",
  },
  {
    id: "porter",
    kind: "staff",
    name: "Porter",
    blurb: "Picks up cash for you",
    emoji: "🧳",
    cost: 320,
    requires: ["room3"],
    pad: { x: 4.5, z: 4.0 },
    role: "porter",
  },
  {
    id: "clerk",
    kind: "staff",
    name: "Receptionist",
    blurb: "Checks guests in for you",
    emoji: "🛎️",
    cost: 700,
    requires: ["room4"],
    pad: { x: -7, z: -6.0 },
    role: "clerk",
  },
  {
    id: "maid2",
    kind: "staff",
    name: "Second Housekeeper",
    blurb: "Twice the scrubbing",
    emoji: "🧹",
    cost: 900,
    requires: ["maid", "plot3"],
    pad: { x: 34, z: 4.0 },
    role: "maid",
  },
  {
    id: "lifeguard",
    kind: "staff",
    name: "Lifeguard",
    blurb: "Fishes out the floaties",
    emoji: "🛟",
    cost: 1500,
    requires: ["pool"],
    pad: { x: 20.5, z: -4.0 },
    role: "lifeguard",
  },
  {
    id: "waiter",
    kind: "staff",
    name: "Waiter",
    blurb: "Serves dinner for you",
    emoji: "🍷",
    cost: 2200,
    requires: ["restaurant"],
    pad: { x: 32, z: -4.0 },
    role: "waiter",
  },

  /* -------------------------------------------------------------- decor --- */
  {
    // id kept as "planters" so existing saves don't lose their first purchase
    id: "planters",
    kind: "decor",
    name: "Ice Cream Cart",
    blurb: "Guests buy one on the way out",
    emoji: "🍦",
    glyph: "icecream",
    cost: 45,
    requires: [],
    pad: { x: -1, z: -4.0 },
    stars: 0.2,
    draw: 0.8,
  },
  {
    id: "fountain",
    kind: "decor",
    name: "Fountain",
    blurb: "Very grand indeed",
    emoji: "⛲",
    cost: 260,
    requires: ["room3"],
    pad: { x: 10, z: 4.0 },
    stars: 0.3,
    draw: 1,
  },
  {
    id: "palms",
    kind: "decor",
    name: "Palm Avenue",
    blurb: "Instant holiday feeling",
    emoji: "🌴",
    cost: 500,
    requires: ["plot2"],
    pad: { x: 22, z: 4.0 },
    stars: 0.25,
    draw: 1,
  },
  {
    id: "carpet",
    kind: "decor",
    name: "Red Carpet",
    blurb: "Guests tip more",
    emoji: "🎬",
    cost: 1000,
    requires: ["plot3"],
    pad: { x: 28, z: 4.0 },
    stars: 0.3,
    rateMul: 1.15,
  },
  {
    id: "statue",
    kind: "decor",
    name: "Golden Statue",
    blurb: "A statue. Of you.",
    emoji: "🗿",
    cost: 1900,
    requires: ["plot3"],
    pad: { x: 40, z: 4.0 },
    stars: 0.4,
    draw: 1.5,
  },
  {
    id: "fireworks",
    kind: "decor",
    name: "Nightly Fireworks",
    blurb: "The whole island can see it",
    emoji: "🎆",
    cost: 4200,
    requires: ["plot4"],
    pad: { x: 45, z: 4.0 },
    stars: 0.6,
    draw: 2,
  },

  /* --------------------------------------------------------------- land --- */
  {
    id: "plot2",
    kind: "plot",
    name: "Buy More Land",
    blurb: "Room to grow eastward",
    emoji: "🚧",
    cost: 200,
    requires: ["room4"],
    pad: { x: 13, z: 0.0 },
    tier: 1,
  },
  {
    id: "plot3",
    kind: "plot",
    name: "Buy More Land",
    blurb: "Even more space!",
    emoji: "🚧",
    cost: 1200,
    requires: ["room6"],
    pad: { x: 26, z: 0.0 },
    tier: 2,
  },
  {
    id: "plot4",
    kind: "plot",
    name: "Buy the Headland",
    blurb: "The last piece of the island",
    emoji: "🚧",
    cost: 3800,
    requires: ["room8"],
    pad: { x: 37, z: 0.0 },
    tier: 3,
  },

  /* -------------------------------------------------------------- perks --- */
  {
    id: "bag1",
    kind: "perk",
    name: "Lucky Magnet",
    blurb: "Cash jumps to you from further away",
    emoji: "🧲",
    cost: 130,
    requires: ["room3"],
    pad: { x: 10, z: -4.0 },
    magnet: 1,
  },
  {
    id: "boots",
    kind: "perk",
    name: "Speedy Shoes",
    blurb: "Run faster everywhere",
    emoji: "👟",
    cost: 400,
    requires: ["room4"],
    pad: { x: 5, z: -4.0 },
    speedMul: 1.22,
  },
  {
    id: "bag2",
    kind: "perk",
    name: "Super Mop",
    blurb: "Clean and tidy twice as fast",
    emoji: "🧽",
    cost: 850,
    requires: ["bag1", "plot2"],
    pad: { x: 16, z: 4.0 },
    workMul: 2,
  },
  {
    id: "rate1",
    kind: "perk",
    name: "Five-Star Service",
    blurb: "Every guest pays more",
    emoji: "⭐",
    cost: 1400,
    requires: ["plot3"],
    pad: { x: 26, z: -4.0 },
    rateMul: 1.3,
  },
];

const BY_ID = new Map(BUILDS.map((b) => [b.id, b]));

export function buildById(id: string): BuildDef {
  const b = BY_ID.get(id);
  if (!b) throw new Error(`unknown build ${id}`);
  return b;
}

/** Total number of things there are to build — used for the progress readout. */
export const TOTAL_BUILDS = BUILDS.length;
