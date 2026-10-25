import { GeminiError, generateJSON } from './gemini';
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

The words come from speech recognition. Expect one long run with no punctuation, and some misheard words. Work out where each task starts from the meaning, and fix obvious mishearings and spelling from context: in "pack my bag I don't drink my water" the person means "Pack my bag" and "Drink water".

Example. They said: "study I need to go out get groceries I need to book a meeting with my boss I need to make sales calls what else so that I can do my work I need to pack my bag I don't drink my water"
Tasks: Study · Go out · Get groceries · Book a meeting with my boss · Make sales calls · Pack my bag · Drink water

Rules:
- One task per item. Every separate job is its own item, even with no "and" or pause between them. If a sentence holds two jobs ("study and call mum"), split it.
- Thinking out loud is not a task: "what else", "let me think", "so that I can do my work".
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

// Speech recognition gives one long run of words with no full stops:
//   "study I need to go out get groceries I need to book a meeting
//    with my boss what else so that I can do my work pack my bag"
// so tasks are found by how people start them ("I need to", "and
// then", "also") and by an action verb starting straight after another
// task ("…my bag drink water").

const BREAK = '\u0001';

// Ways people start the next task. "I don't" is usually a misheard
// "and" or "I'll" ("pack my bag I don't drink water").
const LEAD_INS = new RegExp(
  [
    String.raw`(?:and\s+)?(?:then\s+)?(?:i|we)\s+(?:also\s+|really\s+|still\s+)*(?:need|have|want|got|ought)\s+to`,
    String.raw`(?:i|we)(?:'ve|\s+have)?\s+got\s+to`,
    String.raw`(?:i|we)\s+(?:gotta|wanna|should|must|could|might)(?:\s+also)?`,
    String.raw`(?:i|we)(?:'m|\s+am|'re|\s+are)\s+(?:going\s+to|gonna)`,
    String.raw`(?:i|we)(?:'ll|\s+will)(?:\s+also)?`,
    String.raw`(?:i|we)\s+(?:said|say)`,
    String.raw`(?:and\s+)?(?:i\s+)?don'?t\s+forget\s+to`,
    String.raw`(?:and\s+)?remember\s+to`,
    String.raw`i\s+don'?t(?=\s+[a-z])`,
    String.raw`(?:need|have|got)\s+to`,
    String.raw`gotta`,
    String.raw`(?:and\s+)?(?:then|after\s+that|afterwards|also|plus|next|as\s+well\s+as|followed\s+by)`,
    String.raw`oh\s+and`,
  ]
    .map((p) => String.raw`\b(?:${p})\b`)
    .join('|'),
  'gi'
);

// Thinking out loud, not tasks.
const NOISE =
  /\b(?:what\s+else(?:\s+do\s+(?:i|we)\s+(?:need|have)\s+to\s+do)?|let\s+me\s+think|um+|uh+|erm*|hmm+|okay|ok|so\s+yeah|yeah|anyway|that'?s\s+(?:it|all)|and\s+(?:stuff|things)|tomorrow|today)\b/gi;

// "…so that I can do my work" explains a task; it isn't one.
const PURPOSE = new RegExp(String.raw`\b(?:so\s+(?:that\s+)?(?:i|we)\s+can|because|cause|cos)\b[^${BREAK}.!?;,\n]*`, 'gi');

// Verbs that start a new task even with nothing in between.
const STRONG_VERBS =
  'study|revise|learn|go|get|buy|pack|drink|eat|clean|cook|wash|pay|finish|complete|start|send|email|reply|book|make|pick|take|visit|walk|read|write|practise|practice|prepare|submit|review|fix|meet|order|schedule|organise|organize|tidy|do|phone|ring|feed|charge|collect|return|drop|print|sign|renew|apply|install|update';
// Also counted after "and": "book a meeting and call John".
const AND_VERBS = `${STRONG_VERBS}|call|text|run|work|plan|check|watch|water|play|sleep|rest|stretch|meditate|shower|exercise|train|draft|edit|post|upload|research`;
// A verb right after one of these belongs to the same task
// ("go get", "a book", "to do", "my run").
const HOLD =
  /^(?:to|a|an|the|my|your|our|his|her|their|its|this|that|some|any|and|or|for|of|in|on|at|with|by|from|will|can|could|would|should|must|might|not|don'?t|i|we|you|they|he|she|it|let'?s|please|go|just|also|then)$/i;

function splitRun(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const parts = [];
  let current = [];
  words.forEach((word, i) => {
    const bare = word.toLowerCase().replace(/[^a-z']/g, '');
    const prev = (words[i - 1] ?? '').toLowerCase().replace(/[^a-z']/g, '');
    const startsTask =
      current.length > 0 &&
      ((new RegExp(`^(?:${STRONG_VERBS})$`).test(bare) && !HOLD.test(prev)) ||
        (prev === 'and' && current.length > 1 && new RegExp(`^(?:${AND_VERBS})$`).test(bare)));
    if (startsTask) {
      if (prev === 'and') current.pop();
      parts.push(current.join(' '));
      current = [];
    }
    current.push(word);
  });
  if (current.length) parts.push(current.join(' '));
  return parts;
}

// Strips leftovers at either end: "and", "to", "so", a stray "I".
function trimEnds(part) {
  let t = part.trim();
  let before;
  do {
    before = t;
    t = t
      .replace(/^(?:and|so|then|also|but|or|to|i|we|just|please|um|uh)\b[\s,]*/i, '')
      .replace(/[\s,]*\b(?:and|so|then|also|but|or|to|i|we|um|uh|like|the|a|my)$/i, '')
      .trim();
  } while (t !== before);
  return t;
}

export function offlineExtract(text) {
  const marked = text
    .replace(PADDING, ' ')
    .replace(LEAD_INS, BREAK)
    .replace(NOISE, BREAK)
    .replace(PURPOSE, BREAK);
  const seen = new Set();
  return marked
    .split(new RegExp(`[${BREAK}\n.!?;,]+`))
    .flatMap(splitRun)
    .map((part) => parseRepeat(trimEnds(part)))
    .map((t) => ({ ...t, title: tidy(trimEnds(t.title).replace(/\b(drink|have)\s+(?:my|some|the)\s+water\b/i, '$1 water')) }))
    .filter((t) => {
      const key = t.title.toLowerCase();
      if (t.title.length < 2 || VAGUE.test(t.title) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
