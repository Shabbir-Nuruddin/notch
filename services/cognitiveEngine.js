import { NETWORKS, attentionWindows, switchCost } from './brainScience';
import { clockLabel, createBlock } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// OFFLINE SCHEDULER
// A simplified, rule-based version of what Gemini does, used when no
// key works. Same rules as RESEARCH_BRIEF, far less judgement:
//
//   1. Priority first: high before medium before low.
//   2. Within that, prefer the same brain network as the last task
//      (no switch cost) and the right time of day for the network
//      (heavy work in the attention peaks, light work in the low
//      start and the post-lunch dip).
//   3. A break after ~75 minutes of heavy work, longer after
//      executive work, and after ~90 minutes of any work; a meal
//      in the dip.
//   4. Whatever doesn't fit before bedtime is deferred, low first.
// ─────────────────────────────────────────────────────────────

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const HEAVY = 4;
const LOAD_LIMIT = 75; // minutes of heavy work before a break
const RUN_LIMIT = 90; // minutes of any work before a break

function windowAt(minute, w) {
  if (minute < w.lowEnd) return 'low';
  if (minute < w.peak1[1]) return 'peak';
  if (minute < w.dip[1]) return 'dip';
  if (minute < w.peak2[1]) return 'peak';
  return 'late';
}

function timePenalty(task, window) {
  const heavy = task.intensity >= HEAVY;
  if (task.network === 'CREATIVE') return window === 'peak' ? 1 : -1; // ideation off-peak
  if (heavy && window !== 'peak') return 4;
  if (!heavy && task.intensity <= 2 && window === 'peak') return 2; // save peaks for heavy work
  return 0;
}

function reasonFor(task, window, prev) {
  const parts = [`${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority.`];
  if (prev && prev.network === task.network) {
    parts.push('Same brain mode as the task before, so there is no switch cost.');
  } else if (task.intensity >= HEAVY && window === 'peak') {
    parts.push('Heavy work, placed in one of your attention peaks.');
  } else if (task.intensity <= 2 && (window === 'low' || window === 'dip')) {
    parts.push('Light work for a low-attention part of your day.');
  } else if (task.network === 'CREATIVE' && window !== 'peak') {
    parts.push('Ideas come more easily off-peak, when focus is looser.');
  }
  return parts.join(' ');
}

// items: [{ title, network, intensity, estimatedMinutes, verificationType, priority }]
// Returns { blocks, deferred, summary }.
export function buildOfflinePlan(items, profile, startMinute) {
  const windows = attentionWindows(profile);
  const bedtime = profile.sleep > profile.wake ? profile.sleep : profile.sleep + 1440;
  const end = bedtime - 30;

  let clock = startMinute;
  let prev = null;
  let load = 0;
  let run = 0;
  let ateMeal = false;
  const blocks = [];
  const deferred = [];
  let pool = [...items];

  function addBreak(title, minutes, why) {
    blocks.push(
      createBlock({
        kind: 'break',
        title,
        start: clock,
        estimatedMinutes: minutes,
        network: 'RECOVERY',
        intensity: 0,
        session: 'Recovery',
        why,
      })
    );
    clock += minutes;
    load = 0;
    run = 0;
  }

  while (pool.length > 0) {
    const window = windowAt(clock, windows);
    const ranked = pool
      .map((task) => ({
        task,
        score:
          PRIORITY_RANK[task.priority] * 6 +
          switchCost(prev?.network, task.network) * 1.5 +
          timePenalty(task, window) +
          task.estimatedMinutes / 120,
      }))
      .sort((a, b) => a.score - b.score);
    const task = ranked[0].task;
    pool = pool.filter((t) => t !== task);

    // Meal in the post-lunch dip, once.
    if (!ateMeal && clock >= windows.dip[0] && clock < windows.dip[1]) {
      addBreak('Meal break', 40, 'Lunch in the post-lunch dip, when attention is low anyway.');
      ateMeal = true;
    }
    // Rest after a long run of heavy work before more of it, or after
    // a long stretch of anything.
    if ((load >= LOAD_LIMIT && task.intensity >= 3) || run >= RUN_LIMIT) {
      const afterExecutive = prev?.network === 'EXECUTIVE';
      addBreak(
        afterExecutive ? 'Walk outside' : 'Screen-free break',
        afterExecutive ? 20 : 10,
        afterExecutive
          ? 'Executive work tires the prefrontal cortex. A walk outside restores directed attention.'
          : 'A short break away from screens resets focus before the next block.'
      );
    }

    if (clock + task.estimatedMinutes > end) {
      deferred.push({ title: task.title, why: `Doesn't fit before ${clockLabel(end)}.` });
      continue;
    }

    const sameSession = prev && prev.network === task.network && blocks[blocks.length - 1]?.kind === 'task';
    blocks.push(
      createBlock({
        ...task,
        kind: 'task',
        start: clock,
        session: sameSession ? blocks[blocks.length - 1].session : `${NETWORKS[task.network].label} session`,
        why: reasonFor(task, windowAt(clock, windows), prev),
        cue: prev
          ? `When "${prev.title}" is done, I'll start "${task.title}" straight away.`
          : `When I open Notch, I'll start "${task.title}".`,
      })
    );
    clock += task.estimatedMinutes;
    run += task.estimatedMinutes;
    load = task.intensity >= 3 ? load + task.estimatedMinutes : Math.max(0, load - task.estimatedMinutes * 1.5);
    prev = task;
  }

  const heavy = blocks.filter((b) => b.kind === 'task' && b.intensity >= HEAVY).length;
  return {
    blocks,
    deferred,
    summary: `Planned offline by simple rules: priority first, then ${heavy} heavy block${heavy === 1 ? '' : 's'} placed in your attention peaks, with breaks after long runs.`,
  };
}

