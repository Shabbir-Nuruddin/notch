import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';

import { planDay } from '../services/planner';
import { setUserKeys } from '../services/gemini';
import { DEFAULT_PROFILE, clearAll, loadAll, saveHistory, saveInbox, saveKeys, savePlans, saveProfile, saveRoutines, saveUnlocks, saveCorrections } from '../services/storage';
import { createRoutine, findRoutine, normalizeDays } from '../services/routines';
import { mergeHistory } from '../services/progress';
import { STATUS, currentBlock, dateKey, isVerified, minutesNow, pushLater, swapWithNext } from '../services/taskEngine';
import { isTimed, timeLeftMs } from '../services/verificationEngine';
import { onNotificationOpen, ring, setupNotifications, silence, syncSchedule } from '../services/notify';
import { EMERGENCY_UNLOCK_MINUTES, clearGuard, syncGuard } from '../services/guard';

// ─────────────────────────────────────────────────────────────
// APP STATE
// One provider owns the plans and settings, saves them, and keeps the
// OS in step: alarms (services/notify.js) and app blocking
// (services/guard.js) are rebuilt whenever the plan changes.
//
// Notch runs the day. The person can start a block, finish it, or
// push it back; they can't rearrange the plan.
// ─────────────────────────────────────────────────────────────

const NotchContext = createContext(null);

export function useNotch() {
  return useContext(NotchContext);
}

// Re-renders the caller every `interval` ms.
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

const NO_UNLOCKS = { date: '', used: 0, pausedUntil: 0 };

