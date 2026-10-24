import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Glow, ProgressRing, TrendBars } from '../../components/Progress';
import { Screen } from '../../components/ui';
import { dayStats, progressSummary } from '../../services/progress';
import { dateKey } from '../../services/taskEngine';
import { useNotch } from '../../state/notch';
import { LINE, MUTED, SPECTRUM, SUCCESS, SURFACE, TEXT, formatMinutes, type } from '../../theme';

// How today is going, the last two weeks, and whether finishing
// things has gone up since the person started.
export default function Progress() {
  const { plans, history } = useNotch();
  const today = dayStats(plans[dateKey(0)]);
  const summary = progressSummary(history);
  const value = today.tasks ? today.done / today.tasks : 0;

  return (
    <Screen title="Progress" background={<Glow colors={[SPECTRUM[0], SPECTRUM[3], SPECTRUM[5]]} opacity={0.3} height={420} />}>
      <View style={styles.hero}>
        <ProgressRing value={value} size={200} stroke={18} label={`Today ${Math.round(value * 100)} percent done`}>
          <Text style={[type.hero, type.digits, { fontSize: 48, lineHeight: 54 }]}>{Math.round(value * 100)}%</Text>
          <Text style={type.sub}>{today.tasks ? `${today.done} of ${today.tasks} today` : 'nothing planned today'}</Text>
        </ProgressRing>
      </View>

      <ChangeCard summary={summary} />

      <View style={styles.tiles}>
        <Tile
          icon="zap"
          color={SPECTRUM[1]}
          big={String(summary.streak)}
          small={summary.streak === 1 ? 'day streak' : 'days streak'}
        />
        <Tile icon="check-circle" color={SUCCESS} big={String(summary.totalDone)} small="tasks done" />
        <Tile icon="clock" color={SPECTRUM[4]} big={formatMinutes(summary.totalMinutes)} small="of focused work" />
        <Tile
          icon="calendar"
          color={SPECTRUM[5]}
          big={String(summary.daysTracked)}
          small={summary.daysTracked === 1 ? 'day planned' : 'days planned'}
        />
      </View>

      <View style={styles.card}>
        <Text style={[type.headline, { marginBottom: 4 }]}>Last 14 days</Text>
        <Text style={[type.caption, { marginBottom: 16 }]}>Bar height is the share of that day’s tasks you finished.</Text>
        <TrendBars days={summary.recent} />
      </View>
    </Screen>
  );
}

function ChangeCard({ summary }) {
  const { change, daysTracked, latestRate } = summary;
  let big;
  let text;
  let color = TEXT;
  if (change == null) {
    big = latestRate == null ? '—' : `${Math.round(latestRate * 100)}%`;
    text =
      daysTracked === 0
        ? 'Plan a day and tick things off. Your progress shows up here.'
        : `Finished so far. After ${8 - daysTracked} more planned day${8 - daysTracked === 1 ? '' : 's'} you’ll see how much you’ve improved since your first week.`;
  } else if (change > 0) {
    big = `+${change}%`;
    color = SUCCESS;
    text = 'More of your plan gets done now than in your first week with Notch.';
  } else if (change === 0) {
    big = '±0%';
    text = 'Same share of your plan done as in your first week. Steady.';
  } else {
    big = `${change}%`;
    color = SPECTRUM[1];
    text = 'A bit less than your first week. Try fewer tasks a day so more of them get done.';
  }
  return (
    <View style={[styles.card, styles.change]}>
      <Text style={[type.hero, type.digits, { color }]}>{big}</Text>
      <Text style={[type.sub, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

function Tile({ icon, color, big, small }) {
  return (
    <View style={styles.tile}>
      <Feather name={icon} size={18} color={color} />
      <Text style={[type.title, type.digits, { marginTop: 8 }]} numberOfLines={1} adjustsFontSizeToFit>
        {big}
      </Text>
      <Text style={[type.caption, { color: MUTED }]}>{small}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 24 },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  change: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
});
