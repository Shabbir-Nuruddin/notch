import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { BrainMap } from '../../components/BrainMap';
import { EnergyChart, SwitchStrip } from '../../components/Charts';
import { NetworkTag } from '../../components/NowPanel';
import { Group, MAX_WIDTH, Row, Screen } from '../../components/ui';
import { WARMUP_MINUTES, dayInsight } from '../../services/insight';
import { clockLabel, dateKey, dayLabel } from '../../services/taskEngine';
import { useNotch } from '../../state/notch';
import { MUTED, SURFACE, TEXT, formatMinutes, type } from '../../theme';

export default function How() {
  const { day } = useLocalSearchParams();
  const { plans, profile } = useNotch();
  const { width } = useWindowDimensions();
  const [network, setNetwork] = useState(null);
  const [openWhy, setOpenWhy] = useState(false);

  const key = typeof day === 'string' && plans[day] ? day : dateKey(0);
  const plan = plans[key];
  const inner = Math.min(width - 32, MAX_WIDTH) - 32;

  if (!plan) {
    return (
      <Screen title="Why this order">
        <Text style={[type.sub, { textAlign: 'center', marginTop: 48 }]}>Plan a day first.</Text>
      </Screen>
    );
  }

  const insight = dayInsight(plan, profile);
  const peakPct = insight.peakShare == null ? null : Math.round(insight.peakShare * 100);

  return (
    <Screen title="Why this order">
      <Text style={[type.sub, { marginTop: 4 }]}>{dayLabel(key)}</Text>

      {/* Switching */}
      {insight.said && (
        <Card>
          <Stat big={insight.savedMinutes ? `~${insight.savedMinutes} min` : `${insight.notch.switches}`} small={insight.savedMinutes ? 'saved on switching' : 'brain switches'} />
          <Text style={type.sub}>Similar work is grouped, so your brain changes mode less often.</Text>
          <View style={{ gap: 18, marginTop: 8 }}>
            <SwitchStrip label="The order you said" order={insight.saidOrder} switches={insight.said.switches} width={inner} />
            <SwitchStrip label="Notch’s order" order={insight.notchOrder} switches={insight.notch.switches} width={inner} />
          </View>
          <Text style={[type.caption, { marginTop: 4 }]}>
            Estimate. Each switch is counted as about {WARMUP_MINUTES} min to get back up to speed; switches between related kinds of work count less.
          </Text>
        </Card>
      )}

      {/* Energy */}
      <Card>
        {peakPct != null && <Stat big={`${peakPct}%`} small="of demanding work in your sharpest hours" />}
        <Text style={type.sub}>The line is your typical attention through the day. Taller bars are harder tasks.</Text>
        <View style={{ marginTop: 8 }}>
          <EnergyChart blocks={plan.blocks} profile={profile} width={inner} />
        </View>
        <Legend />
      </Card>

      {/* Brain */}
      <Card>
        <Stat big={String(Object.keys(insight.byNetwork).filter((k) => k !== 'RECOVERY').length)} small="brain networks in use" />
        <Text style={type.sub}>Tap one to see its tasks.</Text>
        <View style={{ marginTop: 8 }}>
          <BrainMap byNetwork={insight.byNetwork} selected={network} onSelect={setNetwork} width={Math.min(inner, 360)} />
        </View>
      </Card>

      {/* Breaks */}
      <Card>
        <Stat big={formatMinutes(insight.breakMinutes)} small={`of breaks, ${insight.breaks.length} in total`} />
        <Text style={type.sub}>Short breaks between sessions let focus recover, so the next session starts sharp.</Text>
      </Card>

      {/* Each task */}
      <Group>
        <Row
          icon={openWhy ? 'chevron-down' : 'list'}
          label="Reasoning for each block"
          chevron={false}
          onPress={() => setOpenWhy((o) => !o)}
        />
        {openWhy &&
          plan.blocks.map((b) => (
            <View key={b.id} style={styles.why}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[type.caption, type.digits]}>{clockLabel(b.start)}</Text>
                <NetworkTag network={b.network} />
              </View>
              <Text style={type.headline}>{b.title}</Text>
              {b.why ? <Text style={type.sub}>{b.why}</Text> : null}
            </View>
          ))}
      </Group>

      <Pressable onPress={() => router.push('/about')} style={styles.footnote} accessibilityRole="link">
        <Text style={type.caption}>
          Based on published research on attention and task switching. General guidance, not medical advice. Sources in About.
        </Text>
        <Feather name="chevron-right" size={14} color={MUTED} />
      </Pressable>
    </Screen>
  );
}

function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

function Stat({ big, small }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[type.large, type.digits]}>{big}</Text>
      <Text style={[type.sub, { color: TEXT }]}>{small}</Text>
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: 'rgba(245,245,247,0.12)' }]} />
        <Text style={type.caption}>Peak hours</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { height: 2, backgroundColor: TEXT }]} />
        <Text style={type.caption}>Attention</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SURFACE, borderRadius: 18, padding: 16, gap: 6, marginTop: 16 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 10, borderRadius: 2 },
  why: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, paddingHorizontal: 4 },
});
