// ─────────────────────────────────────────────────────────────
// GEMINI PROXY (Vercel function, POST /api/gemini)
// The app sends { system, prompt, schema, temperature } and gets back
// { data, model }. The keys live in the server's GEMINI_API_KEYS
// environment variable (comma separated), so nobody needs their own
// key and none ends up in the app's JavaScript.
//
// Guard rails, since anyone can call this URL:
//   - requests from other websites are refused
//   - size limits on everything sent
//   - each IP gets RATE_LIMIT calls per RATE_WINDOW_MS. This is kept
//     in memory, so it's per server instance and resets on a cold
//     start. Good enough to stop a runaway loop; a real launch wants a
//     shared store such as Vercel KV.
// ─────────────────────────────────────────────────────────────

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const KEYS = unique((process.env.GEMINI_API_KEYS ?? '').split(/[\s,]+/));
const MODELS = unique([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']);

const LIMITS = { system: 16000, prompt: 16000, schema: 8000 };
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 55 * 1000;

const calls = new Map(); // ip → timestamps in the current window
const restingUntil = new Map(); // `${key}|${model}` → timestamp
let cursor = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if (!sameSite(req)) return send(res, 403, { error: 'Not allowed from this site.' });
  if (!KEYS.length) return send(res, 503, { error: 'No Gemini keys on the server.', code: 'NO_KEYS' });

  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (!allow(ip)) return send(res, 429, { error: 'Too many requests. Try again in a few minutes.' });

  const { system, prompt, schema, temperature } = req.body ?? {};
  const schemaText = JSON.stringify(schema ?? null);
  if (typeof system !== 'string' || typeof prompt !== 'string' || !schema || typeof schema !== 'object') {
    return send(res, 400, { error: 'Send system, prompt and schema.' });
  }
  if (system.length > LIMITS.system || prompt.length > LIMITS.prompt || schemaText.length > LIMITS.schema) {
    return send(res, 413, { error: 'Request too large.' });
  }

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: Math.min(1, Math.max(0, Number(temperature) || 0.4)),
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  const start = cursor;
  cursor = (cursor + 1) % KEYS.length;
  for (const model of MODELS) {
    for (let i = 0; i < KEYS.length; i++) {
      const key = KEYS[(start + i) % KEYS.length];
      if ((restingUntil.get(`${key}|${model}`) ?? 0) > Date.now()) continue;
      const r = await post(model, key, body);
      if (r.status === 200) {
        try {
          return send(res, 200, { data: JSON.parse(responseText(r.json)), model });
        } catch {
          continue;
        }
      }
      if (r.status === 429) restingUntil.set(`${key}|${model}`, Date.now() + (r.retryMs ?? 60 * 1000));
      // Unknown model or a request Gemini won't take: same on every key.
      if (r.status === 404 || (r.status === 400 && !/api key/i.test(r.message ?? ''))) break;
    }
  }
  return send(res, 502, { error: 'Gemini is busy or unreachable.' });
}

// Browsers send Origin on POST. The app on a phone sends none.
function sameSite(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const { host, hostname } = new URL(origin);
    return host === req.headers.host || hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function allow(ip) {
  const now = Date.now();
  const recent = (calls.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    calls.set(ip, recent);
    return false;
  }
  recent.push(now);
  calls.set(ip, recent);
  if (calls.size > 5000) calls.delete(calls.keys().next().value);
  return true;
}

async function post(model, key, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null);
    const seconds = parseFloat(json?.error?.details?.find((d) => d.retryDelay)?.retryDelay ?? '');
    return {
      status: response.status,
      json,
      message: json?.error?.message,
      retryMs: Number.isFinite(seconds) ? seconds * 1000 : null,
    };
  } catch {
    return { status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

function responseText(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

function send(res, status, body) {
  res.status(status).json(body);
}

function unique(list) {
  return [...new Set(list.map((s) => s?.trim()).filter(Boolean))];
}
