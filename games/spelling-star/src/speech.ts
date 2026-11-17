// Text-to-speech via the browser's built-in voices (works offline on iPad/Mac).
//
// Voice quality varies enormously between the voices a device exposes. Apple
// ships three tiers — compact (robotic), enhanced, and premium (near-natural,
// a free download in Settings → Accessibility → Spoken Content → Voices) —
// plus novelty voices (Bells, Zarvox...) and the old Eloquence voices
// (Grandma, Rocko...). We rank them, pick the best by default, and let a
// grown-up choose a voice and speed in the word-list screen.

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
const SETTINGS_KEY = 'spelling-star-voice';

export type Speed = 'slow' | 'normal' | 'quick';
// Rates are deliberately below 1: a spelling test is read slowly, and
// Safari's rate 1 is already brisk.
const RATES: Record<Speed, number> = { slow: 0.5, normal: 0.65, quick: 0.8 };
// Pause between "word. sentence. word." — the teacher's beat.
const GAP_MS = 650;

export interface VoiceOption {
  id: string;
  label: string;
  quality: number;
}

interface Settings {
  voiceId: string | null;
  speed: Speed;
}

let settings: Settings = { voiceId: null, speed: 'slow' };
try {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) settings = { ...settings, ...(JSON.parse(raw) as Partial<Settings>) };
} catch {
  /* defaults */
}

const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|good news|jester|organ|superstar|trinoids|whisper|zarvox|fred|junior|kathy|ralph|deranged|hysterical)\b/i;
// Eloquence voices: old-style and robotic. Kept, but ranked last.
const ELOQUENCE = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
const NICE_COMPACT = /\b(samantha|ava|allison|susan|zoe|nicky|evan|nathan|joelle|noelle|tom)\b/i;

function quality(v: SpeechSynthesisVoice): number {
  const id = `${v.voiceURI} ${v.name}`.toLowerCase();
  if (id.includes('premium')) return 4;
  if (id.includes('enhanced') || id.includes('neural') || id.includes('natural')) return 3;
  if (/google us english|microsoft (aria|jenny|guy)/i.test(v.name)) return 3;
  if (id.includes('eloquence') || ELOQUENCE.test(v.name)) return 0;
  if (NICE_COMPACT.test(v.name)) return 2;
  return 1;
}

function englishVoices(): SpeechSynthesisVoice[] {
  if (!synth) return [];
  return synth
    .getVoices()
    .filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en') && !NOVELTY.test(v.name));
}

function rank(a: SpeechSynthesisVoice, b: SpeechSynthesisVoice): number {
  const us = (v: SpeechSynthesisVoice): number => (/en[-_]us/i.test(v.lang) ? 1 : 0);
  return quality(b) - quality(a) || us(b) - us(a) || (b.localService ? 1 : 0) - (a.localService ? 1 : 0) || a.name.localeCompare(b.name);
}

function currentVoice(): SpeechSynthesisVoice | null {
  const voices = englishVoices();
  if (!voices.length) return null;
  if (settings.voiceId) {
    const chosen = voices.find((v) => v.voiceURI === settings.voiceId);
    if (chosen) return chosen;
  }
  return voices.sort(rank)[0];
}

export const speechAvailable = !!synth;

export function listVoices(): VoiceOption[] {
  const seen = new Set<string>();
  return englishVoices()
    .sort(rank)
    .filter((v) => !seen.has(v.voiceURI) && seen.add(v.voiceURI))
    .map((v) => {
      const q = quality(v);
      const tag = q >= 4 ? ' ★★ premium' : q === 3 ? ' ★ enhanced' : '';
      const region = v.lang.replace('_', '-').split('-')[1] || '';
      return { id: v.voiceURI, label: `${v.name.replace(/\s*\(.*\)$/, '')}${region ? ` (${region})` : ''}${tag}`, quality: q };
    });
}

export function getVoiceSettings(): { voiceId: string | null; speed: Speed; activeId: string | null } {
  return { ...settings, activeId: currentVoice()?.voiceURI ?? null };
}

export function setVoiceSettings(next: Partial<Settings>): void {
  settings = { ...settings, ...next };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* not persisted */
  }
}

export function onVoicesChanged(cb: () => void): () => void {
  if (!synth?.addEventListener) return () => {};
  synth.addEventListener('voiceschanged', cb);
  return () => synth.removeEventListener('voiceschanged', cb);
}

// Each call gets a token; a newer call (or stopSpeaking) cancels the chain.
let token = 0;

/** A part is plain text, or [text, rate multiplier]. */
export type Part = string | [string, number];

/** Speak each part in turn, with a short pause between them. */
export function speak(parts: Part[]): void {
  if (!synth) return;
  const my = ++token;
  synth.cancel();
  const queue = parts.map((p): [string, number] => (typeof p === 'string' ? [p, 1] : p)).filter(([t]) => t);
  const voice = currentVoice();

  const next = (): void => {
    if (my !== token) return;
    const part = queue.shift();
    if (!part) return;
    const u = new SpeechSynthesisUtterance(part[0]);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = Math.min(1, RATES[settings.speed] * part[1]);
    u.pitch = 1;
    let advanced = false;
    const go = (): void => {
      if (advanced) return;
      advanced = true;
      window.setTimeout(next, GAP_MS);
    };
    u.onend = go;
    u.onerror = go;
    synth.speak(u);
  };
  next();
}

export function stopSpeaking(): void {
  token++;
  synth?.cancel();
}
