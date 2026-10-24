import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Glow, ProgressRing } from '../../components/Progress';
import { Button, IconButton, Screen, Segmented, useReducedMotion } from '../../components/ui';
import { dayInsight } from '../../services/insight';
import { EVERY_DAY, WEEKDAYS, daysLabel, findRoutine, routinesOn } from '../../services/routines';
import { classifyTask, splitBrainDump } from '../../services/taskClassifier';
import { extractTasks } from '../../services/taskExtractor';
import { clockLabel, dateFromKey, dateKey, isTask, isVerified } from '../../services/taskEngine';
import { hush, listen, say, voiceAvailable } from '../../services/voice';
import { useNotch } from '../../state/notch';
import { BG, DANGER, FONT, LINE, MUTED, RAISED, SPECTRUM, SURFACE, TEXT, alpha, formatMinutes, networkColor, type } from '../../theme';

// The list is seeded once from routines and stored plans, so wait
// until they've loaded.
export default function Plan() {
  const { loaded } = useNotch();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: BG }} />;
  return <PlanScreen />;
}

function PlanScreen() {
  const params = useLocalSearchParams();
  const { plans, inbox, plan, profile, routines, saveRoutine } = useNotch();
  const [day, setDay] = useState(params.day === 'tomorrow' ? 'tomorrow' : 'today');
  const key = dateKey(day === 'today' ? 0 : 1);

  // What's already on the list: the routines for that weekday, tasks
  // moved here with "Another day", and when replanning, the day's own
  // unfinished tasks. Nothing else carries over from day to day.
  const seedFor = (d) => {
    const k = dateKey(d === 'today' ? 0 : 1);
    const open = (plans[k]?.blocks ?? []).filter((b) => isTask(b) && !isVerified(b)).map((b) => b.title);
    return dedupe([...routinesOn(routines, k).map((r) => r.title), ...inbox, ...open]);
  };
  const [items, setItems] = useState(() => seedFor(day));
  const [heard, setHeard] = useState(''); // live words while listening
  const [listening, setListening] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [note, setNote] = useState(null); // what the last sort did
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(null); // item whose repeat days are open
  const stopRef = useRef(null);
  const transcriptRef = useRef(''); // everything said this session
  const itemsRef = useRef(items);
  const canTalk = voiceAvailable();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      stopRef.current?.();
      hush();
    },
    []
  );

  const changeDay = (next) => {
    if (next === day) return;
    const oldSeed = seedFor(day).map((t) => t.toLowerCase());
    setItems((list) => dedupe([...seedFor(next), ...list.filter((t) => !oldSeed.includes(t.toLowerCase()))]));
    setDay(next);
    setEditing(null);
  };

  // Everything said goes to Gemini once listening stops. It strips
  // the filler, splits it into one task per line, drops vague bits
  // ("do some things") and spots repeats ("every Monday").
  const sortSpeech = async () => {
    const said = transcriptRef.current.trim();
    transcriptRef.current = '';
    if (!said) return;
    setSorting(true);
    try {
      const { tasks, notice } = await extractTasks(said, itemsRef.current);
      const weekday = dateFromKey(key).getDay();
      const repeating = tasks.filter((t) => t.days);
      repeating.forEach((t) => saveRoutine(t.title, t.days));
      const forThisDay = tasks.filter((t) => !t.days || t.days.includes(weekday)).map((t) => t.title);
      const otherDays = repeating.filter((t) => !t.days.includes(weekday));
      setItems((list) => dedupe([...list, ...forThisDay]));
      setNote(sortNote({ tasks, repeating, otherDays, notice, day }));
    } finally {
      setSorting(false);
    }
  };

  const toggleListening = async () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    setError(null);
    setNote(null);
    setHeard('');
    transcriptRef.current = '';
    setListening(true);
    stopRef.current = await listen({
      onText: (text) => {
        transcriptRef.current = text;
        setHeard(text);
      },
      onEnd: () => {
        setListening(false);
        setHeard('');
        sortSpeech();
      },
      onError: (message) => {
        setError(message);
        setListening(false);
      },
    });
  };

  const addDraft = () => {
    const lines = splitBrainDump(draft);
    if (lines.length) setItems((list) => dedupe([...list, ...lines]));
    setDraft('');
  };

  const submit = async () => {
    const lines = dedupe([...items, ...splitBrainDump(draft)]);
    if (!lines.length) return;
    setDraft('');
    setBusy(true);
    try {
      const next = await plan(key, lines);
      const insight = dayInsight({ ...next, input: lines }, profile);
      setResult({ plan: next, insight });
      if (profile.voiceReplies) say(recap(next, insight, day));
    } finally {
      setBusy(false);
    }
  };

  if (result) return <Planned result={result} day={day} dateKeyStr={key} />;

  const repeatCount = items.filter((t) => findRoutine(routines, t)).length;
  const status = sorting
    ? 'Sorting what you said…'
    : listening
      ? heard.length > 140
        ? `…${heard.slice(-140)}`
        : heard || 'Listening… say everything on your mind'
      : items.length
        ? 'Tap to add more'
        : 'Tap and say what’s on';

  return (
    <Screen
      title={day === 'today' ? 'Plan today' : 'Plan tomorrow'}
      right={<IconButton name="x" label="Close" onPress={() => router.back()} />}
      back={false}
      background={<Glow colors={listening ? [DANGER, SPECTRUM[5]] : [SPECTRUM[5], SPECTRUM[3]]} opacity={0.3} height={420} />}
    >
      <Segmented
        label="Day to plan"
        value={day}
        onChange={changeDay}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'tomorrow', label: 'Tomorrow' },
        ]}
      />

      {canTalk && (
        <View style={styles.micArea}>
          <MicButton listening={listening} sorting={sorting} onPress={toggleListening} />
          <Text style={[type.sub, styles.heard, listening && heard ? { color: TEXT } : null]} numberOfLines={3}>
            {status}
          </Text>
        </View>
      )}
      {error && <Text style={[type.sub, { color: DANGER, textAlign: 'center', marginBottom: 12 }]}>{error}</Text>}
      {note && !listening && !sorting && (
        <View style={styles.note} accessibilityLiveRegion="polite">
          <Feather name="zap" size={14} color={SPECTRUM[1]} style={{ marginTop: 2 }} />
          <Text style={[type.caption, { flex: 1, color: TEXT }]}>{note}</Text>
        </View>
      )}

      {items.length > 0 && (
        <Text style={[type.caption, styles.count]}>
          {items.length} {items.length === 1 ? 'task' : 'tasks'}
          {repeatCount ? `, ${repeatCount} repeating` : ''}
        </Text>
      )}
      <View style={[styles.list, !canTalk && { marginTop: 20 }]}>
        {items.map((item, i) => (
          <PlanItem
            key={`${item}-${i}`}
            item={item}
            routine={findRoutine(routines, item)}
            editing={editing === item}
            onEdit={() => setEditing((e) => (e === item ? null : item))}
            onRepeat={(days) => saveRoutine(item, days)}
            onRemove={() => {
              setItems((list) => list.filter((_, k) => k !== i));
              if (editing === item) setEditing(null);
            }}
          />
        ))}
        <View style={styles.inputRow}>
          <Feather name="plus" size={18} color={MUTED} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            placeholder={canTalk ? 'Or type a task' : 'Type a task'}
            placeholderTextColor={MUTED}
            returnKeyType="done"
            submitBehavior="submit"
            style={styles.input}
            accessibilityLabel="Add a task"
          />
          {draft.trim().length > 0 && <IconButton name="corner-down-left" size={18} label="Add task" onPress={addDraft} />}
        </View>
      </View>
      {items.length > 0 && (
        <Text style={[type.caption, styles.hint]}>Tap the repeat icon to bring a task back every day or on set days. Everything else stays on this day only.</Text>
      )}

      <Button
        label={busy ? 'Planning' : sorting ? 'Sorting' : listening ? 'Listening' : `Plan ${day}`}
        busy={busy || sorting}
        disabled={listening || (!items.length && !draft.trim())}
        onPress={submit}
        style={{ marginTop: 20 }}
      />
    </Screen>
  );
}

