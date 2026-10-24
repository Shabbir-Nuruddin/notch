import { dateFromKey } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// ROUTINES
// Things the person does on a schedule: "Gym every Monday and
// Thursday", "Read every day". When a day is planned, the routines
// for that weekday are already on the list. Nothing else carries
// over from one day to the next.
//
// A routine is { id, title, days } where days are weekday numbers,
// 0 = Sunday … 6 = Saturday. All seven means every day.
// ─────────────────────────────────────────────────────────────

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_SET = [1, 2, 3, 4, 5];

let nextId = 1;

export function createRoutine(title, days = EVERY_DAY) {
  return { id: `r${Date.now().toString(36)}-${nextId++}`, title: title.trim(), days: normalizeDays(days) };
}

export function normalizeDays(days) {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
}

// The routines that fall on the date 'YYYY-MM-DD'.
export function routinesOn(routines, key) {
  const weekday = dateFromKey(key).getDay();
  return routines.filter((r) => r.days.includes(weekday));
}

export function findRoutine(routines, title) {
  const k = title.trim().toLowerCase();
  return routines.find((r) => r.title.toLowerCase() === k) ?? null;
}

// [1,3] → "Mon, Wed"; all seven → "Every day"
export function daysLabel(days) {
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && WEEKDAY_SET.every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return days.map((d) => WEEKDAYS[d]).join(', ');
}
