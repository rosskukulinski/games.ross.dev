export const EXPEDITION_MESSAGES = [
  'found a treasure chest in a cave!',
  'helped a village and earned a reward!',
  'discovered rare gems in the mountains!',
  'won a friendly competition with wild dragons!',
  'found gold coins in an ancient ruin!',
  'protected travelers and received gratitude!',
  'explored a sunken ship and found loot!',
  'traded with a merchant for some coins!',
  'dug up buried treasure on a beach!',
  'rescued a lost cat and got a reward!',
];

export function getRandomMessage(): string {
  return EXPEDITION_MESSAGES[Math.floor(Math.random() * EXPEDITION_MESSAGES.length)];
}
