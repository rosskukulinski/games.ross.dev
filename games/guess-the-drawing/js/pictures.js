// Picture (emoji) for every drawing.
// Used by the "Pick it" mode's answer buttons, and to show the answer as a
// picture (not just a word) in the round feedback, so pre-readers can follow.

const PICTURES = {
    house: '🏠', tree: '🌳', rainbow: '🌈', sun: '☀️', star: '⭐', heart: '❤️',
    flower: '🌸', ball: '⚽', flag: '🚩', hat: '🎩', cat: '🐱', dog: '🐶',
    fish: '🐟', bird: '🐦', rabbit: '🐰', elephant: '🐘', snake: '🐍',
    butterfly: '🦋', spider: '🕷️', whale: '🐳', car: '🚗', sailboat: '⛵',
    airplane: '✈️', bicycle: '🚲', rocket: '🚀', train: '🚂', guitar: '🎸',
    umbrella: '☂️', key: '🔑', crown: '👑', anchor: '⚓', sword: '🗡️',
    glasses: '👓', clock: '🕒', phone: '📱', pencil: '✏️', book: '📖',
    diamond: '💎', camera: '📷', candle: '🕯️', mountain: '⛰️', cloud: '☁️',
    moon: '🌙', snowflake: '❄️', cactus: '🌵', mushroom: '🍄', leaf: '🍃',
    campfire: '🔥', pizza: '🍕', icecream: '🍦', apple: '🍎', cake: '🎂',
    carrot: '🥕', snowman: '⛄', robot: '🤖', lightning: '⚡', kite: '🪁',
    arrow: '➡️', tent: '⛺', envelope: '✉️'
};

function getPicture(id) {
    return PICTURES[id] || '❓';
}
