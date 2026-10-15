import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';

// ─────────────────────────────────────────────────────────────
// 1. PRIORITY TIERS
// Order matters: a tier can only open once every tier listed
// before it is finished.
// ─────────────────────────────────────────────────────────────
const TIERS = ['high', 'medium', 'low'];

const TIER_INFO = {
  high: { label: 'High', color: '#FF5A36' },
  medium: { label: 'Medium', color: '#FFC83D' },
  low: { label: 'Low', color: '#B4E8BC' },
};

// ─────────────────────────────────────────────────────────────
// 2. THE GATING RULE (the mechanic this prototype is testing)
//
// A tier is UNLOCKED when every task in every tier above it is done.
//   - High is always unlocked (nothing is above it).
//   - Medium unlocks when all High tasks are done.
//   - Low unlocks when all High AND all Medium tasks are done.
//   - An empty tier above doesn't block anything.
//
// Adding a new High task re-locks Medium and Low until it is done.
// ─────────────────────────────────────────────────────────────

// Unfinished tasks in the tiers above `tier`. If this list is empty,
// the tier is open.
function getBlockers(tier, tasks) {
  const tiersAbove = TIERS.slice(0, TIERS.indexOf(tier));
  return tasks.filter((task) => tiersAbove.includes(task.priority) && !task.done);
}

function isTierUnlocked(tier, tasks) {
  return getBlockers(tier, tasks).length === 0;
}

// The short line on a locked tier, e.g. "Finish 2 High tasks first".
function lockHint(tier, tasks) {
  const blockers = getBlockers(tier, tasks);
  const n = blockers.length;
  const tiersBlocking = [...new Set(blockers.map((t) => t.priority))];
  const plural = n === 1 ? '' : 's';
  if (tiersBlocking.length === 1) {
    return `Finish ${n} ${TIER_INFO[tiersBlocking[0]].label} task${plural} first`;
  }
  return `Finish ${n} task${plural} above first`;
}

// ─────────────────────────────────────────────────────────────
// 3. DAILY RESET
// Tasks belong to one calendar day. When the date changes, the
// list is cleared. Nothing is saved yet, so a reload clears it too.
// ─────────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

let nextId = 1;
const NATIVE = Platform.OS !== 'web';

// ─────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
  });
  const [tasks, setTasks] = useState([]);
  const [day, setDay] = useState(todayKey());
  const [banner, setBanner] = useState(null);

  // Clear the list when the day changes: checked every minute and
  // whenever the app comes back to the foreground.
  useEffect(() => {
    const checkDay = () => {
      if (todayKey() !== day) {
        setTasks([]);
        setDay(todayKey());
      }
    };
    const timer = setInterval(checkDay, 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDay();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [day]);

  // Lock state for each tier, recalculated on every render.
  const unlocked = {};
  TIERS.forEach((tier) => {
    unlocked[tier] = isTierUnlocked(tier, tasks);
  });

  // Show "Medium unlocked" when a tier that had tasks waiting
  // flips from locked to unlocked.
  const prevUnlocked = useRef(unlocked);
  useEffect(() => {
    const opened = TIERS.find(
      (tier) =>
        !prevUnlocked.current[tier] &&
        unlocked[tier] &&
        tasks.some((t) => t.priority === tier && !t.done)
    );
    prevUnlocked.current = unlocked;
    if (opened) {
      setBanner({ tier: opened, key: Date.now() });
      AccessibilityInfo.announceForAccessibility(`${TIER_INFO[opened].label} unlocked`);
    }
  });

  function addTask(title, priority) {
    setTasks((current) => [...current, { id: nextId++, title, priority, done: false }]);
  }

  function toggleTask(id) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        // Guard: a task in a locked tier can't be changed.
        if (!isTierUnlocked(task.priority, current)) return task;
        return { ...task, done: !task.done };
      })
    );
  }

  if (!fontsLoaded) return <View style={styles.safe} />;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.frame}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            <Header tasks={tasks} unlocked={unlocked} />

            {tasks.length === 0 ? (
              <EmptyState />
            ) : (
              TIERS.map((tier) => (
                <TierCard
                  key={tier}
                  tier={tier}
                  tasks={tasks.filter((t) => t.priority === tier)}
                  unlocked={unlocked[tier]}
                  hint={unlocked[tier] ? null : lockHint(tier, tasks)}
                  onToggle={toggleTask}
                />
              ))
            )}
          </ScrollView>

          <View>
            {banner && <UnlockBanner key={banner.key} tier={banner.tier} />}
            <Composer onAdd={addTask} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────

