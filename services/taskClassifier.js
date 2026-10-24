import { NETWORKS } from './brainScience';

// ─────────────────────────────────────────────────────────────
// OFFLINE TASK CLASSIFIER
// Used only when Gemini can't be reached. Turns
//   "Clean my desk for 15 minutes"
// into
//   { title: 'Clean my desk', network: 'ROUTINE', estimatedMinutes: 15,
//     verificationType: 'CAMERA', priority: 'medium', ... }
//
// This is keyword matching, not AI. Gemini does the real sorting
// (services/planner.js).
// ─────────────────────────────────────────────────────────────

// Checked top to bottom; the first rule whose pattern matches wins,
// so the more specific rules come first.
const RULES = [
  { pattern: /\b(stay off|no phone|off (my )?phone|screen[- ]free|instagram|tiktok|social media)\b/i, network: 'ROUTINE', verify: 'DEVICE' },
  { pattern: /\b(clean|tidy|laundry|dishes|wash|vacuum|make (my |the )?bed|declutter|put away|cook)\b/i, network: 'MOTOR', verify: 'CAMERA' },
  { pattern: /\b(gym|workout|exercise|run|jog|walk|stretch|yoga|swim|football|basketball|tennis|training|lift)\b/i, network: 'MOTOR', verify: 'TIMER' },
  { pattern: /\b(math|maths|mathematics|calculus|algebra|physics|chemistry|statistics|code|coding|program|programming|debug|problem set|budget|tax|taxes|strategy|plan)\b/i, network: 'EXECUTIVE', verify: 'TIMER' },
  { pattern: /\b(memori[sz]e|flashcards?|vocab|revise|revision|study|learn|exam|test prep|lecture)\b/i, network: 'MEMORY', verify: 'TIMER' },
  { pattern: /\b(write|essay|report|draft|journal|edit|proposal|read|chapter|book|article|paper)\b/i, network: 'LANGUAGE', verify: 'TIMER' },
  { pattern: /\b(draw|paint|design|music|guitar|piano|brainstorm|sketch|compose|idea|ideas|film|photo)\b/i, network: 'CREATIVE', verify: 'TIMER' },
  { pattern: /\b(call|text|meet|meeting|message|visit|interview|chat|mum|mom|dad|friend|family|date|teach)\b/i, network: 'SOCIAL', verify: 'MANUAL' },
  { pattern: /\b(email|emails|reply|submit|pay|book|schedule|form|admin|groceries|shop|shopping|errand|buy|post|bank)\b/i, network: 'ROUTINE', verify: 'MANUAL' },
];

const DEFAULT = { network: 'ROUTINE', verify: 'MANUAL' };

const HIGH = /\b(urgent|asap|deadline|due|exam|test|interview|submit|must|important|pay|bill|rent|appointment|doctor|dentist|flight|today)\b/i;
const LOW = /\b(maybe|if time|someday|optional|could|nice to|browse|watch|game|games|tidy|declutter)\b/i;

// "for 15 minutes", "20 min", "45m", "1.5 hours", "for an hour", "half an hour"
const DURATION =
  /\s*(?:for\s+)?\b(?:(half an hour)|(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)|(an?)\s+(hour|minute))\b/i;

function parseDuration(text) {
  const match = text.match(DURATION);
  if (!match) return { minutes: null, rest: text };
  let minutes;
  if (match[1]) minutes = 30;
  else if (match[4]) minutes = /^h/i.test(match[5]) ? 60 : 1;
  else minutes = /^h/i.test(match[3]) ? parseFloat(match[2]) * 60 : parseFloat(match[2]);
  return { minutes: Math.round(minutes), rest: text.replace(match[0], ' ').replace(/\s+/g, ' ') };
}

export function classifyTask(text) {
  const { minutes, rest } = parseDuration(text.trim());
  const rule = RULES.find((r) => r.pattern.test(rest)) ?? DEFAULT;
  const network = NETWORKS[rule.network];
  const priority = HIGH.test(text) ? 'high' : LOW.test(text) ? 'low' : 'medium';
  return {
    title: rest.trim().replace(/[.,;]+$/, '').trim() || text.trim(),
    network: rule.network,
    intensity: network.intensity,
    estimatedMinutes: minutes ?? network.minutes,
    verificationType: rule.verify,
    priority,
  };
}

// A brain dump → one string per task. Splits on new lines, bullets,
// semicolons and ", then"/" and then".
export function splitBrainDump(text) {
  return text
    .split(/\n|;|•|(?:,\s*)?\band then\b|,\s*then\b|(?:^|\s)-\s/i)
    .map((line) => line.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim())
    .filter((line) => line.length > 1);
}

// Speech → one string per task. People talk in run-on sentences, so
// this also splits on sentence ends, commas, "also", "after that",
// and on "and" when both sides are long enough to be tasks of their
// own ("call mum and book the dentist", not "fish and chips").
const FILLER = /^(?:(?:so|um+|uh+|okay|ok|right|well|and|also|then|plus|tomorrow|today|first(?:ly)?|next|after that|finally|lastly)[\s,]+)*(?:(?:i\s+(?:need|have|want|should|must|gotta|got)\s+to|i've\s+got\s+to|i'm\s+going\s+to|i'll|i\s+will|i\s+gotta|i\s+have)\s+)?/i;

export function splitSpoken(text) {
  return text
    .split(/[\n.!?;]+|,\s*|\b(?:and then|after that|also|plus|then)\b/i)
    .flatMap((part) => {
      const halves = part.split(/\s+and\s+/i);
      return halves.length > 1 && halves.every((h) => h.trim().split(/\s+/).length >= 2) ? halves : [part];
    })
    .map((part) => part.trim().replace(FILLER, '').trim())
    .filter((part) => part.split(/\s+/).length >= 2 || part.length > 4)
    .map((part) => part[0].toUpperCase() + part.slice(1));
}
