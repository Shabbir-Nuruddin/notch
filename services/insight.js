import { NETWORKS, attentionWindows, switchCost } from './brainScience';
import { splitBrainDump } from './taskClassifier';
import { blockEnd, isTask } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// INSIGHT
// What the plan did for the person, in numbers they can check:
//   - brain switches in the order they said things vs Notch's order
//   - how much demanding work lands in their attention peaks
//   - minutes per brain network, breaks taken
//
// "Minutes saved" is an estimate, and the How screen says so. Each
// switch-cost point is counted as WARMUP_MINUTES of getting back up
// to speed (attention residue, Leroy 2009; switch costs, Rubinstein
// 2001). Real costs vary a lot by person and task.
// ─────────────────────────────────────────────────────────────

export const WARMUP_MINUTES = 3;

export function dayInsight(plan, profile) {
  const blocks = [...(plan?.blocks ?? [])].sort((a, b) => a.start - b.start);
  const tasks = blocks.filter(isTask);
  const breaks = blocks.filter((b) => !isTask(b));

  const notchOrder = tasks.map((t) => t.network);
  const saidOrder = orderAsSaid(plan?.input, tasks);
  const notch = sequenceCost(notchOrder);
  const said = saidOrder ? sequenceCost(saidOrder) : null;

  // Demanding = the heavy networks (intensity 4–5).
  const w = attentionWindows(profile);
  const inPeak = (m) => (m >= w.peak1[0] && m < w.peak1[1]) || (m >= w.peak2[0] && m < w.peak2[1]);
  let demanding = 0;
  let demandingInPeak = 0;
  for (const t of tasks) {
    if (t.intensity < 4) continue;
    for (let m = t.start; m < blockEnd(t); m += 5) {
      demanding += 5;
      if (inPeak(m)) demandingInPeak += 5;
    }
  }

  const byNetwork = {};
  for (const b of blocks) {
    const entry = (byNetwork[b.network] ??= { minutes: 0, titles: [] });
    entry.minutes += b.estimatedMinutes;
    if (isTask(b)) entry.titles.push(b.title);
  }

  return {
    tasks,
    breaks,
    notchOrder,
    saidOrder,
    notch,
    said,
    savedMinutes: said ? Math.max(0, (said.cost - notch.cost) * WARMUP_MINUTES) : null,
    demandingMinutes: demanding,
    peakShare: demanding ? demandingInPeak / demanding : null,
    breakMinutes: breaks.reduce((s, b) => s + b.estimatedMinutes, 0),
    byNetwork,
    sessions: countSessions(blocks),
  };
}

function sequenceCost(seq) {
  let cost = 0;
  let switches = 0;
  for (let i = 1; i < seq.length; i++) {
    const c = switchCost(seq[i - 1], seq[i]);
    cost += c;
    if (seq[i] !== seq[i - 1]) switches += 1;
  }
  return { cost, switches };
}

// The person's tasks in the order they said them, using the networks
// Notch gave each task. Lines are matched to tasks by shared words.
function orderAsSaid(input, tasks) {
  if (!Array.isArray(input) || input.length === 0 || tasks.length < 2) return null;
  const lines = input.flatMap(splitBrainDump);
  const unused = new Set(tasks.map((_, i) => i));
  const order = [];
  for (const line of lines) {
    const words = wordSet(line);
    let best = -1;
    let bestScore = 0;
    for (const i of unused) {
      const score = overlap(words, wordSet(tasks[i].title));
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    if (best >= 0) {
      unused.delete(best);
      order.push(tasks[best].network);
    }
  }
  // Tasks Notch split or renamed beyond recognition go at the end.
  for (const i of unused) order.push(tasks[i].network);
  return order;
}

function wordSet(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );
}

function overlap(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n += 1;
  return n;
}

function countSessions(blocks) {
  let n = 0;
  let last = null;
  for (const b of blocks) {
    if (!isTask(b)) {
      last = null;
      continue;
    }
    const key = b.session || b.network;
    if (key !== last) n += 1;
    last = key;
  }
  return n;
}

export function networkLabel(key) {
  return NETWORKS[key]?.label ?? key;
}
