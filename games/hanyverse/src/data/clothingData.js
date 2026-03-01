export const CLOTHING = [
  // Tops - Available to all
  { key: 'shirt-plain', name: 'Plain Shirt', texture: 'top-shirt-plain', type: 'top', gender: 'any' },
  { key: 'shirt-smiley', name: 'Smiley Shirt', texture: 'top-shirt-smiley', type: 'top', gender: 'any' },
  { key: 'shirt-rad', name: 'RAD Shirt', texture: 'top-shirt-rad', type: 'top', gender: 'any' },

  // Dresses - Girl only (covers top and bottom)
  { key: 'dress-flowers', name: 'Flower Dress', texture: 'top-dress-flowers', type: 'dress', gender: 'girl' },
  { key: 'dress-plain', name: 'Plain Dress', texture: 'top-dress-plain', type: 'dress', gender: 'girl' },

  // Bottoms - Available to all
  { key: 'pants-blue', name: 'Blue Pants', texture: 'bottom-pants-blue', type: 'bottom', gender: 'any' },
  { key: 'shorts-red', name: 'Red Shorts', texture: 'bottom-shorts-red', type: 'bottom', gender: 'any' },
  { key: 'skirt-pink', name: 'Pink Skirt', texture: 'bottom-skirt-pink', type: 'bottom', gender: 'girl' }
];

export const HAIR_STYLES = [
  { key: 'short', name: 'Short', texture: 'hair-short', gender: 'any' },
  { key: 'long', name: 'Long', texture: 'hair-long', gender: 'any' },
  { key: 'pigtails', name: 'Pigtails', texture: 'hair-pigtails', gender: 'any' },
  { key: 'spiky', name: 'Spiky', texture: 'hair-spiky', gender: 'any' },
  { key: 'curly', name: 'Curly', texture: 'hair-curly', gender: 'any' },
  { key: 'rumi-braid', name: 'Rumi Braid', texture: 'hair-rumi-braid', gender: 'any' }
];

export function getClothingByGender(gender) {
  return CLOTHING.filter(item => item.gender === 'any' || item.gender === gender);
}

export function getTopsByGender(gender) {
  return CLOTHING.filter(item =>
    (item.type === 'top' || item.type === 'dress') &&
    (item.gender === 'any' || item.gender === gender)
  );
}

export function getBottomsByGender(gender) {
  return CLOTHING.filter(item =>
    item.type === 'bottom' &&
    (item.gender === 'any' || item.gender === gender)
  );
}

export function getClothingByKey(key) {
  return CLOTHING.find(c => c.key === key);
}

export function getHairByKey(key) {
  return HAIR_STYLES.find(h => h.key === key) || HAIR_STYLES[0];
}
