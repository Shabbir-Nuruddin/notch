# Notch

Type 1 prototype of a priority-gated task tracker. One screen, local state only.

## The mechanic

- Tasks are High, Medium or Low.
- Medium tasks are locked until every High task is done. Low tasks are locked until every High and Medium task is done.
- Adding a new High task locks Medium and Low again until it is done.
- The list clears when the date changes. Nothing is saved, so a reload also clears it.

The gating rule is in `App.js`, section 2 (`getBlockers` and `isTierUnlocked`).

## Run it

```bash
npm install
npx expo start
```

Press `w` for the browser, or scan the QR code with Expo Go on a phone.

## Web build

```bash
npx expo export -p web
```

Vercel runs this on every push to `main` and serves the `dist` folder (see `vercel.json`).
