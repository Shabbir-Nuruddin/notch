// ─────────────────────────────────────────────────────────────
// TASK ENGINE
// The plan and block shapes, statuses, the "one thing at a time"
// gate and date helpers. Pure functions only: no React, no UI.
// ─────────────────────────────────────────────────────────────

export const TIERS = ['high', 'medium', 'low'];

export const TIER_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

// How many notches each priority gets in the UI.
export const TIER_NOTCHES = { high: 3, medium: 2, low: 1 };

export const STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS', // a timer or focus window is running
  COMPLETED: 'COMPLETED', // the user says it's done, Notch hasn't confirmed it
  VERIFYING: 'VERIFYING', // a verifier is checking it right now
  VERIFIED: 'VERIFIED', // confirmed (or a break that was taken or skipped)
};

let nextId = 1;

// A plan is one day:
//   { date: '2026-10-25', createdAt, source: 'gemini' | 'offline',
//     model, notice, summary, blocks: [...], deferred: [{ title, why }] }
//
// A block is a task or a break at a planned time:
export function createBlock({
  kind = 'task', // 'task' | 'break'
  title,
  start, // minutes from midnight of the plan's date (may pass 1440)
  estimatedMinutes,
  network,
  priority = null, // 'high' | 'medium' | 'low' | null for breaks
  intensity,
  verificationType = 'TIMER',
  session = '',
  why = '',
  cue = '',
}) {
  return {
    id: `${Date.now().toString(36)}-${nextId++}`,
    kind,
    title,
    start,
    estimatedMinutes,
    network,
    priority,
    intensity,
    verificationType,
    session,
    why,
    cue,
    status: STATUS.NOT_STARTED,
    startedAt: null,
    verifiedAt: null,
    verification: null,
  };
}

export function isVerified(block) {
  return block.status === STATUS.VERIFIED;
}

export function isTask(block) {
  return block.kind === 'task';
}

// ─────────────────────────────────────────────────────────────
// THE GATE
// Notch decides the order; you do one block at a time. The current
// block is the first one, in plan order, that isn't verified. Every
// later block is locked until it's done.
// ─────────────────────────────────────────────────────────────
export function currentBlock(plan) {
  return plan?.blocks.find((b) => !isVerified(b)) ?? null;
}

// Unfinished tasks, as lines Gemini can replan from.
export function remainingTaskLines(plan) {
  if (!plan) return [];
  return plan.blocks
    .filter((b) => isTask(b) && !isVerified(b))
    .map((b) => `${b.title} (${b.priority} priority, about ${b.estimatedMinutes} min)`);
}

// ─────────────────────────────────────────────────────────────
// DATES
// Plans are stored per calendar day under a 'YYYY-MM-DD' key.
// ─────────────────────────────────────────────────────────────
export function dateKey(offsetDays = 0, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayLabel(key) {
  return dateFromKey(key).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function minutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

// 455 → "07:35", 1500 → "01:00"
export function clockLabel(minutes) {
  const m = Math.round(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// "7:35", "07:35", "19:05" → minutes from midnight, or null.
export function parseClock(text) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(text ?? '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 47 || m > 59) return null;
  return h * 60 + m;
}

// Minutes from midnight of `key` → epoch ms. Minutes past 1440 land
// on the next day.
export function epochAt(key, minutes) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, Math.round(minutes)).getTime();
}

export function blockEnd(block) {
  return block.start + block.estimatedMinutes;
}

// ─────────────────────────────────────────────────────────────
// SHIFTING
// The person can't reorder the day freely, only push a block back.
// Everything still to do after it keeps its order and slides along.
// ─────────────────────────────────────────────────────────────

// Push `id` and every unfinished block from it onwards later by
// `minutes`.
export function pushLater(blocks, id, minutes) {
  const target = blocks.find((b) => b.id === id);
  if (!target) return blocks;
  return blocks.map((b) =>
    !isVerified(b) && (b.id === id || b.start > target.start) ? { ...b, start: b.start + minutes } : b
  );
}

// Swap `id` with the next unfinished task: that task moves up to
// this block's start, this block follows it, and anything that would
// now overlap slides later.
export function swapWithNext(blocks, id) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const i = sorted.findIndex((b) => b.id === id);
  const j = sorted.findIndex((b, k) => k > i && isTask(b) && !isVerified(b));
  if (i < 0 || j < 0) return blocks;
  const target = sorted[i];
  const next = sorted[j];
  const reordered = [...sorted.slice(0, i), next, ...sorted.slice(i + 1, j), target, ...sorted.slice(j + 1)];
  let clock = target.start;
  return reordered.map((b, k) => {
    if (k < i || isVerified(b)) return b;
    const start = Math.max(k === i ? target.start : b.start, clock);
    clock = start + b.estimatedMinutes;
    return start === b.start ? b : { ...b, start };
  });
}

export function hasNextTask(blocks, id) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const i = sorted.findIndex((b) => b.id === id);
  return i >= 0 && sorted.some((b, k) => k > i && isTask(b) && !isVerified(b));
}
