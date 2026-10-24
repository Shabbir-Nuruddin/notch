import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// ─────────────────────────────────────────────────────────────
// VOICE
// Listening: the platform's own speech recogniser (Google's on
// Android, Apple's on iOS, the browser's on the web), through
// expo-speech-recognition. Audio goes to that service, not to Notch.
// Speaking: the platform's text-to-speech voice.
//
// expo-speech-recognition is native code. In Expo Go, or a browser
// without the Web Speech API, `voiceAvailable()` is false and the
// planning screen falls back to typing.
// ─────────────────────────────────────────────────────────────

let Recognizer = null;
try {
  Recognizer = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  Recognizer = null;
}

export function voiceAvailable() {
  try {
    return !!Recognizer && Recognizer.isRecognitionAvailable();
  } catch {
    return false;
  }
}

// Starts listening. Calls onText(fullTranscript, isFinal) as words
// arrive, onEnd() when listening stops, onError(message) on failure.
// Returns a function that stops listening.
export async function listen({ onText, onEnd, onError }) {
  if (!voiceAvailable()) {
    onError?.('Voice input isn’t available here. Type your tasks instead.');
    return () => {};
  }
  if (Platform.OS !== 'web') {
    const permission = await Recognizer.requestPermissionsAsync();
    if (!permission.granted) {
      onError?.('Notch needs the microphone to hear you. You can allow it in your phone’s settings.');
      return () => {};
    }
  }

  // With continuous listening, each final result is one stretch of
  // speech; keep them all.
  let settled = '';
  const subs = [
    Recognizer.addListener('result', (event) => {
      const text = event.results?.[0]?.transcript ?? '';
      if (event.isFinal) {
        settled = join(settled, text);
        onText?.(settled, true);
      } else {
        onText?.(join(settled, text), false);
      }
    }),
    Recognizer.addListener('error', (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      onError?.(event.message || 'Notch couldn’t hear that. Try again, or type instead.');
    }),
    Recognizer.addListener('end', () => {
      subs.forEach((s) => s.remove());
      onEnd?.();
    }),
  ];

  Recognizer.start({
    lang: 'en-GB',
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    androidIntentOptions: {
      EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
      EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
    },
  });
  return () => {
    try {
      Recognizer.stop();
    } catch {
      // Already stopped.
    }
  };
}

function join(a, b) {
  return [a.trim(), b.trim()].filter(Boolean).join('. ');
}

export function say(text) {
  Speech.stop();
  Speech.speak(text, { language: 'en-GB', rate: 1.0, pitch: 1.0 });
}

export function hush() {
  Speech.stop();
}
