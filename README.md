# Notch

You hand over the day. Tell Notch everything you need to do, the night before or when you wake up, and it decides the priority, the order, the timing and the breaks, based on which brain systems each task uses and how attention moves through a day.

One Expo codebase runs in the browser now and as an iOS/Android app later.

## Run it

```bash
npm install
cp .env.example .env      # then paste your Gemini keys into it
npx expo start
```

Press `w` for the browser, or scan the QR code with Expo Go on a phone.

Without keys Notch still works: simple offline rules plan the day and the app says so.

## Gemini keys

Several keys can be pooled for testing. Each plan starts on the next key, and a key that hits its rate limit rests while the others carry on.

Two ways to add them:

- **`.env`**: `EXPO_PUBLIC_GEMINI_API_KEYS=key1,key2,key3`. Restart `npx expo start` after editing.
- **In the app**: the sliders button opens *You and your keys*. Paste one or more keys, then use *Test keys* to see which work. These are saved on that device only.

> **Warning.** `EXPO_PUBLIC_` values are built into the JavaScript bundle, so anyone with the app can read them. Use keys this way for testing only. Never set them in a public deployment such as Vercel. A shipped app needs a small server that holds the keys and calls Gemini for the app.

## How a day is planned

1. You write tasks in plain language, one per line, with any deadlines or fixed times.
2. `services/planner.js` sends them to Gemini with a research brief as the system prompt and a strict JSON schema. Gemini returns time blocks. For each block it gives:
   - the brain network it uses: Executive, Memory, Language, Creative, Social, Movement, Autopilot or Recovery
   - its priority and how demanding it is (intensity 0–5)
   - a start time and a length
   - a reason, and an if-then cue to start it
3. Blocks that use the same network are grouped into sessions, so switching costs less. Heavy work goes in your attention peaks, which are measured from your wake time and adjusted for chronotype. Breaks follow fatigue.
4. If Gemini can't be reached, `buildOfflinePlan` in `services/cognitiveEngine.js` does a simpler version with keyword rules.

The research behind all of this, with sources, is in [`docs/BRAIN_RESEARCH.md`](docs/BRAIN_RESEARCH.md).

## The screen

- **Day dial.** Your waking day as an arc. Each block is a segment: colour is its brain network, thickness is how demanding it is. The needle is now; the gap at the bottom is sleep.
- **Backdrop.** Cortex-like folds, generated from noise. The region the current block uses lights up in its network colour.
- **Now panel.** The one thing to do, with the brain system behind it and a single action.
- **Timeline.** The whole plan by session. Tap a block for the reasoning. Done blocks can be undone.

## Layout

```
App.js                     state, clock, planning, wiring
theme.js                   colours, fonts, formatting
components/
  Backdrop.js              procedural brain folds, lit by network
  DayDial.js               the dial
  NowPanel.js              dial centre + current block
  Timeline.js              full plan
  BrainDump.js             "What's on today?" sheet
  Settings.js              wake/sleep, chronotype, key pool
  Glyph.js                 network glyphs and priority notches
  Controls.js              sheet, segmented control, buttons
  LockOverlay.js           app strip + mock lock screen
services/
  planner.js               Gemini prompt, schema, fallback, normalising
  gemini.js                key pool, rotation, model fallback
  brainScience.js          networks and the attention curve
  storage.js               profile, plans and keys in AsyncStorage
  taskEngine.js            statuses, gating, time helpers
  verificationEngine.js    MANUAL / CAMERA / TIMER / DEVICE checks
  taskClassifier.js        keyword fallback for a single task
  cognitiveEngine.js       switch cost, fatigue, offline planner
  distractionController.js mock app blocking
docs/BRAIN_RESEARCH.md     the research
```

## What's simulated

- **Camera checks** and **device focus windows** are mocked (`services/verificationEngine.js`).
- **App blocking** is a mock overlay. Real blocking needs a development build: Android UsageStats/Accessibility, iOS Screen Time (`services/distractionController.js`).
- **Reminders** are in-app toasts, plus browser notifications when the tab is hidden. Reminders that fire with the app closed need `expo-notifications` and a development build.

## Web build

```bash
npx expo export -p web
```

Vercel runs this on every push to `main` and serves `dist` (see `vercel.json`). Don't set Gemini keys there; see the warning above.