// Date, big title, done count, and the notch bar: one notch per task,
// in tier order, filled with the tier colour once the task is done.
function Header({ tasks, unlocked }) {
  const done = tasks.filter((t) => t.done).length;
  const ordered = TIERS.flatMap((tier) => tasks.filter((t) => t.priority === tier));

  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{todayLabel()}</Text>
      <View style={styles.headerRow}>
        <Text style={styles.display} accessibilityRole="header">
          Today
        </Text>
        <View style={styles.score}>
          <Text style={styles.scoreNum}>
            {done}
            <Text style={styles.scoreOf}>/{tasks.length}</Text>
          </Text>
          <Text style={styles.scoreLabel}>done</Text>
        </View>
      </View>

      <View style={styles.notches}>
        {ordered.length === 0 ? (
          <View style={[styles.notch, styles.notchEmpty]} />
        ) : (
          ordered.map((task) => (
            <Notch
              key={task.id}
              done={task.done}
              locked={!unlocked[task.priority]}
              color={TIER_INFO[task.priority].color}
            />
          ))
        )}
      </View>
    </View>
  );
}

function Notch({ done, locked, color }) {
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: done ? 1 : 0, duration: 240, useNativeDriver: false }).start();
  }, [done]);
  const backgroundColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [locked ? '#1E211E' : '#343A34', color],
  });
  return <Animated.View style={[styles.notch, { backgroundColor }]} />;
}

function EmptyState() {
  const steps = [
    ['high', 'Add the tasks that matter most as High.'],
    ['medium', 'Finish them and Medium opens.'],
    ['low', 'Finish Medium and Low opens.'],
  ];
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>What has to get done today?</Text>
      {steps.map(([tier, text], i) => (
        <View key={tier} style={styles.step}>
          <View style={[styles.stepNum, { backgroundColor: TIER_INFO[tier].color }]}>
            <Text style={styles.stepNumText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

function TierCard({ tier, tasks, unlocked, hint, onToggle }) {
  const info = TIER_INFO[tier];
  const done = tasks.filter((t) => t.done).length;

  // 0 = locked, 1 = unlocked. Drives the band colour, the task fade,
  // and a small bump on the card the moment it opens.
  const open = useRef(new Animated.Value(unlocked ? 1 : 0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const wasUnlocked = useRef(unlocked);

  useEffect(() => {
    Animated.timing(open, {
      toValue: unlocked ? 1 : 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
    if (unlocked && !wasUnlocked.current) {
      bump.setValue(0.96);
      Animated.spring(bump, { toValue: 1, friction: 4, tension: 140, useNativeDriver: NATIVE }).start();
    }
    wasUnlocked.current = unlocked;
  }, [unlocked]);

  const bandColor = open.interpolate({ inputRange: [0, 1], outputRange: ['#232723', info.color] });
  const taskOpacity = open.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const ink = unlocked ? INK : '#8C918A';

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: bump }] }]}>
      <Animated.View style={[styles.band, { backgroundColor: bandColor }]}>
        <Text style={[styles.bandLabel, { color: ink }]}>{info.label}</Text>
        <View style={styles.bandRight}>
          {tasks.length > 0 && (
            <Text style={[styles.bandCount, { color: ink }]}>
              {done}/{tasks.length}
            </Text>
          )}
          <Feather name={unlocked ? 'unlock' : 'lock'} size={18} color={ink} />
        </View>
      </Animated.View>

      {hint && (
        <View style={styles.hintRow}>
          <Feather name="corner-left-up" size={14} color={info.color} />
          <Text style={styles.hint}>{hint}</Text>
        </View>
      )}

      <Animated.View style={{ opacity: taskOpacity }}>
        {tasks.length === 0 ? (
          <Text style={styles.none}>No {info.label.toLowerCase()} tasks</Text>
        ) : (
          tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              color={info.color}
              locked={!unlocked}
              first={i === 0}
              onToggle={() => onToggle(task.id)}
            />
          ))
        )}
      </Animated.View>
    </Animated.View>
  );
}

function TaskRow({ task, color, locked, first, onToggle }) {
  const pop = useRef(new Animated.Value(1)).current;

  function handlePress() {
    // Small pop on the check box when a task is completed.
    if (!task.done) {
      pop.setValue(0.55);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 220, useNativeDriver: NATIVE }).start();
    }
    onToggle();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={locked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done, disabled: locked }}
      accessibilityLabel={locked ? `${task.title}, locked` : task.title}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}
    >
      <Animated.View
        style={[
          styles.check,
          { borderColor: locked ? '#3A3F3A' : color, transform: [{ scale: pop }] },
          task.done && { backgroundColor: locked ? '#3A3F3A' : color },
        ]}
      >
        {task.done ? (
          <Feather name="check" size={16} color={INK} />
        ) : locked ? (
          <Feather name="lock" size={12} color="#6E736C" />
        ) : null}
      </Animated.View>
      <Text style={[styles.taskTitle, task.done && styles.taskDone, locked && styles.taskLocked]}>
        {task.title}
      </Text>
    </Pressable>
  );
}