function sortNote({ tasks, repeating, otherDays, notice, day }) {
  const parts = [];
  if (!tasks.length) parts.push('No specific task in that. Try saying what you’ll do, like “study maths for an hour”.');
  if (repeating.length) {
    parts.push(`Repeating: ${repeating.map((t) => `${t.title} (${daysLabel(t.days).toLowerCase()})`).join(', ')}.`);
  }
  if (otherDays.length) {
    parts.push(`${otherDays.map((t) => t.title).join(', ')} ${otherDays.length === 1 ? 'isn’t' : 'aren’t'} on ${day}, so ${otherDays.length === 1 ? 'it' : 'they'}’ll show up on ${otherDays.length === 1 ? 'its' : 'their'} own days.`);
  }
  if (notice) parts.push(notice);
  return parts.join(' ') || null;
}

// "Every day", "Weekdays", "on Mon, Thu"
function repeatText(days) {
  const label = daysLabel(days);
  return days.length === 7 || label === 'Weekdays' || label === 'Weekends' ? label.toLowerCase() : `on ${label}`;
}

function PlanItem({ item, routine, editing, onEdit, onRepeat, onRemove }) {
  const color = networkColor(classifyTask(item).network);
  const days = routine?.days ?? [];
  const toggleDay = (d) => onRepeat(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
  const isWeekdays = days.length === 5 && !days.includes(0) && !days.includes(6);
  return (
    <View style={styles.itemWrap}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={{ flex: 1, paddingVertical: 10 }}>
          <Text style={type.body}>{item}</Text>
          {routine && <Text style={[type.caption, { color: SPECTRUM[3] }]}>Repeats {repeatText(routine.days)}</Text>}
        </View>
        <IconButton
          name="repeat"
          size={18}
          color={routine ? SPECTRUM[3] : MUTED}
          label={routine ? `${item} repeats ${repeatText(routine.days)}. Change` : `Make ${item} repeat`}
          onPress={onEdit}
          style={routine ? { backgroundColor: alpha(SPECTRUM[3], 0.14) } : null}
        />
        <IconButton name="x" size={18} color={MUTED} label={`Remove ${item}`} onPress={onRemove} />
      </View>
      {editing && (
        <View style={styles.repeatPanel}>
          <View style={styles.chips}>
            <Chip label="Every day" on={days.length === 7} onPress={() => onRepeat(days.length === 7 ? [] : EVERY_DAY)} wide />
            <Chip label="Weekdays" on={isWeekdays} onPress={() => onRepeat(isWeekdays ? [] : [1, 2, 3, 4, 5])} wide />
          </View>
          <View style={styles.chips}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Chip key={d} label={WEEKDAYS[d].slice(0, 2)} on={days.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </View>
          <Text style={type.caption}>
            {routine
              ? 'Removing it from this list keeps the routine. Clear every day to stop it repeating.'
              : 'Pick the days it should come back on.'}
          </Text>
        </View>
      )}
    </View>
  );
}

function Chip({ label, on, onPress, wide }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.chip, wide && { flex: 1 }, on && { backgroundColor: SPECTRUM[3], borderColor: SPECTRUM[3] }]}
    >
      <Text style={[type.sub, { fontWeight: '600', color: on ? '#000000' : TEXT }]}>{label}</Text>
    </Pressable>
  );
}

