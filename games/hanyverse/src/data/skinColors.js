export const SKIN_COLORS = [
  { key: 'light', name: 'Light', hex: 0xFFE4C4 },
  { key: 'fair', name: 'Fair', hex: 0xFFDBAC },
  { key: 'medium', name: 'Medium', hex: 0xD4A574 },
  { key: 'olive', name: 'Olive', hex: 0xC4A484 },
  { key: 'tan', name: 'Tan', hex: 0xA67B5B },
  { key: 'brown', name: 'Brown', hex: 0x8B5A2B },
  { key: 'dark', name: 'Dark', hex: 0x5C4033 },
  { key: 'deep', name: 'Deep', hex: 0x3D2B1F }
];

export function getSkinColorByKey(key) {
  return SKIN_COLORS.find(c => c.key === key) || SKIN_COLORS[1];
}

export function getSkinColorByHex(hex) {
  return SKIN_COLORS.find(c => c.hex === hex) || SKIN_COLORS[1];
}
