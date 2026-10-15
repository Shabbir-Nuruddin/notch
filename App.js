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

// ─────────────────────────────────────────────────────────────
// 1. PRIORITY TIERS
// Order matters: a tier can only open once every tier listed
// before it is finished.
// ─────────────────────────────────────────────────────────────
const TIERS = ['high', 'medium', 'low'];

const TIER_INFO = {
  high: { label: 'High', color: '#E5484D' },
  medium: { label: 'Medium', color: '#D98A00' },
  low: { label: 'Low', color: '#3E63DD' },
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

// The short line under a locked tier, e.g. "Finish 2 High tasks first".
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

// ─────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────
export default function App() {
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
      const message = `${TIER_INFO[opened].label} unlocked`;
      setBanner({ message, key: Date.now() });
      AccessibilityInfo.announceForAccessibility(message);
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

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.frame}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Header doneCount={doneCount} total={tasks.length} />

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {tasks.length === 0 ? (
              <EmptyState />
            ) : (
              TIERS.map((tier) => (
                <TierSection
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
            {banner && <UnlockBanner key={banner.key} message={banner.message} />}
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

function Header({ doneCount, total }) {
  const progress = total === 0 ? 0 : doneCount / total;
  return (
    <View style={styles.header}>
      <Text style={styles.date}>{todayLabel()}</Text>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.count}>
          {doneCount} of {total} done
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing on today yet</Text>
      <Text style={styles.emptyText}>
        Add your most important task first and mark it High. Medium and Low tasks stay locked
        until every High task is done.
      </Text>
    </View>
  );
}

function TierSection({ tier, tasks, unlocked, hint, onToggle }) {
  const info = TIER_INFO[tier];

  // Fade the tasks in and give the header a small bump
  // when the tier unlocks.
  const fade = useRef(new Animated.Value(unlocked ? 1 : 0.45)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const wasUnlocked = useRef(unlocked);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: unlocked ? 1 : 0.45,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (unlocked && !wasUnlocked.current) {
      bump.setValue(0.9);
      Animated.spring(bump, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
    wasUnlocked.current = unlocked;
  }, [unlocked]);

  return (
    <View style={styles.section}>
      <Animated.View style={[styles.sectionHead, { transform: [{ scale: bump }] }]}>
        <View style={[styles.dot, { backgroundColor: unlocked ? info.color : '#9AA0A8' }]} />
        <Text style={styles.sectionTitle}>{info.label}</Text>
        <Feather
          name={unlocked ? 'unlock' : 'lock'}
          size={14}
          color={unlocked ? '#6B7079' : '#15171C'}
          style={styles.lockIcon}
        />
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </Animated.View>

      <Animated.View style={{ opacity: fade }}>
        {tasks.length === 0 ? (
          <Text style={styles.none}>No {info.label.toLowerCase()} tasks</Text>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              color={info.color}
              locked={!unlocked}
              onToggle={() => onToggle(task.id)}
            />
          ))
        )}
      </Animated.View>
    </View>
  );
}

function TaskRow({ task, color, locked, onToggle }) {
  const pop = useRef(new Animated.Value(1)).current;

  function handlePress() {
    // Small pop on the check circle when a task is completed.
    if (!task.done) {
      pop.setValue(0.6);
      Animated.spring(pop, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
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
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Animated.View
        style={[
          styles.check,
          { borderColor: locked ? '#C4C8CE' : color, transform: [{ scale: pop }] },
          task.done && { backgroundColor: locked ? '#C4C8CE' : color },
        ]}
      >
        {task.done ? (
          <Feather name="check" size={15} color="#FFFFFF" />
        ) : locked ? (
          <Feather name="lock" size={12} color="#9AA0A8" />
        ) : null}
      </Animated.View>
      <Text
        style={[styles.taskTitle, task.done && styles.taskDone, locked && styles.taskLocked]}
      >
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
      <View style={styles.pills}>
        {TIERS.map((tier) => {
          const selected = tier === priority;
          return (
            <Pressable
              key={tier}
              onPress={() => setPriority(tier)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${TIER_INFO[tier].label} priority`}
              style={[
                styles.pill,
                selected && { backgroundColor: TIER_INFO[tier].color, borderColor: TIER_INFO[tier].color },
              ]}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {TIER_INFO[tier].label}
              </Text>
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
          placeholderTextColor="#8A9099"
          returnKeyType="done"
          blurOnSubmit={false}
          style={styles.input}
          accessibilityLabel="New task"
        />
        <Pressable
          onPress={submit}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          style={[styles.addButton, !canAdd && styles.addButtonOff]}
        >
          <Feather name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function UnlockBanner({ message }) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(slide, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(1400),
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <Feather name="unlock" size={16} color="#FFFFFF" />
      <Text style={styles.bannerText}>{message}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const INK = '#15171C';
const MUTED = '#6B7079';
const LINE = '#E2E4E8';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1F2F4' },
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  date: { fontSize: 14, color: MUTED, fontWeight: '500' },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 36, fontWeight: '800', color: INK, letterSpacing: -1 },
  count: { fontSize: 14, color: MUTED, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: LINE, marginTop: 12, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: INK },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  empty: { paddingHorizontal: 4, paddingTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyText: { fontSize: 15, lineHeight: 22, color: MUTED, maxWidth: 360 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 6,
    marginTop: 12,
    borderWidth: 1,
    borderColor: LINE,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: INK, letterSpacing: 0.4, textTransform: 'uppercase' },
  lockIcon: { marginLeft: 6 },
  hint: { fontSize: 13, color: INK, marginLeft: 8 },
  none: { fontSize: 14, color: '#9AA0A8', paddingHorizontal: 14, paddingVertical: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowPressed: { backgroundColor: '#F6F7F8' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskTitle: { flex: 1, fontSize: 16, lineHeight: 22, color: INK },
  taskDone: { color: '#9AA0A8', textDecorationLine: 'line-through' },
  taskLocked: { color: '#9AA0A8' },

  composer: {
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    justifyContent: 'center',
  },
  pillText: { fontSize: 14, fontWeight: '600', color: MUTED },
  pillTextSelected: { color: '#FFFFFF' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F1F2F4',
    paddingHorizontal: 14,
    fontSize: 16,
    color: INK,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonOff: { backgroundColor: '#B8BCC3' },

  banner: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 12,
    zIndex: 1,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: INK,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  bannerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
