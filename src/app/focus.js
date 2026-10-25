import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { BlockActions, NetworkTag, blockClock } from '../../components/NowPanel';
import { Scenery } from '../../components/Scenery';
import { Button, IconButton, MAX_WIDTH } from '../../components/ui';
import { EMERGENCY_UNLOCK_MINUTES, guardState } from '../../services/guard';
import { STATUS, currentBlock, dateKey } from '../../services/taskEngine';
import { isTimed, timeLeftMs } from '../../services/verificationEngine';
import { useNotch, useNow } from '../../state/notch';
import { BG, LINE, SURFACE, TEXT, networkColor, type } from '../../theme';

// Where an alarm, or a blocked app, sends you.
export default function Focus() {
  const { blocked } = useLocalSearchParams();
  const { plans, profile, unlocks, unlocksLeft, emergencyUnlock } = useNotch();
  const now = useNow(1000);
  const { width } = useWindowDimensions();
  const key = dateKey(0, new Date(now));
  const block = currentBlock(plans[key]);
  const guard = guardState({ plans, profile, unlocks, now });
  const blockedApp = typeof blocked === 'string' ? profile.blocking.apps.find((a) => a.packageName === blocked)?.label ?? 'That app' : null;
  const size = Math.min(width - 64, 320);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Scenery />
      <View style={styles.top}>
        <IconButton name="chevron-down" label="Close" onPress={close} />
      </View>

      <View style={styles.column}>
        {blockedApp && guard.active && (
          <View style={styles.banner}>
            <Feather name="lock" size={18} color={TEXT} />
            <Text style={[type.sub, { color: TEXT, flex: 1 }]}>{blockedApp} is blocked until this is done.</Text>
          </View>
        )}

        {block ? (
          <>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <NetworkTag network={block.network} />
              <Text style={[type.large, { textAlign: 'center' }]} numberOfLines={3}>
                {block.title}
              </Text>
            </View>
            <ProgressRing block={block} date={key} now={now} size={size} />
            <BlockActions key={block.id} date={key} block={block} />
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 80 }}>
            <Feather name="check-circle" size={40} color={TEXT} />
            <Text style={type.large}>Nothing due</Text>
            <Button label="Back to today" kind="secondary" onPress={() => router.replace('/')} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          </View>
        )}

        {guard.active && (
          <Button
            label={unlocksLeft > 0 ? `Unlock apps for ${EMERGENCY_UNLOCK_MINUTES} min (${unlocksLeft} left today)` : 'No unlocks left today'}
            kind="secondary"
            icon="unlock"
            disabled={unlocksLeft === 0}
            onPress={emergencyUnlock}
          />
        )}
        {guard.pausedUntil && (
          <Text style={[type.caption, { textAlign: 'center' }]}>
            Apps unlocked for {Math.max(1, Math.ceil((guard.pausedUntil - now) / 60000))} more min
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function ProgressRing({ block, date, now, size }) {
  const color = networkColor(block.network);
  const stroke = 10;
  const r = size / 2 - stroke;
  const circumference = 2 * Math.PI * r;
  const running = block.status === STATUS.IN_PROGRESS;
  const total = block.estimatedMinutes * 60 * 1000;
  const progress = running && (block.kind === 'break' || isTimed(block.verificationType)) ? 1 - timeLeftMs(block, now) / total : running ? 1 : 0;
  const clock = blockClock(block, date, now);

  return (
    <View style={{ width: size, height: size, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={LINE} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[type.hero, type.digits, { fontSize: 52, lineHeight: 58 }]}>{clock.big}</Text>
      <Text style={type.sub}>{clock.small}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  top: { height: 52, paddingHorizontal: 8, justifyContent: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 24, gap: 24, justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: SURFACE },
});
