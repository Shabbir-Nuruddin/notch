import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// ─────────────────────────────────────────────────────────────
// NOTCH GUARD (Android only)
// Real app blocking. An accessibility service (GuardService.kt)
// watches which app comes to the front; if it's a blocked app while a
// task window is open, it sends the person back to Notch's focus
// screen. Rules are saved natively, so blocking keeps working when
// Notch itself is closed.
//
// Missing on web, on iOS and in Expo Go. Everything here is then a
// harmless no-op and `guardAvailable` is false.
// ─────────────────────────────────────────────────────────────

const Native = Platform.OS === 'android' ? requireOptionalNativeModule('NotchGuard') : null;

export const guardAvailable = !!Native;

export function isServiceEnabled() {
  try {
    return Native ? Native.isServiceEnabled() : false;
  } catch {
    return false;
  }
}

export function openServiceSettings() {
  Native?.openServiceSettings();
}

// rules: { enabled, blocked: [packageName], windows: [{ start, end, title }], pausedUntil }
// start, end and pausedUntil are epoch milliseconds.
export function setRules(rules) {
  Native?.setRules(JSON.stringify(rules));
}

export function getRules() {
  try {
    return Native ? JSON.parse(Native.getRules()) : null;
  } catch {
    return null;
  }
}

// [{ packageName, label, category, icon }], sorted by name. `icon` is
// a data URI. `category` is Android's own: 'game', 'social', 'video'...
export async function getLaunchableApps() {
  if (!Native) return [];
  const apps = JSON.parse(await Native.getLaunchableApps());
  return apps
    .map((a) => ({ ...a, icon: a.icon ? `data:image/png;base64,${a.icon}` : null }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
