import { NETWORKS, RESEARCH_BRIEF, TASK_NETWORK_KEYS, NETWORK_KEYS } from './brainScience';
import { GeminiError, generateJSON } from './gemini';
import { buildOfflinePlan } from './cognitiveEngine';
import { classifyTask, splitBrainDump } from './taskClassifier';
import { VERIFICATION_TYPES } from './verificationEngine';
import { clockLabel, createBlock, dateFromKey, parseClock } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// PLANNER
// planDay() turns a brain dump into a timed plan for one day.
// Gemini decides priority, brain network, grouping, order, timing
// and breaks, following RESEARCH_BRIEF. If no key works, the offline
// rules in cognitiveEngine.js produce a simpler plan instead, and the
// plan says so in `notice`.
// ─────────────────────────────────────────────────────────────

// Gemini's structured output schema (OpenAPI subset).
const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: 'Two short sentences on the shape of the day and the main reasoning.',
    },
    blocks: {
      type: 'ARRAY',
      description: 'Every task and break in time order. No overlaps.',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['task', 'break'] },
          title: { type: 'STRING', description: 'Short, starts with a verb for tasks. For breaks, say what to do, e.g. "Walk outside".' },
          start: { type: 'STRING', description: '24-hour HH:MM. After midnight use 24:30, 25:00 etc.' },
          minutes: { type: 'INTEGER' },
          network: { type: 'STRING', enum: NETWORK_KEYS },
          priority: { type: 'STRING', enum: ['high', 'medium', 'low', 'none'] },
          intensity: { type: 'INTEGER', description: '0 rest to 5 very demanding.' },
          verification: { type: 'STRING', enum: VERIFICATION_TYPES },
          session: { type: 'STRING', description: 'Name of the group this block belongs to.' },
          why: { type: 'STRING', description: 'Why this priority and why at this time / next to these blocks.' },
          cue: { type: 'STRING', description: 'If-then cue for tasks. Empty for breaks.' },
        },
        required: ['kind', 'title', 'start', 'minutes', 'network', 'priority', 'intensity', 'verification', 'session', 'why', 'cue'],
        propertyOrdering: ['kind', 'title', 'start', 'minutes', 'network', 'priority', 'intensity', 'verification', 'session', 'why', 'cue'],
      },
    },
    deferred: {
      type: 'ARRAY',
      description: 'Tasks that do not fit this day, lowest priority first.',
      items: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, why: { type: 'STRING' } },
        required: ['title', 'why'],
      },
    },
  },
  required: ['summary', 'blocks', 'deferred'],
  propertyOrdering: ['summary', 'blocks', 'deferred'],
};

const CHRONOTYPE_LABEL = {
  morning: 'a morning person',
  neither: 'neither a morning nor an evening person',
  evening: 'a night owl',
};

// The earliest a plan for `date` can start: now (rounded up to five
// minutes) for today, half an hour after waking for a later day.
export function planStart(date, profile, now = new Date()) {
  const isToday = date === localKey(now);
  const afterWake = profile.wake + 30;
  if (!isToday) return afterWake;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(Math.ceil(minutes / 5) * 5, isEarlyMorning(minutes, profile) ? afterWake : 0);
}

// lines: the person's tasks, one per entry. Returns a plan.
export async function planDay({ lines, date, profile, now = new Date() }) {
  const start = planStart(date, profile, now);
  try {
    const { data, model } = await generateJSON({
      system: RESEARCH_BRIEF,
      prompt: buildPrompt({ lines, date, profile, start, now }),
      schema: PLAN_SCHEMA,
    });
    const plan = normalise(data, start);
    if (plan.blocks.some((b) => b.kind === 'task')) {
      return { ...plan, date, createdAt: Date.now(), source: 'gemini', model, notice: null };
    }
    throw new GeminiError('ALL_FAILED', 'Gemini returned an empty plan.');
  } catch (error) {
    const items = lines.flatMap(splitBrainDump).map(classifyTask);
    const offline = buildOfflinePlan(items, profile, start);
    return {
      ...offline,
      date,
      createdAt: Date.now(),
      source: 'offline',
      model: null,
      notice:
        error instanceof GeminiError && error.code === 'NO_KEYS'
          ? 'No Gemini keys yet, so this was planned by simple offline rules. Add keys in settings for the full AI plan.'
          : `${error.message} Planned by simple offline rules instead.`,
    };
  }
}

function buildPrompt({ lines, date, profile, start, now }) {
  const day = dateFromKey(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const bedtime = profile.sleep > profile.wake ? profile.sleep : profile.sleep + 1440;
  return [
    `Plan ${day} for this person.`,
    '',
    'ABOUT THEM',
    `- What they do: ${profile.role?.trim() || 'not given'}`,
    `- Usually wakes at ${clockLabel(profile.wake)} and sleeps at ${clockLabel(profile.sleep)}.`,
    `- They are ${CHRONOTYPE_LABEL[profile.chronotype] ?? CHRONOTYPE_LABEL.neither}.`,
    '',
    'TIME AVAILABLE',
    `- It is now ${now.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}.`,
    `- Schedule blocks between ${clockLabel(start)} and ${clockLabel(bedtime - 30)} (half an hour before sleep).`,
    '',
    'WHAT THEY NEED TO DO (their words)',
    ...lines.map((line) => `- ${line}`),
    '',
    'Sort every task into high, medium or low priority, assign its brain network, club tasks by network into sessions, and schedule the whole day with breaks. Include the breaks as blocks.',
  ].join('\n');
}

// Turns Gemini's JSON into blocks, fixing anything out of range.
function normalise(data, start) {
  const raw = Array.isArray(data?.blocks) ? data.blocks : [];
  const blocks = raw
    .map((b) => {
      const kind = b.kind === 'break' ? 'break' : 'task';
      const fallback = classifyTask(String(b.title ?? ''));
      const network = kind === 'break'
        ? 'RECOVERY'
        : TASK_NETWORK_KEYS.includes(b.network) ? b.network : fallback.network;
      const minutes = clamp(Math.round(Number(b.minutes) || NETWORKS[network].minutes), 5, 300);
      return createBlock({
        kind,
        title: String(b.title ?? '').trim() || (kind === 'break' ? 'Break' : 'Task'),
        start: parseClock(b.start) ?? start,
        estimatedMinutes: minutes,
        network,
        priority: kind === 'task' ? (['high', 'medium', 'low'].includes(b.priority) ? b.priority : fallback.priority) : null,
        intensity: clamp(Math.round(Number(b.intensity) || NETWORKS[network].intensity), 0, 5),
        verificationType: kind === 'break' ? 'TIMER' : VERIFICATION_TYPES.includes(b.verification) ? b.verification : fallback.verificationType,
        session: String(b.session ?? '').trim(),
        why: String(b.why ?? '').trim(),
        cue: kind === 'task' ? String(b.cue ?? '').trim() : '',
      });
    })
    .sort((a, b) => a.start - b.start);

  const deferred = (Array.isArray(data?.deferred) ? data.deferred : [])
    .filter((d) => d?.title)
    .map((d) => ({ title: String(d.title), why: String(d.why ?? '') }));

  return { summary: String(data?.summary ?? '').trim(), blocks, deferred };
}

function isEarlyMorning(minutes, profile) {
  return minutes < profile.wake;
}

function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
