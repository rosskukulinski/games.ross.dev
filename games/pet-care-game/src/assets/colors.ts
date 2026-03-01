export const ELEMENT_PALETTES = {
  fire: { primary: '#E63946', secondary: '#F4A261', accent: '#FFD700', eye: '#FF4500', bg: '#FFF3E0' },
  ice: { primary: '#457B9D', secondary: '#A8DADC', accent: '#F1FAEE', eye: '#00CED1', bg: '#E3F2FD' },
  nature: { primary: '#2D6A4F', secondary: '#95D5B2', accent: '#D8F3DC', eye: '#52B788', bg: '#E8F5E9' },
  storm: { primary: '#6A4C93', secondary: '#B8B8FF', accent: '#E0AAFF', eye: '#9D4EDD', bg: '#F3E5F5' },
} as const;

export type ElementPalette = typeof ELEMENT_PALETTES[keyof typeof ELEMENT_PALETTES];
