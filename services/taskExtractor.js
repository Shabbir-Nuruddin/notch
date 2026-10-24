import { GeminiError, generateJSON } from './gemini';
import { splitSpoken } from './taskClassifier';
import { EVERY_DAY, normalizeDays } from './routines';

// ─────────────────────────────────────────────────────────────
// TASK EXTRACTOR
// People don't talk in lists. This turns what they said:
//   "so um tomorrow I need to do some things, I need to study maths
//    and call mum, oh and I go to the gym every Monday"
// into clean, separate tasks:
//   Study maths · Call mum · Go to the gym (repeats on Mondays)
//
// Gemini does the reading. If no key works, a rule-based fallback
// splits and trims the words instead, and says so.
// ─────────────────────────────────────────────────────────────

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Short task, starting with a verb, e.g. "Study maths for 1 hour".' },
          repeat: {
            type: 'STRING',
            enum: ['none', 'daily', 'weekdays', 'weekends', 'days'],
            description: 'Only if they said it repeats ("every day", "every Monday", "on weekdays").',
          },
          days: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
            description: 'When repeat is "days": weekday numbers, 0 = Sunday … 6 = Saturday.',
          },
        },
        required: ['title', 'repeat'],
      },
    },
  },
  required: ['tasks'],
};

const SYSTEM = `You turn a person's spoken words into a clean to-do list.

Rules:
- One task per item. If a sentence holds two jobs ("study and call mum"), split it.
- Remove filler and padding: "um", "uh", "so", "like", "you know", "basically", "okay", "I need to", "I have to", "I want to", "I'm going to", "I should", "tomorrow", "today", "then", "also". Don't start a title with "to".
- Drop anything vague that isn't a real task: "do some things", "get stuff done", "be productive", "sort my life out", "a few bits". If they later say the specific thing ("I need to study"), keep only the specific one ("Study").
- Keep the details that matter: subject, person, place, duration, deadline, time ("Study maths for 1 hour", "Call mum at 6pm").
- Titles are short, start with a capitalised verb, and have no trailing full stop.
- Never invent tasks or details they didn't say. If they corrected themselves ("actually not the gym"), follow the correction.
- Repeats: only when they said so. "every day"/"daily" → daily; "weekdays" → weekdays; "weekends" → weekends; "every Monday and Thursday" → days [1,4]. Otherwise "none". Leave the repeat words out of the title.
- Skip anything already on their list.`;

// transcript: what was said this time. existing: titles already on the list.
// → { tasks: [{ title, days: number[] | null }], source: 'gemini' | 'offline', notice }
export async function extractTasks(transcript, existing = []) {
  const text = transcript.trim();
  if (!text) return { tasks: [], source: 'offline', notice: null };
  try {
    const { data } = await generateJSON({
      system: SYSTEM,
      prompt: `ALREADY ON THEIR LIST:\n${existing.length ? existing.map((t) => `- ${t}`).join('\n') : '(nothing)'}\n\nWHAT THEY JUST SAID:\n"""${text}"""`,
      schema: SCHEMA,
      temperature: 0.1,
    });
    const tasks = (data?.tasks ?? [])
      .map((t) => ({ title: tidy(String(t.title ?? '')), days: repeatDays(t.repeat, t.days) }))
      .filter((t) => t.title.length > 1);
    return { tasks, source: 'gemini', notice: null };
  } catch (error) {
    return {
      tasks: offlineExtract(text),
      source: 'offline',
      notice:
        error instanceof GeminiError && error.code === 'NO_KEYS'
          ? 'Sorted by simple rules. Add a Gemini key in settings for smarter sorting.'
          : 'Couldn’t reach Gemini, so this was sorted by simple rules.',
    };
  }
}

function repeatDays(repeat, days) {
  if (repeat === 'daily') return EVERY_DAY;
  if (repeat === 'weekdays') return [1, 2, 3, 4, 5];
  if (repeat === 'weekends') return [0, 6];
  if (repeat === 'days' && Array.isArray(days)) {
    const clean = normalizeDays(days);
    return clean.length ? clean : null;
  }
  return null;
}

function tidy(title) {
  const t = title.trim().replace(/^(?:i|we)\s+(?=\w)/i, '').replace(/^to\s+/i, '').replace(/[.,;:!]+$/, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

// ── Offline fallback ─────────────────────────────────────────

// Things people say that aren't a task on their own.
const VAGUE =
  /^(?:do|get|sort|finish|handle|deal with)?\s*(?:some|a few|a couple of|loads of|lots of|a bunch of|all (?:the|my))?\s*(?:things?|stuff|bits|bits and bobs|tasks?|work|everything|something)(?:\s+done)?$|^(?:be productive|get (?:stuff|things) done|sort (?:my )?life out|you know|like|basically)$/i;
const PADDING = /\b(?:you know|like|basically|actually|literally|kind of|sort of|i guess|i think)\b,?\s*/gi;

const DAY_NAMES = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const REPEAT =
  /\s*\b(?:every\s*day|everyday|daily|each day|on weekdays|every weekday|weekdays|on weekends|every weekend|weekends|(?:every|each|on)\s+((?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?(?:\s*,\s*|\s+and\s+|\s+)?)+))\b/i;

function parseRepeat(text) {
  const m = text.match(REPEAT);
  if (!m) return { title: text, days: null };
  const phrase = m[0].toLowerCase();
  let days;
  if (/day\b|daily|everyday/.test(phrase) && !m[1]) days = EVERY_DAY;
  else if (/weekday/.test(phrase)) days = [1, 2, 3, 4, 5];
  else if (/weekend/.test(phrase)) days = [0, 6];
  else days = normalizeDays((m[1] ?? '').toLowerCase().match(/sunday|monday|tuesday|wednesday|thursday|friday|saturday/g)?.map((d) => DAY_NAMES[d]) ?? []);
  return { title: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), days: days.length ? days : null };
}

export function offlineExtract(text) {
  return splitSpoken(text.replace(PADDING, ''))
    .map((part) => parseRepeat(part))
    .map((t) => ({ ...t, title: tidy(t.title) }))
    .filter((t) => t.title.length > 1 && !VAGUE.test(t.title));
}
