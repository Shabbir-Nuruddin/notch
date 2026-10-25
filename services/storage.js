import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// STORAGE
// Everything lives on this device (AsyncStorage, which is
// localStorage on the web). Nothing is sent anywhere except the task
// text that goes to Gemini when a day is planned.
// ─────────────────────────────────────────────────────────────

const PROFILE = 'notch.profile';
const PLANS = 'notch.plans';
const KEYS = 'notch.keys';
const INBOX = 'notch.inbox';
const UNLOCKS = 'notch.unlocks';
const ROUTINES = 'notch.routines';
const HISTORY = 'notch.history';
const CORRECTIONS = 'notch.corrections';

export const DEFAULT_PROFILE = {
  role: '',
  wake: 7 * 60, // minutes from midnight
  sleep: 23 * 60,
  chronotype: 'neither', // 'morning' | 'neither' | 'evening'
  onboarded: false,
  acceptedTermsAt: null, // epoch ms
  // When Notch asks about the next day's tasks.
  planning: { mode: 'night', minute: 21 * 60 + 30 }, // mode: 'night' (plans tomorrow) | 'morning' (plans today)
  alerts: { atStart: true, headsUp: true },
  voiceReplies: true,
  blocking: {
    enabled: false,
    apps: [], // [{ packageName, label }]
    holdUntilDone: true, // stay blocked after a block's time until it's done
    unlocksPerDay: 2, // five-minute emergency unlocks
  },
};

// Nested settings are merged one level deep, so a profile saved by an
// older version still gets the new defaults.
function mergeProfile(saved) {
  const p = { ...DEFAULT_PROFILE, ...saved };
  for (const key of ['planning', 'alerts', 'blocking']) {
    p[key] = { ...DEFAULT_PROFILE[key], ...(saved?.[key] ?? {}) };
  }
  return p;
}

// Plans older than this many days are dropped on save.
const KEEP_DAYS = 7;

async function readJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private browsing). The app keeps working
    // in memory; it just won't remember after a reload.
  }
}

export async function loadAll() {
  const [profile, plans, keys, inbox, unlocks, routines, history, corrections] = await Promise.all([
    readJSON(PROFILE, null),
    readJSON(PLANS, {}),
    readJSON(KEYS, []),
    readJSON(INBOX, []),
    readJSON(UNLOCKS, { date: '', used: 0, pausedUntil: 0 }),
    readJSON(ROUTINES, []),
    readJSON(HISTORY, {}),
    readJSON(CORRECTIONS, {}),
  ]);
  return {
    profile: mergeProfile(profile),
    plans: plans && typeof plans === 'object' ? plans : {},
    keys: Array.isArray(keys) ? keys : [],
    inbox: Array.isArray(inbox) ? inbox : [],
    unlocks,
    routines: Array.isArray(routines) ? routines : [],
    history: history && typeof history === 'object' ? history : {},
    corrections: corrections && typeof corrections === 'object' ? corrections : {},
  };
}

// Repeating tasks (services/routines.js).
export function saveRoutines(routines) {
  return writeJSON(ROUTINES, routines);
}

// One line per planned day, kept for good (plans themselves are
// dropped after a week): { [date]: { tasks, done, minutes, doneMinutes } }.
// This is what the progress screen draws.
export function saveHistory(history) {
  return writeJSON(HISTORY, history);
}

// Tasks moved off a day, waiting for the next planning session.
export function saveInbox(inbox) {
  return writeJSON(INBOX, inbox);
}

// Task names the person has renamed: { [as heard, lower case]: their wording }.
export function saveCorrections(corrections) {
  return writeJSON(CORRECTIONS, corrections);
}

export function saveUnlocks(unlocks) {
  return writeJSON(UNLOCKS, unlocks);
}

// Everything Notch has stored, for "Export my data". Keys are left out.
export async function exportAll() {
  const { profile, plans, inbox, routines, history, corrections } = await loadAll();
  return { exportedAt: new Date().toISOString(), profile, plans, inbox, routines, history, corrections };
}

export async function clearAll() {
  try {
    await AsyncStorage.multiRemove([PROFILE, PLANS, KEYS, INBOX, UNLOCKS, ROUTINES, HISTORY, CORRECTIONS]);
  } catch {
    // Nothing stored, or storage blocked.
  }
}

export function saveProfile(profile) {
  return writeJSON(PROFILE, profile);
}

export function saveKeys(keys) {
  return writeJSON(KEYS, keys);
}

export function savePlans(plans) {
  const oldest = dateKey(-KEEP_DAYS);
  const kept = Object.fromEntries(Object.entries(plans).filter(([date]) => date >= oldest));
  return writeJSON(PLANS, kept);
}
