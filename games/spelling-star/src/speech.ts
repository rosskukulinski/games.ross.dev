// Text-to-speech via the browser's built-in voices (works offline on iPad/Mac).

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
let voice: SpeechSynthesisVoice | null = null;

const PREFERRED = ['Samantha', 'Ava', 'Allison', 'Susan', 'Karen', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny'];

function pickVoice(): void {
  if (!synth) return;
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (!voices.length) return;
  for (const name of PREFERRED) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) {
      voice = v;
      return;
    }
  }
  voice = voices.find((v) => v.lang === 'en-US' && v.localService) || voices.find((v) => v.lang === 'en-US') || voices[0];
}

if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const speechAvailable = !!synth;

export function speak(parts: string[], rate = 0.82): void {
  if (!synth) return;
  synth.cancel();
  for (const text of parts) {
    if (!text) continue;
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = rate;
    u.pitch = 1.05;
    synth.speak(u);
  }
}

export function stopSpeaking(): void {
  synth?.cancel();
}
