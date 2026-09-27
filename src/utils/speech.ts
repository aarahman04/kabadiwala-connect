import type { Language } from '../data/models';
import { SPEECH_LANG } from '../i18n/strings';

export type SpeakResult = 'spoken' | 'fallback' | 'unsupported';

function findVoice(voices: SpeechSynthesisVoice[], lang: Language): SpeechSynthesisVoice | undefined {
  const tag = SPEECH_LANG[lang];
  const norm = (l: string) => l.replace('_', '-'); // some Android builds report "hi_IN"
  return (
    voices.find((v) => norm(v.lang) === tag) ??
    voices.find((v) => norm(v.lang).startsWith(lang + '-') || v.lang === lang) ??
    // Marathi shares Devanagari with Hindi; a Hindi voice reads it acceptably.
    (lang === 'mr' ? findVoice(voices, 'hi') : undefined)
  );
}

/**
 * Speaks with the device's offline TTS voices.
 *
 * Hindi/Marathi voices are not installed on every device. When the voice list
 * is loaded and has no voice for `lang`, `englishText` (if given) is spoken
 * with an English voice instead — an English voice reading Devanagari is
 * silent or gibberish. Never throws.
 */
export function speak(text: string, lang: Language, englishText?: string): SpeakResult {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'unsupported';
    const synth = window.speechSynthesis;
    // Android Chrome can swallow an utterance queued right after cancel() on an idle synth.
    if (synth.speaking || synth.pending) synth.cancel();

    const voices = synth.getVoices();
    let voice = findVoice(voices, lang);
    let say = text;
    let tag = SPEECH_LANG[lang];
    let result: SpeakResult = 'spoken';

    // Empty list = voices not loaded yet; let the engine pick by lang tag.
    if (!voice && voices.length > 0 && lang !== 'en' && englishText) {
      voice = findVoice(voices, 'en') ?? voices[0];
      say = englishText;
      tag = SPEECH_LANG.en;
      result = 'fallback';
    }

    const utterance = new SpeechSynthesisUtterance(say);
    utterance.lang = voice?.lang ?? tag;
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    synth.speak(utterance);
    return result;
  } catch {
    return 'unsupported';
  }
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
