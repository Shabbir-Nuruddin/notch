import { LegalPage, contactLine } from '../../../components/Legal';
import { POLICY_EFFECTIVE } from '../../../config';

const SECTIONS = [
  [
    'The short version',
    [
      'Notch has no accounts and no servers of its own. Your tasks, plans and settings are stored on your device. Two things leave it: the task list you ask Notch to plan, which goes to Google Gemini, and your voice while you talk to Notch, which goes to your device’s speech service.',
    ],
  ],
  [
    'What is stored on your device',
    [
      'Your settings (wake and sleep times, planning time, alarm and blocking preferences, and what you do, if you enter it), your plans for the last seven days, tasks you moved to another day, and any Gemini API keys you add. On the web this is your browser’s local storage.',
      'Plans older than seven days are deleted automatically. You can export everything or delete it at any time in Settings › Your data. Uninstalling the app, or clearing the site’s data in your browser, also deletes it.',
    ],
  ],
  [
    'Planning with Google Gemini',
    [
      'When you plan a day, Notch sends Google the task text you gave, what you do (if entered), your wake and sleep times, your chronotype and the current date and time, using the API key in use. Google’s terms and privacy policy apply to that request. On Gemini’s free tier, Google may use submitted content to improve its products, so avoid including confidential information.',
      'Without a key, Notch plans on your device and nothing is sent.',
    ],
  ],
  [
    'Voice',
    [
      'When you tap the microphone, your speech is turned into text by your device’s speech recognition service (Google on Android, Apple on iPhone, or your browser’s on the web), which may process audio on its servers under its own privacy policy. Notch doesn’t record or keep audio. Spoken replies are made by your device’s text-to-speech voice.',
    ],
  ],
  [
    'App blocking (Android)',
    [
      'If you turn on app blocking, Notch uses Android’s Accessibility service to learn the package name of the app in the foreground, and only to decide whether to bring you back to Notch. It doesn’t read screen contents, text you type, messages or passwords, and it doesn’t store or send any of this. To find the apps you can block, Notch reads the list of apps installed on your device; that list stays on the device.',
      'You can stop this at any time by turning off blocking in Notch or turning off the Notch service in Android’s Accessibility settings.',
    ],
  ],
  [
    'Permissions',
    [
      'Notifications and exact alarms, to ring when tasks start and remind you to plan. Microphone and speech recognition, only while you talk to Notch. Accessibility service, only if you turn on app blocking. Notch doesn’t use location, contacts, photos, advertising identifiers or analytics.',
    ],
  ],
  [
    'Children',
    [
      'Notch isn’t directed at children under 13, and doesn’t knowingly collect information from them.',
    ],
  ],
  [
    'Changes and contact',
    [
      'If this policy changes, the new version will appear here with a new effective date. Significant changes will also be shown in the app.',
      contactLine(),
    ],
  ],
];

export default function Privacy() {
  return <LegalPage title="Privacy Policy" effective={POLICY_EFFECTIVE} sections={SECTIONS} />;
}
