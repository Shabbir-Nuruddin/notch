import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NETWORKS } from '../services/brainScience';
import { STATUS, clockLabel, epochAt, hasNextTask } from '../services/taskEngine';
import { isTimed, timeLeftMs } from '../services/verificationEngine';
import { useNotch } from '../state/notch';
import { RAISED, SURFACE, TEXT, formatClock, formatMinutes, networkColor, type } from '../theme';
import { Button } from './ui';

// ─────────────────────────────────────────────────────────────
// NOW
// What the current block needs from the person: the clock, one main
// action (Start or Done) and Shift. Shared by the home and focus
// screens.
// ─────────────────────────────────────────────────────────────

// → { big, small } for the clock in the middle of the dial.
export function blockClock(block, date, now) {
  if (block.status === STATUS.IN_PROGRESS) {
    if (block.kind === 'break' || isTimed(block.verificationType)) {
      return { big: formatClock(timeLeftMs(block, now)), small: 'left' };
    }
    return { big: formatClock(now - block.startedAt), small: 'so far' };
  }
  const until = epochAt(date, block.start) - now;
  if (until > 60 * 60 * 1000) return { big: clockLabel(block.start), small: 'starts at' };
  if (until > 0) return { big: formatClock(until), small: 'until it starts' };
  const late = Math.floor(-until / 60000);
  return { big: 'Now', small: late >= 2 ? `${formatMinutes(late)} late` : 'time to start' };
}

export function NetworkTag({ network }) {
  return (
    <View style={styles.tag}>
      <View style={[styles.dot, { backgroundColor: networkColor(network) }]} />
      <Text style={[type.caption, { color: networkColor(network) }]}>{NETWORKS[network]?.label}</Text>
    </View>
  );
}

export function BlockActions({ date, block, isToday = true }) {
  const { start, done, later, afterNext, toTomorrow, plans } = useNotch();
  const [shifting, setShifting] = useState(false);
  const running = block.status === STATUS.IN_PROGRESS;
  const isBreak = block.kind === 'break';
  const canSwap = hasNextTask(plans[date]?.blocks ?? [], block.id);

  const shift = (fn) => {
    setShifting(false);
    fn();
  };

  return (
    <View style={{ gap: 10, width: '100%' }}>
      <View style={styles.actions}>
        {isToday &&
          (running ? (
            <Button label={isBreak ? 'End break' : 'Done'} icon="check" onPress={() => done(date, block)} style={{ flex: 1 }} />
          ) : (
            <Button label={isBreak ? 'Start break' : 'Start'} icon="play" onPress={() => start(date, block)} style={{ flex: 1 }} />
          ))}
        <Button
          label="Shift"
          icon={shifting ? 'x' : 'clock'}
          kind="secondary"
          onPress={() => setShifting((s) => !s)}
          style={{ flex: isToday ? 0 : 1, minWidth: 116 }}
        />
      </View>

      {shifting && (
        <View style={styles.shiftGrid}>
          <ShiftOption icon="rotate-cw" label="15 min later" onPress={() => shift(() => later(date, block, 15))} />
          <ShiftOption icon="clock" label="1 hour later" onPress={() => shift(() => later(date, block, 60))} />
          {canSwap && <ShiftOption icon="repeat" label="After the next task" onPress={() => shift(() => afterNext(date, block))} />}
          {isBreak ? (
            <ShiftOption icon="skip-forward" label="Skip break" onPress={() => shift(() => done(date, block))} />
          ) : (
            <ShiftOption icon="calendar" label="Another day" onPress={() => shift(() => toTomorrow(date, block))} />
          )}
        </View>
      )}
    </View>
  );
}

function ShiftOption({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.shiftOption, pressed && { backgroundColor: RAISED }]}
    >
      <Feather name={icon} size={16} color={TEXT} />
      <Text style={[type.sub, { color: TEXT }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  shiftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shiftOption: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
  },
});
