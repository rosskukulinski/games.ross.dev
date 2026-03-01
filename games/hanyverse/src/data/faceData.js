export const FACES = [
  { key: 'happy', name: 'Happy', texture: 'face-happy' },
  { key: 'neutral', name: 'Neutral', texture: 'face-neutral' },
  { key: 'glasses', name: 'Glasses', texture: 'face-glasses' },
  { key: 'wink', name: 'Wink', texture: 'face-wink' },
  { key: 'surprised', name: 'Surprised', texture: 'face-surprised' },
  { key: 'cool', name: 'Cool', texture: 'face-cool' }
];

export function getFaceByKey(key) {
  return FACES.find(f => f.key === key) || FACES[0];
}