export function NotchProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfileState] = useState(DEFAULT_PROFILE);
  const [plans, setPlans] = useState({});
  const [keys, setKeysState] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [unlocks, setUnlocks] = useState(NO_UNLOCKS);
  const [routines, setRoutines] = useState([]);
  const [history, setHistory] = useState({});
  const [corrections, setCorrections] = useState({});
  const [toast, setToast] = useState(null); // { text, undo?: { date, id } }
  const rung = useRef(new Set()); // blocks that already rang

  // ── Load and save ──────────────────────────────────────────
  useEffect(() => {
    loadAll().then((saved) => {
      setProfileState(saved.profile);
      setPlans(saved.plans);
      setKeysState(saved.keys);
      setUserKeys(saved.keys);
      setInbox(saved.inbox);
      setUnlocks({ ...NO_UNLOCKS, ...saved.unlocks });
      setRoutines(saved.routines);
      setHistory(mergeHistory(saved.history, saved.plans));
      setCorrections(saved.corrections);
      setLoaded(true);
    });
    setupNotifications();
  }, []);

  useEffect(() => {
    if (loaded) savePlans(plans);
  }, [plans, loaded]);
  useEffect(() => {
    if (loaded) saveProfile(profile);
  }, [profile, loaded]);
  useEffect(() => {
    if (loaded) saveInbox(inbox);
  }, [inbox, loaded]);
  useEffect(() => {
    if (loaded) saveUnlocks(unlocks);
  }, [unlocks, loaded]);
  useEffect(() => {
    if (loaded) saveRoutines(routines);
  }, [routines, loaded]);
  useEffect(() => {
    if (loaded) setHistory((h) => mergeHistory(h, plans));
  }, [plans, loaded]);
  useEffect(() => {
    if (loaded) saveHistory(history);
  }, [history, loaded]);
  useEffect(() => {
    if (loaded) saveCorrections(corrections);
  }, [corrections, loaded]);

  // ── Keep alarms and blocking in step ───────────────────────
  useEffect(() => {
    if (!loaded) return undefined;
    const timer = setTimeout(() => {
      syncSchedule({ plans, profile }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [plans, profile, loaded]);

  useEffect(() => {
    if (loaded) syncGuard({ plans, profile, unlocks });
  }, [plans, profile, unlocks, loaded]);

  // Tapping an alarm, or being sent back from a blocked app.
  useEffect(() => {
    if (!loaded) return undefined;
    return onNotificationOpen((url) => {
      try {
        router.push(url);
      } catch {
        // Navigator not ready yet; the home screen shows the same thing.
      }
    });
  }, [loaded]);

  // ── Block state ────────────────────────────────────────────
  const patchBlocks = useCallback((date, fn) => {
    setPlans((all) => {
      const p = all[date];
      return p ? { ...all, [date]: { ...p, blocks: fn(p.blocks).sort((a, b) => a.start - b.start) } } : all;
    });
  }, []);

  const patchBlock = useCallback(
    (date, id, patch) => patchBlocks(date, (blocks) => blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))),
    [patchBlocks]
  );

  const finish = useCallback(
    (date, block, source) => {
      silence();
      patchBlock(date, block.id, {
        status: STATUS.VERIFIED,
        verifiedAt: Date.now(),
        verification: { status: 'VERIFIED', confidence: null, source },
      });
      setToast({ text: block.kind === 'break' ? 'Break over.' : `Done: ${block.title}`, undo: { date, id: block.id } });
    },
    [patchBlock]
  );

  const start = useCallback(
    (date, block) => {
      silence();
      patchBlock(date, block.id, { status: STATUS.IN_PROGRESS, startedAt: Date.now() });
    },
    [patchBlock]
  );

  const stop = useCallback(
    (date, block) => patchBlock(date, block.id, { status: STATUS.NOT_STARTED, startedAt: null }),
    [patchBlock]
  );

  const done = useCallback((date, block) => finish(date, block, 'you'), [finish]);

  const undo = useCallback(
    (date, id) => {
      patchBlock(date, id, { status: STATUS.NOT_STARTED, startedAt: null, verifiedAt: null, verification: null });
      setToast(null);
    },
    [patchBlock]
  );

  // Push a block back. A running block stops and starts over later.
  const later = useCallback(
    (date, block, minutes) => {
      silence();
      patchBlocks(date, (blocks) =>
        pushLater(blocks, block.id, minutes).map((b) =>
          b.id === block.id ? { ...b, status: STATUS.NOT_STARTED, startedAt: null } : b
        )
      );
      rung.current.delete(block.id);
      setToast({ text: minutes >= 60 ? `Moved ${minutes / 60} h later.` : `Moved ${minutes} min later.` });
    },
    [patchBlocks]
  );

  const afterNext = useCallback(
    (date, block) => {
      silence();
      patchBlocks(date, (blocks) =>
        swapWithNext(blocks, block.id).map((b) => (b.id === block.id ? { ...b, status: STATUS.NOT_STARTED, startedAt: null } : b))
      );
      setToast({ text: 'Swapped with the next task.' });
    },
    [patchBlocks]
  );

  const toTomorrow = useCallback(
    (date, block) => {
      silence();
      patchBlocks(date, (blocks) => blocks.filter((b) => b.id !== block.id));
      setInbox((list) => [...list, block.title]);
      setToast({ text: 'Moved to your next planning session.' });
    },
    [patchBlocks]
  );

  // ── Planning ───────────────────────────────────────────────
  const plan = useCallback(
    async (date, lines) => {
      const next = await planDay({ lines, date, profile });
      setPlans((all) => {
        const keep = all[date]?.blocks.filter(isVerified) ?? [];
        return {
          ...all,
          [date]: { ...next, input: lines, blocks: [...keep, ...next.blocks].sort((a, b) => a.start - b.start) },
        };
      });
      setInbox([]);
      return next;
    },
    [profile]
  );

  // ── Routines ───────────────────────────────────────────────
  // Saving a routine with a title that already exists changes its days.
  const saveRoutine = useCallback((title, days) => {
    const clean = normalizeDays(days);
    setRoutines((list) => {
      const old = findRoutine(list, title);
      if (!clean.length) return old ? list.filter((r) => r !== old) : list;
      if (old) return list.map((r) => (r === old ? { ...r, days: clean } : r));
      return [...list, createRoutine(title, clean)];
    });
  }, []);

  // A rename on the plan screen, remembered so the same words come out
  // the person's way next time. Newest last; the oldest drop off.
  const learnCorrection = useCallback((heard, fixed) => {
    const from = heard.trim().toLowerCase();
    const to = fixed.trim();
    if (!from || !to || from === to.toLowerCase()) return;
    setCorrections((all) => {
      const { [from]: _old, ...rest } = all;
      const entries = Object.entries({ ...rest, [from]: to });
      return Object.fromEntries(entries.slice(-200));
    });
  }, []);

  const removeRoutine = useCallback((id) => setRoutines((list) => list.filter((r) => r.id !== id)), []);

  const setProfile = useCallback((patch) => setProfileState((p) => ({ ...p, ...patch })), []);

  const setKeys = useCallback((list) => {
    setKeysState(list);
    setUserKeys(list);
    saveKeys(list);
  }, []);

  // Five minutes with no blocking, a few times a day.
  const unlocksLeft = (() => {
    const today = dateKey(0);
    const used = unlocks.date === today ? unlocks.used : 0;
    return Math.max(0, profile.blocking.unlocksPerDay - used);
  })();

  const emergencyUnlock = useCallback(() => {
    const today = dateKey(0);
    setUnlocks((u) => {
      const used = u.date === today ? u.used : 0;
      if (used >= profile.blocking.unlocksPerDay) return u;
      return { date: today, used: used + 1, pausedUntil: Date.now() + EMERGENCY_UNLOCK_MINUTES * 60 * 1000 };
    });
  }, [profile.blocking.unlocksPerDay]);

  const resetAll = useCallback(async () => {
    await clearAll();
    clearGuard();
    setUserKeys([]);
    setKeysState([]);
    setPlans({});
    setInbox([]);
    setRoutines([]);
    setHistory({});
    setCorrections({});
    setUnlocks(NO_UNLOCKS);
    setProfileState(DEFAULT_PROFILE);
  }, []);

  // ── The day runs itself ────────────────────────────────────
  // Every few seconds: timed blocks that ran out are finished, breaks
  // start on their own, and a block whose time has come rings and
  // opens the focus screen.
  const latest = useRef(null);
  useEffect(() => {
    latest.current = { plans, finish, start };
  });

  useEffect(() => {
    if (!loaded) return undefined;
    const step = () => {
      if (AppState.currentState !== 'active' || !latest.current) return;
      const { plans: all, finish: fin, start: begin } = latest.current;
      const now = Date.now();
      const today = dateKey(0, new Date(now));
      const block = currentBlock(all[today]);
      if (!block) return;
      const timed = block.kind === 'break' || isTimed(block.verificationType);
      if (block.status === STATUS.IN_PROGRESS && timed && timeLeftMs(block, now) === 0) {
        fin(today, block, 'timer');
        return;
      }
      const late = minutesNow(new Date(now)) - block.start;
      if (block.status === STATUS.NOT_STARTED && late >= 0) {
        if (block.kind === 'break') {
          begin(today, block);
          return;
        }
        if (late < 10 && !rung.current.has(block.id)) {
          rung.current.add(block.id);
          ring({ title: block.title, body: 'Time to start.' });
          try {
            router.push('/focus');
          } catch {
            // Not mounted yet.
          }
        }
      }
    };
    step();
    const timer = setInterval(step, 5000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && step());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loaded]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(
    () => ({
      loaded,
      profile,
      plans,
      keys,
      inbox,
      unlocks,
      unlocksLeft,
      routines,
      history,
      corrections,
      learnCorrection,
      saveRoutine,
      removeRoutine,
      toast,
      setToast,
      setProfile,
      setKeys,
      setInbox,
      plan,
      start,
      stop,
      done,
      undo,
      later,
      afterNext,
      toTomorrow,
      emergencyUnlock,
      resetAll,
    }),
    [loaded, profile, plans, keys, inbox, unlocks, unlocksLeft, routines, history, corrections, learnCorrection, saveRoutine, removeRoutine, toast, setProfile, setKeys, plan, start, stop, done, undo, later, afterNext, toTomorrow, emergencyUnlock, resetAll]
  );

  return <NotchContext.Provider value={value}>{children}</NotchContext.Provider>;
}