function Composer({ onAdd }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('high');
  const canAdd = title.trim().length > 0;

  function submit() {
    if (!canAdd) return;
    onAdd(title.trim(), priority);
    setTitle('');
  }

  return (
    <View style={styles.composer}>
      <View style={styles.chips}>
        {TIERS.map((tier) => {
          const selected = tier === priority;
          const { color, label } = TIER_INFO[tier];
          return (
            <Pressable
              key={tier}
              onPress={() => setPriority(tier)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} priority`}
              style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
            >
              {!selected && <View style={[styles.chipDot, { backgroundColor: color }]} />}
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          placeholder="Add a task"
          placeholderTextColor="#6E736C"
          returnKeyType="done"
          submitBehavior="submit"
          style={styles.input}
          accessibilityLabel="New task"
        />
        <Pressable
          onPress={submit}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          style={({ pressed }) => [
            styles.addButton,
            !canAdd && styles.addButtonOff,
            pressed && canAdd && styles.addButtonPressed,
          ]}
        >
          <Feather name="arrow-up" size={22} color={canAdd ? INK : '#6E736C'} />
        </Pressable>
      </View>
    </View>
  );
}

// Slides up above the composer in the colour of the tier that opened.
function UnlockBanner({ tier }) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(slide, { toValue: 1, friction: 6, tension: 120, useNativeDriver: NATIVE }),
      Animated.delay(1500),
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: NATIVE }),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          backgroundColor: TIER_INFO[tier].color,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <Feather name="unlock" size={20} color={INK} />
      <Text style={styles.bannerText}>{TIER_INFO[tier].label} unlocked</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// Flat colours only. Anton for display type, Archivo for text.
// ─────────────────────────────────────────────────────────────
const BG = '#111311';
const SURFACE = '#1A1D1A';
const LINE = '#2A2E2A';
const TEXT = '#F2F1EA';
const MUTED = '#9A9F98';
const INK = '#111311';
const DISPLAY = 'Anton_400Regular';
const BODY = 'Archivo_400Regular';
const BODY_SEMI = 'Archivo_600SemiBold';
const BODY_BOLD = 'Archivo_700Bold';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },

  header: { paddingTop: 18, paddingBottom: 8, paddingHorizontal: 4 },
  eyebrow: {
    fontFamily: BODY_SEMI,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: MUTED,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  display: {
    fontFamily: DISPLAY,
    fontSize: 72,
    lineHeight: 80,
    color: TEXT,
    textTransform: 'uppercase',
  },
  score: { alignItems: 'flex-end', paddingBottom: 10 },
  scoreNum: { fontFamily: DISPLAY, fontSize: 40, lineHeight: 44, color: TEXT },
  scoreOf: { color: '#5E635C' },
  scoreLabel: {
    fontFamily: BODY_SEMI,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: MUTED,
  },
  notches: { flexDirection: 'row', gap: 4, marginTop: 6 },
  notch: { flex: 1, height: 12, borderRadius: 3 },
  notchEmpty: { backgroundColor: '#1E211E' },

  empty: { marginTop: 24, paddingHorizontal: 4 },
  emptyTitle: {
    fontFamily: DISPLAY,
    fontSize: 34,
    lineHeight: 40,
    color: TEXT,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumText: { fontFamily: DISPLAY, fontSize: 18, color: INK },
  stepText: { flex: 1, fontFamily: BODY, fontSize: 16, lineHeight: 22, color: TEXT },

  card: { backgroundColor: SURFACE, borderRadius: 18, marginTop: 14, overflow: 'hidden' },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bandLabel: { fontFamily: DISPLAY, fontSize: 26, lineHeight: 32, textTransform: 'uppercase' },
  bandRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bandCount: { fontFamily: BODY_BOLD, fontSize: 15, fontVariant: ['tabular-nums'] },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  hint: { fontFamily: BODY_SEMI, fontSize: 14, color: TEXT },
  none: { fontFamily: BODY, fontSize: 15, color: '#6E736C', paddingHorizontal: 16, paddingVertical: 16 },

  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: LINE },
  rowPressed: { backgroundColor: '#212521' },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  taskTitle: { flex: 1, fontFamily: BODY, fontSize: 17, lineHeight: 23, color: TEXT },
  taskDone: { color: '#6E736C', textDecorationLine: 'line-through' },
  taskLocked: { color: '#7A7F78' },

  composer: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#343A34',
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: BODY_SEMI, fontSize: 15, color: TEXT },
  chipTextSelected: { color: INK },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: BG,
    paddingHorizontal: 16,
    fontFamily: BODY,
    fontSize: 17,
    color: TEXT,
  },
  addButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: TEXT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonOff: { backgroundColor: '#262A26' },
  addButtonPressed: { transform: [{ scale: 0.94 }] },

  banner: {
    position: 'absolute',
    bottom: '100%',
    left: 16,
    right: 16,
    marginBottom: 12,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
  },
  bannerText: { fontFamily: DISPLAY, fontSize: 22, color: INK, textTransform: 'uppercase' },
});
