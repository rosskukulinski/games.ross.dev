// The word list. Two ways to change it each week:
//
//  1. In the game: tap "Grown-ups: change words" on the title screen. The new
//     list is saved on that device (localStorage) and survives reloads.
//  2. In code: edit DEFAULT_LIST below and deploy. This is what a fresh device
//     (or "Reset to built-in list") gets.
//
// Format: one word per line, optionally followed by " | " and a sentence the
// game reads aloud after the word, the way a teacher does on a spelling test.

export interface WordEntry {
  word: string;
  sentence: string;
  bonus: boolean;
}

export interface WordList {
  title: string;
  words: string;
  bonus: string;
}

export const DEFAULT_LIST: WordList = {
  title: 'Unit 3 Week 3',
  words: `preheat | Dad will preheat the oven before baking the pizza.
pretest | We took a pretest before we started the new unit.
refill | Can you refill my water bottle, please?
misspell | Check your work so you do not misspell any words.
dislike | I dislike getting my socks wet in the rain.
misplace | I always misplace my library book.
repay | I will repay you the dollar I borrowed.
reread | I love to reread my favorite chapter book.
disagree | It is okay to disagree with a friend kindly.
sighed | She sighed when it started to rain at recess.`,
  bonus: `replayed | We replayed the funny video three times.
misinform | A wrong map can misinform travelers.
reinvent | Inventors try to reinvent everyday things.
disbelief | He stared at the giant pumpkin in disbelief.`,
};

const KEY = 'spelling-star-list-v1';

export function loadList(): WordList {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WordList>;
      if (typeof parsed.words === 'string') {
        return {
          title: parsed.title || 'My Words',
          words: parsed.words,
          bonus: parsed.bonus || '',
        };
      }
    }
  } catch {
    /* fall through to default */
  }
  return { ...DEFAULT_LIST };
}

export function saveList(list: WordList | null): void {
  try {
    if (list) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked — list just won't persist */
  }
}

function parseBlock(text: string, bonus: boolean): WordEntry[] {
  const out: WordEntry[] = [];
  for (const line of text.split('\n')) {
    const [rawWord, ...rest] = line.split('|');
    const word = (rawWord || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!word) continue;
    if (out.some((e) => e.word === word)) continue;
    out.push({ word, sentence: rest.join('|').trim(), bonus });
  }
  return out;
}

export function parseList(list: WordList): { main: WordEntry[]; bonus: WordEntry[] } {
  const main = parseBlock(list.words, false);
  const bonus = parseBlock(list.bonus, true).filter((b) => !main.some((m) => m.word === b.word));
  return { main, bonus };
}

/** Stable key for per-list best scores, so a new week starts fresh. */
export function listKey(list: WordList): string {
  const { main, bonus } = parseList(list);
  const s = [...main, ...bonus].map((e) => e.word).join(',');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
