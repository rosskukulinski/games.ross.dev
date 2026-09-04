import type { ThemeId, TrackDef } from './track.ts';

/** Everything the renderer needs to dress a track. Pure data; the server ignores it. */
export interface Theme {
  id: ThemeId;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  fog: string;
  ground: string;
  groundAlt: string;
  road: string;
  roadEdge: string;
  curbA: string;
  curbB: string;
  barrier: string;
  barrierAlt: string;
  sun: string;
  ambientUp: string;
  ambientDown: string;
  night: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  meadow: {
    id: 'meadow',
    skyTop: '#2a7de0',
    skyHorizon: '#62b8ff',
    skyBottom: '#c4e6ff',
    fog: '#a8d8f6',
    ground: '#63c34c',
    groundAlt: '#58b542',
    road: '#4c5068',
    roadEdge: '#f4f1e6',
    curbA: '#e5383f',
    curbB: '#f7f5ee',
    barrier: '#ff5d6c',
    barrierAlt: '#fff5f6',
    sun: '#fff4d6',
    ambientUp: '#bfe8ff',
    ambientDown: '#6b9c4a',
    night: false,
  },
  beach: {
    id: 'beach',
    skyTop: '#1290d6',
    skyHorizon: '#4fc6ff',
    skyBottom: '#ffdba8',
    fog: '#b9e8fb',
    ground: '#f1d894',
    groundAlt: '#e6cc86',
    road: '#5b5e73',
    roadEdge: '#fbf7ea',
    curbA: '#ff7a3d',
    curbB: '#fff9ee',
    barrier: '#28c3d8',
    barrierAlt: '#f4feff',
    sun: '#fff7e0',
    ambientUp: '#c9f1ff',
    ambientDown: '#c9a86a',
    night: false,
  },
  neon: {
    id: 'neon',
    skyTop: '#07041f',
    skyHorizon: '#2a1266',
    skyBottom: '#4a1a8a',
    fog: '#1a0c3d',
    ground: '#151a33',
    groundAlt: '#11152b',
    road: '#262a47',
    roadEdge: '#4ef5ff',
    curbA: '#ff2fd0',
    curbB: '#2d1b52',
    barrier: '#ff2fd0',
    barrierAlt: '#4ef5ff',
    sun: '#a9b8ff',
    ambientUp: '#5a3fb0',
    ambientDown: '#1a1030',
    night: true,
  },
};

export const TRACKS: TrackDef[] = [
  {
    id: 'sunny',
    name: 'Sunny Circuit',
    theme: 'meadow',
    width: 14,
    shoulder: 5,
    laps: 3,
    points: [
      [0, -76],
      [60, -78],
      [108, -52],
      [126, 0],
      [106, 52],
      [64, 72],
      [28, 50],
      [-8, 56],
      [-44, 84],
      [-96, 66],
      [-126, 8],
      [-104, -50],
      [-54, -76],
    ],
    itemRows: [0.16, 0.47, 0.78],
    boostPads: [0.31, 0.64, 0.93],
  },
  {
    id: 'shores',
    name: 'Sandy Shores',
    theme: 'beach',
    width: 14,
    shoulder: 5,
    laps: 3,
    points: [
      [0, -90],
      [70, -92],
      [125, -68],
      [148, -15],
      [130, 32],
      [104, 62],
      [96, 96],
      [104, 130],
      [90, 158],
      [60, 172],
      [28, 164],
      [6, 140],
      [-20, 112],
      [-52, 94],
      [-96, 90],
      [-138, 52],
      [-150, -5],
      [-126, -58],
      [-70, -90],
    ],
    itemRows: [0.14, 0.42, 0.7, 0.9],
    boostPads: [0.27, 0.58, 0.82],
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    theme: 'neon',
    width: 13,
    shoulder: 5,
    laps: 3,
    points: [
      [0, -80],
      [56, -82],
      [102, -58],
      [118, -2],
      [106, 26],
      [76, 38],
      [48, 12],
      [20, 4],
      [2, 28],
      [12, 64],
      [62, 70],
      [98, 82],
      [118, 112],
      [100, 144],
      [60, 148],
      [30, 126],
      [-24, 134],
      [-80, 104],
      [-112, 58],
      [-98, 4],
      [-124, -44],
      [-92, -80],
      [-46, -82],
    ],
    itemRows: [0.12, 0.4, 0.66, 0.88],
    boostPads: [0.23, 0.52, 0.79],
  },
];

export function findTrack(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
