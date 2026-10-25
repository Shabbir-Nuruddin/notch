# Notch

You hand over the day. Tell Notch everything you need to do, out loud or typed, the night before or when you wake up. It sorts what you said into tasks, then decides the order, the timing and the breaks, based on which brain systems each task uses and how attention moves through a day.

One Expo codebase (SDK 57, Expo Router) runs in the browser and as an iOS/Android app.

## Run it

```bash
npm install
npx expo start
```

Press `w` for the browser, or scan the QR code with a development build on a phone. Expo Go can't load the app blocker or alarms; see [Phone builds](#phone-builds).

Without Gemini, Notch still works: simple offline rules sort and plan the day, and the app says so.

## Gemini

Notch uses Google Gemini to sort what you said into tasks and to plan the day. It gets a key in one of three ways, tried in this order:

1. **Keys pasted in the app** (Settings → AI planning). Saved on that device only.
2. **`EXPO_PUBLIC_GEMINI_API_KEYS` in `.env`**, comma separated. Restart `npx expo start` after editing.
3. **Notch's server** (`api/gemini.mjs`), when neither of the above is set. This is the normal path on the public site: nobody needs a key of their own.

Several keys can be pooled. Each call starts on the next key, and a key that hits its rate limit rests while the others carry on.

> **Warning.** `EXPO_PUBLIC_` values are built into the JavaScript bundle, so anyone with the app can read them. Use them for local testing only. Never set them on Vercel; set `GEMINI_API_KEYS` there instead (below).

### The server

`api/gemini.mjs` is a Vercel function. It takes `{ system, prompt, schema, temperature }`, calls Gemini with the server's keys and returns `{ data, model }`.

- **Keys:** set `GEMINI_API_KEYS` (comma separated) in the Vercel project's environment variables. `GEMINI_MODEL` optionally picks a model to try first.
- **Guard rails:** it refuses other websites and oversized requests, and allows each IP 30 calls per 10 minutes. The limit is kept in memory per server instance, so it's a brake, not a wall. Move it to a shared store such as Vercel KV before a big launch.
- **Phone builds:** they need the site's address in `EXPO_PUBLIC_API_URL` (for example `https://notch.vercel.app`). Without it, a phone uses its own keys or the offline rules.
- **Local dev:** `npx expo start` doesn't serve `/api`, so the browser falls back to your own keys or the offline rules. Run `npx vercel dev` to try the server locally.

## How it works

1. **Talk or type.** Speech recognition gives one long run of words with no punctuation. `services/taskExtractor.js` turns it into tasks: Gemini when it can, otherwise offline rules that split on lead-ins ("I need to", "I said") and action verbs, and drop thinking out loud ("what else"). Tasks said with "every day" or "on Mondays" become routines.
2. **Check the list.** While you talk, the tasks heard so far show under the mic. When you stop, you can rename any task, join two that were split wrongly, or remove one. Notch remembers your renames and applies them the next time it hears the same thing.
3. **Plan.** `services/planner.js` sends the list to Gemini with a research brief and a strict JSON schema. For each block it gets the brain network, priority, intensity, start time, length, a reason and an if-then cue. Same-network work is grouped to cut switching, heavy work goes in your attention peaks, and breaks follow fatigue. Offline, `buildOfflinePlan` in `services/cognitiveEngine.js` does a simpler version.
4. **Run the day.** Alarms ring at each start. Only the current task can be ticked. Ticked tasks are struck through and sink to the bottom.

The research behind the planning, with sources, is in [`docs/BRAIN_RESEARCH.md`](docs/BRAIN_RESEARCH.md).

## Screens

- **Today** (`src/app/index.js`): the day dial, the current task, today's percentage, the checklist and a quote.
- **Plan** (`src/app/plan.js`): the mic, the task list with repeat days, and Plan.
- **Focus** (`src/app/focus.js`): the one task running now.
- **Progress** (`src/app/progress.js`): streak, completion rate and the last 14 days.
- **Settings** (`src/app/settings/`): wake and sleep times, the daily planning reminder, routines, app blocking and Gemini keys.

Every screen sits over `components/Scenery.js`: a range of ridges with a trail to a summit. It's pre-dawn while nothing is done; each finished task lifts the sun and lights more of the trail.

## Layout

```
api/gemini.mjs             Gemini proxy (Vercel function)
src/app/                   screens (Expo Router)
components/
  Scenery.js               the sunrise backdrop, driven by today's progress
  DayDial.js               the day as an arc of blocks
  NowPanel.js              current block and its actions
  Progress.js              ring, bar, checklist, trend bars
  QuoteCard.js             motivational quote, tap for another
  ui.js                    screen shell, buttons, rows, segmented control
services/
  taskExtractor.js         speech → tasks (Gemini + offline rules), learned renames
  planner.js               tasks → timed plan (Gemini + offline fallback)
  gemini.js                key pool, model fallback, server fallback
  cognitiveEngine.js       offline scheduler
  brainScience.js          brain networks and the attention curve
  taskEngine.js            block statuses, gating, time helpers
  routines.js              repeating tasks
  progress.js              daily history and streaks
  notify.js                alarms and the daily planning reminder
  guard.js                 app-blocking windows
  voice.js                 speech recognition and spoken replies
  storage.js               everything saved on the device
state/notch.js             app state provider
modules/notch-guard/       Android app blocker (native module)
```

## What's real and what isn't

- **Real:** speech recognition, Gemini sorting and planning, alarms and the daily reminder on phones, and app blocking on Android (an accessibility service in `modules/notch-guard`).
- **Web limits:** browsers can't schedule alarms, so they ring only while the tab is open. The planning reminder shows as a banner in the app.
- **Mocked:** camera checks and device focus checks (`services/verificationEngine.js`). iOS app blocking (Screen Time) isn't built.

## Phone builds

The app blocker and alarm sounds are native code, so they need a development build rather than Expo Go:

```bash
npx eas-cli@latest build --profile development --platform android
```

## Web build and deploy

```bash
npx expo export -p web
```

Vercel builds this and serves `dist`, plus `api/` as functions (see `vercel.json`). Connect the Vercel project to the GitHub repo (`npx vercel git connect`) so each push to `main` deploys.
