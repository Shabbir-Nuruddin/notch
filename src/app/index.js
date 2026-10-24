import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';

import { DayDial } from '../../components/DayDial';
import { Mark } from '../../components/Mark';
import { Glow, ProgressRing, TaskChecklist } from '../../components/Progress';
import { BlockActions, NetworkTag, blockClock } from '../../components/NowPanel';
import { Group, IconButton, MAX_WIDTH, Row, Segmented } from '../../components/ui';
import { guardState } from '../../services/guard';
import { progressSummary } from '../../services/progress';
import { STATUS, blockEnd, clockLabel, currentBlock, dateKey, dayLabel, epochAt, isTask, isVerified, minutesNow } from '../../services/taskEngine';
import { useNotch, useNow } from '../../state/notch';
import { BG, FAINT, LINE, MUTED, SPECTRUM, SURFACE, TEXT, formatMinutes, networkColor, type } from '../../theme';

export default function Home() {
  const { loaded, profile } = useNotch();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: BG }} />;
  if (!profile.onboarded) return <Redirect href="/welcome" />;
  return <Today />;
}

function Today() {
  const { profile, plans, unlocks, history } = useNotch();
  const now = useNow(1000);
  const { width } = useWindowDimensions();
  const today = dateKey(0, new Date(now));
  const tomorrow = dateKey(1, new Date(now));

  // Open on tomorrow once today is finished and tomorrow is planned.
  const [day, setDay] = useState(() => {
    const t = plans[dateKey(0)];
    return (!t || !currentBlock(t)) && plans[dateKey(1)] ? 'tomorrow' : 'today';
  });
  const key = day === 'today' ? today : tomorrow;
  const plan = plans[key];
  const blocks = plan?.blocks ?? [];
  const current = day === 'today' ? currentBlock(plan) : null;
  const upNext = blocks.filter((b) => !isVerified(b) && b.id !== current?.id).slice(0, 5);
  const taskCount = blocks.filter(isTask).length;
  const tasksLeft = blocks.filter((b) => isTask(b) && !isVerified(b)).length;
  const { streak } = progressSummary(history, new Date(now));
  const guard = guardState({ plans, profile, unlocks, now });
  // Far enough behind that the rest of the day no longer fits as planned.
  const behind =
    current && current.status !== STATUS.IN_PROGRESS ? Math.floor((now - epochAt(key, current.start)) / 60000) : 0;
  const dialSize = Math.min(width - 32, 380);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Glow colors={current ? [networkColor(current.network), SPECTRUM[5]] : [SPECTRUM[4], SPECTRUM[5]]} opacity={0.28} />
      <View style={styles.header}>
        <View style={styles.brand}>
          <Mark size={26} />
          <Text style={type.title}>Notch</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <IconButton name="bar-chart-2" label="Your progress" onPress={() => router.push('/progress')} />
          <IconButton name="info" label="About Notch" onPress={() => router.push('/about')} />
          <IconButton name="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <Text style={[type.sub, { marginBottom: 12 }]}>{dayLabel(key)}</Text>
          <Segmented
            label="Day"
            value={day}
            onChange={setDay}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
            ]}
          />

          <View style={styles.dialWrap}>
            <DayDial
              blocks={blocks}
              profile={profile}
              nowMin={day === 'today' ? minutesNow(new Date(now)) : null}
              current={current}
              size={dialSize}
              planKey={plan?.createdAt}
            >
              <DialCenter day={day} plan={plan} current={current} dateKeyStr={key} now={now} tasksLeft={tasksLeft} />
            </DayDial>
          </View>

          {current && <BlockActions key={current.id} date={key} block={current} />}

          {day === 'today' && taskCount > 0 && (
            <ProgressCard done={taskCount - tasksLeft} total={taskCount} streak={streak} />
          )}

          {behind >= 45 && (
            <Pressable onPress={() => router.push('/plan?day=today')} style={styles.guard} accessibilityRole="button">
              <Feather name="refresh-cw" size={16} color={TEXT} />
              <Text style={[type.sub, { color: TEXT, flex: 1 }]}>
                {formatMinutes(behind)} behind. Replan from now to fit what’s left.
              </Text>
              <Feather name="chevron-right" size={18} color={MUTED} />
            </Pressable>
          )}

          {guard.active && (
            <Pressable onPress={() => router.push('/settings/blocking')} style={styles.guard} accessibilityRole="button">
              <Feather name="lock" size={16} color={TEXT} />
              <Text style={[type.sub, { color: TEXT, flex: 1 }]} numberOfLines={2}>
                {profile.blocking.apps.length === 1 ? profile.blocking.apps[0].label : `${profile.blocking.apps.length} apps`} blocked until “{guard.title}” is done
              </Text>
            </Pressable>
          )}

          {day === 'today' && taskCount > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={[type.caption, styles.sectionTitle]}>Tasks</Text>
              <TaskChecklist date={key} blocks={blocks} current={current} />
            </View>
          )}

          {day === 'tomorrow' && upNext.length > 0 && (
            <Group title="Planned">
              {upNext.map((b) => (
                <BlockRow key={b.id} block={b} />
              ))}
            </Group>
          )}

          {plan && (
            <Group>
              <Row icon="activity" label="Why this order" onPress={() => router.push(`/how?day=${key}`)} />
            </Group>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <Pressable
          onPress={() => router.push(`/plan?day=${day}`)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.planButton, pressed && { opacity: 0.85 }]}
        >
          <Feather name="mic" size={20} color="#000000" />
          <Text style={[type.headline, { color: '#000000' }]}>{plan ? `Replan ${day}` : `Plan ${day}`}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DialCenter({ day, plan, current, dateKeyStr, now, tasksLeft }) {
  if (!plan) {
    return (
      <View style={styles.center}>
        <Text style={[type.title, { textAlign: 'center' }]}>Nothing planned</Text>
      </View>
    );
  }
  if (day === 'tomorrow') {
    const first = plan.blocks.find(isTask);
    return (
      <View style={styles.center}>
        <Text style={[type.large, type.digits]}>{tasksLeft}</Text>
        <Text style={type.sub}>{tasksLeft === 1 ? 'task' : 'tasks'}</Text>
        {first && <Text style={[type.caption, { marginTop: 8 }]}>First at {clockLabel(first.start)}</Text>}
      </View>
    );
  }
  if (!current) {
    return (
      <View style={styles.center}>
        <Feather name="check-circle" size={34} color={TEXT} />
        <Text style={[type.title, { marginTop: 8 }]}>Day done</Text>
      </View>
    );
  }
  const clock = blockClock(current, dateKeyStr, now);
  return (
    <View style={styles.center}>
      <NetworkTag network={current.network} />
      <Text style={[type.title, styles.centerTitle]} numberOfLines={2}>
        {current.title}
      </Text>
      <Text style={[type.large, type.digits, { marginTop: 6 }]}>{clock.big}</Text>
      <Text style={type.caption}>{clock.small}</Text>
    </View>
  );
}

function ProgressCard({ done, total, streak }) {
  const value = total ? done / total : 0;
  const message =
    done === total ? 'Everything done. Great day.' : done === 0 ? 'First tick is the hardest.' : value >= 0.5 ? 'Over halfway. Keep going.' : 'Good start. Keep it rolling.';
  return (
    <Pressable
      onPress={() => router.push('/progress')}
      accessibilityRole="button"
      accessibilityLabel={`${done} of ${total} tasks done. See your progress`}
      style={({ pressed }) => [styles.progressCard, pressed && { opacity: 0.85 }]}
    >
      <ProgressRing value={value} size={92} stroke={10} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={type.headline}>
          {done} of {total} done
        </Text>
        <Text style={type.sub}>{message}</Text>
        {streak > 0 && (
          <View style={styles.streak}>
            <Feather name="zap" size={13} color={SPECTRUM[1]} />
            <Text style={[type.caption, { color: SPECTRUM[1] }]}>
              {streak} day{streak === 1 ? '' : 's'} in a row
            </Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={FAINT} />
    </Pressable>
  );
}

function BlockRow({ block }) {
  const color = networkColor(block.network);
  return (
    <View style={styles.blockRow}>
      <Text style={[type.sub, type.digits, { width: 50, color: MUTED }]}>{clockLabel(block.start)}</Text>
      <View style={[styles.bar, { backgroundColor: color, opacity: block.kind === 'break' ? 0.5 : 1 }]} />
      <Text style={[type.body, { flex: 1, color: block.kind === 'break' ? MUTED : TEXT }]} numberOfLines={1}>
        {block.title}
      </Text>
      <Text style={[type.caption, type.digits]}>{formatMinutes(blockEnd(block) - block.start)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 6,
    width: '100%',
    maxWidth: MAX_WIDTH + 16,
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scroll: { paddingHorizontal: 16, paddingBottom: 120 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  dialWrap: { alignItems: 'center', marginVertical: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  centerTitle: { textAlign: 'center', marginTop: 6 },
  guard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  sectionTitle: { marginBottom: 8, marginLeft: 16 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  bar: { width: 4, height: 24, borderRadius: 2 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FAINT,
  },
  planButton: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: TEXT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