function MicButton({ listening, sorting, onPress }) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!listening || reduced) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' })
    );
    loop.start();
    return () => loop.stop();
  }, [listening, reduced, pulse]);

  return (
    <View style={styles.micWrap}>
      {listening ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulse,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            },
          ]}
        />
      ) : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ProgressRing value={1} size={132} stroke={4} label="">
            <View />
          </ProgressRing>
        </View>
      )}
      <Pressable
        onPress={onPress}
        disabled={sorting}
        accessibilityRole="button"
        accessibilityLabel={sorting ? 'Sorting what you said' : listening ? 'Stop listening' : 'Start talking'}
        style={({ pressed }) => [styles.mic, listening && { backgroundColor: DANGER }, pressed && { opacity: 0.85 }]}
      >
        {sorting ? (
          <ActivityIndicator color="#000000" size="large" />
        ) : (
          <Feather name={listening ? 'square' : 'mic'} size={34} color={listening ? TEXT : '#000000'} />
        )}
      </Pressable>
    </View>
  );
}

function Planned({ result, day, dateKeyStr }) {
  const { plan, insight } = result;
  const first = insight.tasks[0];
  const stats = [
    [String(insight.tasks.length), insight.tasks.length === 1 ? 'task' : 'tasks'],
    [String(insight.sessions), insight.sessions === 1 ? 'session' : 'sessions'],
    [formatMinutes(insight.breakMinutes), 'of breaks'],
  ];
  if (insight.savedMinutes) stats.push([`~${insight.savedMinutes} min`, 'saved on switching']);

  return (
    <Screen
      title={day === 'today' ? 'Today' : 'Tomorrow'}
      back={false}
      right={<IconButton name="x" label="Close" onPress={() => router.dismissTo('/')} />}
      background={<Glow colors={[SPECTRUM[2], SPECTRUM[4], SPECTRUM[5]]} opacity={0.3} height={420} />}
    >
      <View style={styles.done}>
        <View style={styles.doneBadge}>
          <Feather name="check" size={34} color="#000000" />
        </View>
        <Text style={[type.large, { textAlign: 'center' }]}>Planned</Text>
        {first && (
          <Text style={[type.sub, { textAlign: 'center' }]}>
            First up at {clockLabel(first.start)}: {first.title}
          </Text>
        )}
      </View>

      <View style={styles.stats}>
        {stats.map(([big, small], i) => (
          <View key={small} style={[styles.stat, { borderTopColor: SPECTRUM[(i * 2) % SPECTRUM.length] }]}>
            <Text style={[type.title, type.digits]}>{big}</Text>
            <Text style={type.caption}>{small}</Text>
          </View>
        ))}
      </View>

      {plan.notice && <Text style={[type.caption, { marginTop: 16 }]}>{plan.notice}</Text>}

      <View style={{ gap: 10, marginTop: 28 }}>
        <Button label="See the day" onPress={() => router.dismissTo('/')} />
        <Button label="Why this order" kind="secondary" icon="activity" onPress={() => router.replace(`/how?day=${dateKeyStr}`)} />
      </View>
    </Screen>
  );
}

