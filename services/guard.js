import { guardAvailable, setRules } from '../modules/notch-guard';
import { blockEnd, dateKey, epochAt, isTask, isVerified } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// APP BLOCKING RULES
// Turns the plan into time windows for the Android blocker
// (modules/notch-guard). During a window, the chosen apps send you
// back to Notch. A window opens when a task's time starts and closes
// when its time ends, or, with "hold until done", only once the task
// is marked done (at the latest at bedtime).
// ─────────────────────────────────────────────────────────────

export const EMERGENCY_UNLOCK_MINUTES = 5;

export function guardWindows({ plans, profile, now = Date.now() }) {
  const bedtime = profile.sleep > profile.wake ? profile.sleep : profile.sleep + 1440;
  const windows = [];
  for (const offset of [-1, 0, 1]) {
    const key = dateKey(offset, new Date(now));
    const plan = plans[key];
    if (!plan) continue;
    for (const b of plan.blocks) {
      if (!isTask(b) || isVerified(b)) continue;
      const start = epochAt(key, b.start);
      const end = epochAt(key, profile.blocking.holdUntilDone ? Math.max(bedtime, blockEnd(b)) : blockEnd(b));
      if (end > now) windows.push({ start, end, title: b.title });
    }
  }
  return windows.sort((a, b) => a.start - b.start);
}

export function syncGuard({ plans, profile, unlocks, now = Date.now() }) {
  if (!guardAvailable) return;
  const { blocking } = profile;
  setRules({
    enabled: !!blocking.enabled && blocking.apps.length > 0,
    blocked: blocking.apps.map((a) => a.packageName),
    windows: guardWindows({ plans, profile, now }),
    pausedUntil: unlocks?.pausedUntil ?? 0,
  });
}

export function clearGuard() {
  if (guardAvailable) setRules({ enabled: false, blocked: [], windows: [], pausedUntil: 0 });
}

// Is blocking active right now, and for which task?
export function guardState({ plans, profile, unlocks, now = Date.now() }) {
  const { blocking } = profile;
  if (!blocking.enabled || blocking.apps.length === 0) return { active: false };
  if ((unlocks?.pausedUntil ?? 0) > now) return { active: false, pausedUntil: unlocks.pausedUntil };
  const window = guardWindows({ plans, profile, now }).find((w) => now >= w.start && now < w.end);
  return window ? { active: true, title: window.title, until: window.end } : { active: false };
}
