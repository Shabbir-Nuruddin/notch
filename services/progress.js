import { dateKey, isTask, isVerified } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// PROGRESS
// How much of each day got done, and whether that's going up since
// the person started using Notch. Plans are kept for a week; this
// keeps one small line per day for good.
//
//   rate   = tasks done / tasks planned, per day
//   streak = days in a row (up to today) with at least one task done
//   change = average rate of the latest 7 planned days minus the
//            first 7, in percentage points. Needs 8+ days.
// ─────────────────────────────────────────────────────────────

export function dayStats(plan) {
  const tasks = (plan?.blocks ?? []).filter(isTask);
  const done = tasks.filter(isVerified);
  return {
    tasks: tasks.length,
    done: done.length,
    minutes: tasks.reduce((s, t) => s + t.estimatedMinutes, 0),
    doneMinutes: done.reduce((s, t) => s + t.estimatedMinutes, 0),
  };
}

// Writes today's numbers for every stored plan into the history.
// Returns the same object when nothing changed.
export function mergeHistory(history, plans) {
  let next = history;
  for (const [date, plan] of Object.entries(plans)) {
    const stats = dayStats(plan);
    if (!stats.tasks) continue;
    const old = history[date];
    if (old && old.tasks === stats.tasks && old.done === stats.done && old.doneMinutes === stats.doneMinutes) continue;
    if (next === history) next = { ...history };
    next[date] = stats;
  }
  return next;
}

const rate = (d) => (d.tasks ? d.done / d.tasks : 0);
const mean = (list) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : 0);

export function progressSummary(history, now = new Date()) {
  const today = dateKey(0, now);
  const dates = Object.keys(history)
    .filter((d) => d <= today)
    .sort();

  // The last 14 calendar days, empty ones included, for the chart.
  const recent = [];
  for (let i = 13; i >= 0; i--) {
    const date = dateKey(-i, now);
    const d = history[date];
    recent.push({ date, rate: d ? rate(d) : null, done: d?.done ?? 0, tasks: d?.tasks ?? 0 });
  }

  let streak = 0;
  for (let i = 0; ; i++) {
    const d = history[dateKey(-i, now)];
    if (d?.done > 0) streak++;
    else if (i > 0) break; // nothing done yet today doesn't break it
  }

  const rates = dates.map((d) => rate(history[d]));
  const enough = rates.length >= 8;
  const first = mean(rates.slice(0, 7));
  const latest = mean(rates.slice(-7));
  const totalDone = dates.reduce((s, d) => s + history[d].done, 0);
  const totalMinutes = dates.reduce((s, d) => s + history[d].doneMinutes, 0);

  return {
    recent,
    streak,
    daysTracked: dates.length,
    latestRate: rates.length ? latest : null,
    change: enough ? Math.round((latest - first) * 100) : null,
    totalDone,
    totalMinutes,
  };
}
