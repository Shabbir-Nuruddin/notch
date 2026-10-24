// ─────────────────────────────────────────────────────────────
// GEMINI CLIENT WITH A KEY POOL
// Several API keys are pooled so testing doesn't stall on one key's
// free-tier limit. Each call starts on the next key (round robin) and
// fails over:
//   429 rate limited     → that key rests for the delay Google asks for
//                          (60 s if none), try the next key
//   400/401/403 bad key  → key is skipped for the rest of the session
//   404 unknown model    → try the next model in MODELS
//   5xx / network error  → try the next key
//
// Keys come from two places, merged and de-duplicated:
//   1. EXPO_PUBLIC_GEMINI_API_KEYS in .env (comma or newline separated)
//   2. keys pasted in the app's settings (saved on this device)
//
// EXPO_PUBLIC_ values are inlined into the JS bundle, so anyone with
// the built app can read them. Fine for testing; before a public
// release, move the call behind a small server.
// ─────────────────────────────────────────────────────────────

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

const ENV_KEYS = parseKeys(process.env.EXPO_PUBLIC_GEMINI_API_KEYS ?? '');

// Newest first. EXPO_PUBLIC_GEMINI_MODEL, if set, is tried before these.
export const MODELS = unique([
  process.env.EXPO_PUBLIC_GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
]);

const TIMEOUT_MS = 60 * 1000;

let userKeys = [];
let cursor = 0;
const restingUntil = new Map(); // `${key}|${model}` → timestamp
const badKeys = new Set();

export class GeminiError extends Error {
  constructor(code, message, attempts = []) {
    super(message);
    this.code = code; // 'NO_KEYS' | 'ALL_FAILED'
    this.attempts = attempts;
  }
}

export function parseKeys(text) {
  return unique(text.split(/[\s,]+/).map((k) => k.trim()));
}

export function setUserKeys(keys) {
  userKeys = unique(keys);
}

export function envKeyCount() {
  return ENV_KEYS.length;
}

export function getKeyPool() {
  return unique([...ENV_KEYS, ...userKeys]);
}

// "AIzaSy…abcd" → "…abcd"
export function maskKey(key) {
  return `…${key.slice(-4)}`;
}

// One generateContent call that must return JSON matching `schema`.
// Returns { data, model, key } where key is masked.
export async function generateJSON({ system, prompt, schema, temperature = 0.4 }) {
  const keys = getKeyPool();
  if (keys.length === 0) {
    throw new GeminiError('NO_KEYS', 'No Gemini API keys are set.');
  }

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  const attempts = [];
  const start = cursor;
  cursor = (cursor + 1) % keys.length;

  for (const model of MODELS) {
    let modelMissing = false;
    for (let i = 0; i < keys.length && !modelMissing; i++) {
      const key = keys[(start + i) % keys.length];
      if (badKeys.has(key)) continue;
      if ((restingUntil.get(`${key}|${model}`) ?? 0) > Date.now()) {
        attempts.push({ key: maskKey(key), model, outcome: 'resting' });
        continue;
      }

      const res = await post(model, key, body);
      const outcome = classify(res);
      attempts.push({ key: maskKey(key), model, outcome, detail: res.message });

      if (outcome === 'ok') {
        const text = responseText(res.json);
        try {
          return { data: JSON.parse(text), model, key: maskKey(key) };
        } catch {
          attempts[attempts.length - 1].outcome = 'bad-json';
          continue;
        }
      }
      if (outcome === 'rate-limited') {
        restingUntil.set(`${key}|${model}`, Date.now() + (res.retryMs ?? 60 * 1000));
      } else if (outcome === 'bad-key') {
        badKeys.add(key);
      } else if (outcome === 'no-model' || outcome === 'bad-request') {
        // The same request will fail on every key; move on to the next model.
        modelMissing = true;
      }
    }
  }

  throw new GeminiError('ALL_FAILED', summarise(attempts), attempts);
}

// Checks every key with a tiny request. Used by "Test keys" in settings.
// Returns [{ key, status: 'ok' | 'rate-limited' | 'bad-key' | ..., model }].
export async function testKeys() {
  const body = {
    contents: [{ role: 'user', parts: [{ text: 'Reply with the word ok.' }] }],
    generationConfig: { maxOutputTokens: 16 },
  };
  return Promise.all(
    getKeyPool().map(async (key) => {
      for (const model of MODELS) {
        const res = await post(model, key, body);
        const outcome = classify(res);
        if (outcome === 'no-model') continue;
        if (outcome === 'ok') badKeys.delete(key);
        if (outcome === 'bad-key') badKeys.add(key);
        return { key: maskKey(key), status: outcome, model, detail: res.message };
      }
      return { key: maskKey(key), status: 'no-model', model: null };
    })
  );
}

async function post(model, key, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null);
    return {
      status: response.status,
      json,
      message: json?.error?.message,
      reason: json?.error?.details?.find((d) => d.reason)?.reason,
      retryMs: retryDelay(json),
    };
  } catch (error) {
    return { status: 0, json: null, message: error.name === 'AbortError' ? 'Timed out' : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function classify({ status, reason, message = '' }) {
  if (status === 200) return 'ok';
  if (status === 429) return 'rate-limited';
  if (status === 404) return 'no-model';
  if (status === 401 || status === 403) return 'bad-key';
  if (status === 400 && (reason === 'API_KEY_INVALID' || /api key/i.test(message))) return 'bad-key';
  if (status === 400) return 'bad-request';
  return 'unavailable'; // 5xx, timeout, offline
}

// Google sends RetryInfo { retryDelay: "33s" } with most 429s.
function retryDelay(json) {
  const info = json?.error?.details?.find((d) => d.retryDelay);
  const seconds = parseFloat(info?.retryDelay ?? '');
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

// Joins the text parts, skipping any thought summaries.
function responseText(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

function summarise(attempts) {
  const count = (o) => attempts.filter((a) => a.outcome === o).length;
  const parts = [];
  if (count('rate-limited') + count('resting')) parts.push('rate limited');
  if (count('bad-key')) parts.push(`${count('bad-key')} key(s) rejected`);
  if (count('unavailable')) parts.push('Gemini unreachable');
  if (count('no-model')) parts.push('model not available');
  if (count('bad-request') || count('bad-json')) parts.push('unexpected response');
  return parts.length ? `Gemini failed: ${parts.join(', ')}.` : 'Gemini failed.';
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}
