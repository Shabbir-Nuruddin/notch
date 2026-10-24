import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { clockLabel, dateKey, epochAt, isVerified } from './taskEngine';

// ─────────────────────────────────────────────────────────────
// ALARMS AND REMINDERS
// Every block still to do gets an alarm at its start time (and an
// optional heads-up five minutes before). One daily reminder opens
// the planning session. Alarms are scheduled with the OS, so they ring
// with Notch closed.
//
// On Android, task alarms use a channel with alarm audio, so they
// ring at alarm volume and get through Do Not Disturb. The web can't
// schedule anything: it rings only while the tab is open.
// ─────────────────────────────────────────────────────────────

const WEB = Platform.OS === 'web';
const ALARM_SOUND = 'notch_alarm.wav';

// Android channel settings are fixed once created, so a change to
// these means a new channel id.
const CHANNELS = {
  alarm: 'notch-alarm-v1',
  headsUp: 'notch-headsup-v1',
  planning: 'notch-planning-v1',
};

// iOS keeps at most 64 pending notifications.
const MAX_SCHEDULED = 60;

let ready = null;

export function setupNotifications() {
  if (WEB || ready) return ready;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  ready = Platform.OS === 'android' ? createChannels() : Promise.resolve();
  return ready;
}

async function createChannels() {
  await Notifications.setNotificationChannelAsync(CHANNELS.alarm, {
    name: 'Task alarms',
    description: 'Rings when it is time to start a task.',
    importance: Notifications.AndroidImportance.MAX,
    sound: ALARM_SOUND,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    vibrationPattern: [0, 700, 400, 700, 400, 700],
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.headsUp, {
    name: 'Heads-up',
    description: 'Five minutes before a task, and when breaks start.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250],
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.planning, {
    name: 'Daily planning',
    description: 'The daily reminder to tell Notch what is on.',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// ── Permission ───────────────────────────────────────────────
export async function notificationStatus() {
  if (WEB) {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission === 'default' ? 'undetermined' : window.Notification.permission;
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// Must be called from a tap on the web.
export async function requestNotifications() {
  if (WEB) {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    try {
      return await window.Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }
  await setupNotifications();
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

// ── Scheduling ───────────────────────────────────────────────
let lastSignature = '';

// Rebuilds every scheduled notification from the plans and settings.
// Cheap to call often: nothing happens unless the schedule changed.
export async function syncSchedule({ plans, profile, now = Date.now() }) {
  if (WEB) return;
  const items = buildSchedule({ plans, profile, now });
  const signature = JSON.stringify(items.map((i) => [i.at, i.title, i.channel]));
  if (signature === lastSignature) return;
  lastSignature = signature;

  await setupNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of items) {
    const trigger =
      item.daily != null
        ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(item.daily / 60), minute: item.daily % 60, channelId: item.channel }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at), channelId: item.channel };
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: { url: item.url },
          sound: item.channel === CHANNELS.alarm ? ALARM_SOUND : 'default',
          priority: item.channel === CHANNELS.alarm ? Notifications.AndroidNotificationPriority.MAX : undefined,
        },
        trigger,
      });
    } catch {
      // A time that passed while we were scheduling. Skip it.
    }
  }
}

export function buildSchedule({ plans, profile, now = Date.now() }) {
  const items = [];
  for (const offset of [0, 1]) {
    const key = dateKey(offset, new Date(now));
    const plan = plans[key];
    if (!plan) continue;
    const blocks = plan.blocks.filter((b) => !isVerified(b)).sort((a, b) => a.start - b.start);
    for (const b of blocks) {
      const at = epochAt(key, b.start);
      const until = clockLabel(b.start + b.estimatedMinutes);
      if (b.kind === 'break') {
        if (at > now + 5000) {
          items.push({ at, channel: CHANNELS.headsUp, title: `Break: ${b.title}`, body: `Until ${until}.`, url: '/focus' });
        }
        continue;
      }
      if (profile.alerts.atStart && at > now + 5000) {
        items.push({ at, channel: CHANNELS.alarm, title: b.title, body: `Start now. Until ${until}.`, url: '/focus' });
      }
      const soon = at - 5 * 60 * 1000;
      if (profile.alerts.headsUp && soon > now + 5000) {
        items.push({ at: soon, channel: CHANNELS.headsUp, title: `In 5 minutes: ${b.title}`, body: `At ${clockLabel(b.start)}.`, url: '/' });
      }
    }
  }
  items.sort((a, b) => a.at - b.at);
  const kept = items.slice(0, MAX_SCHEDULED - 1);

  const { mode, minute } = profile.planning;
  kept.push({
    daily: Math.round(minute) % 1440,
    at: 0,
    channel: CHANNELS.planning,
    title: mode === 'night' ? 'Plan tomorrow' : 'Plan today',
    body: 'Tell Notch what’s on. It takes a minute.',
    url: `/plan?day=${mode === 'night' ? 'tomorrow' : 'today'}`,
  });
  return kept;
}

// Fires a real alarm in five seconds, to check sound and volume.
export async function testAlarm() {
  if (WEB) {
    ring();
    return;
  }
  await setupNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Test alarm', body: 'This is how a task alarm sounds.', sound: ALARM_SOUND, data: { url: '/focus' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNELS.alarm },
  });
}

// ── Tapping a notification ───────────────────────────────────
export function onNotificationOpen(handler) {
  if (WEB) return () => {};
  const last = Notifications.getLastNotificationResponse();
  const url = last?.notification.request.content.data?.url;
  if (typeof url === 'string') handler(url);
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const next = response.notification.request.content.data?.url;
    if (typeof next === 'string') handler(next);
  });
  return () => sub.remove();
}

// ── Ringing in the app ───────────────────────────────────────
// Used when a block starts while Notch is open. On the web this is
// the only alarm there is: the same two-note chime as the app sound,
// repeating until silence() or 30 seconds.
let audio = null;
let ringTimer = null;

export function ring({ title, body } = {}) {
  if (!WEB) {
    Vibration.vibrate([0, 700, 400, 700]);
    return;
  }
  silence();
  if (title && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted' && document.hidden) {
    try {
      new window.Notification(title, { body, icon: '/favicon.ico', requireInteraction: true });
    } catch {
      // Some browsers only allow notifications from a service worker.
    }
  }
  const Ctx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctx) return;
  try {
    audio = audio ?? new Ctx();
    audio.resume?.();
  } catch {
    return;
  }
  let beat = 0;
  const chime = () => {
    const t0 = audio.currentTime;
    const gain = Math.min(0.5, 0.18 + beat * 0.04);
    [
      [0, 784],
      [0.18, 1175],
      [0.5, 784],
      [0.68, 1175],
    ].forEach(([offset, freq]) => {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + offset);
      g.gain.linearRampToValueAtTime(gain, t0 + offset + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.42);
      osc.connect(g).connect(audio.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.45);
    });
    beat += 1;
  };
  chime();
  ringTimer = setInterval(() => {
    if (beat >= 19) silence();
    else chime();
  }, 1600);
}

export function silence() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
  if (!WEB) Vibration.cancel();
}
