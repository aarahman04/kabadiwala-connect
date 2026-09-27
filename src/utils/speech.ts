import type { Language } from '../data/models';
import { SPEECH_LANG } from '../i18n/strings';

/**
 * Speaks text with the device's offline TTS voices. Falls back from Marathi to
 * Hindi voices (same Devanagari script) when no mr-IN voice is installed.
 */
export function speak(text: string, lang: Language): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const tag = SPEECH_LANG[lang];
  const voices = synth.getVoices();
  const voice =
    voices.find((v) => v.lang === tag) ??
    voices.find((v) => v.lang.startsWith(lang)) ??
    (lang === 'mr' ? voices.find((v) => v.lang.startsWith('hi')) : undefined) ??
    voices.find((v) => v.lang.endsWith('-IN'));
  utterance.lang = voice?.lang ?? tag;
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  synth.speak(utterance);
  return true;
}

/** Spell a handover code so TTS reads "K C 8 F 3 A 2 C" rather than a word. */
export function spellCode(code: string): string {
  return code.replace(/-/g, ' ').split('').join(' ').replace(/\s+/g, ' ');
}

// Chrome loads voices asynchronously; touch the list early so it's ready.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
}