function recap(plan, insight, day) {
  const n = insight.tasks.length;
  const first = insight.tasks[0];
  const parts = [`Done. ${n} ${n === 1 ? 'task' : 'tasks'} for ${day}, in ${insight.sessions} ${insight.sessions === 1 ? 'session' : 'sessions'}.`];
  if (first) parts.push(`First up at ${clockLabel(first.start)}: ${first.title}.`);
  if (insight.savedMinutes) parts.push(`Grouping similar work saves about ${insight.savedMinutes} minutes of switching.`);
  parts.push('I’ll ring when each one starts.');
  return parts.join(' ');
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((item) => {
    const k = item.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const styles = StyleSheet.create({
  micArea: { alignItems: 'center', gap: 18, paddingTop: 32, paddingBottom: 16 },
  micWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: DANGER },
  mic: { width: 112, height: 112, borderRadius: 56, backgroundColor: TEXT, alignItems: 'center', justifyContent: 'center' },
  heard: { textAlign: 'center', minHeight: 63, maxWidth: 420 },
  note: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: alpha(SPECTRUM[1], 0.1),
  },
  count: { marginLeft: 16, marginBottom: 8 },
  hint: { marginTop: 10, marginHorizontal: 16 },
  list: { backgroundColor: SURFACE, borderRadius: 16, overflow: 'hidden' },
  itemWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 4, minHeight: 56 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  repeatPanel: { gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flexGrow: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: RAISED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 4, minHeight: 52 },
  input: { flex: 1, fontFamily: FONT, fontSize: 17, color: TEXT, paddingVertical: 12, outlineStyle: 'none' },
  done: { alignItems: 'center', gap: 10, paddingTop: 32 },
  doneBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: SPECTRUM[2], alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: SURFACE, borderRadius: 14, padding: 16, gap: 2, borderTopWidth: 3 },
});
