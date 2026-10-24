import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { STATUS, clockLabel, isTask, isVerified } from '../services/taskEngine';
import { useNotch } from '../state/notch';
import { BG, FAINT, LINE, MUTED, NATIVE, SPECTRUM, SUCCESS, SURFACE, TEXT, alpha, formatMinutes, networkColor, type } from '../theme';
import { useReducedMotion } from './ui';

// ─────────────────────────────────────────────────────────────
// PROGRESS PIECES
// Ring, glow, checklist and trend bars. Finishing a task should feel
// like something: the box ticks, a line strikes through, the task
// sinks to the bottom and the ring fills a little more.
// ─────────────────────────────────────────────────────────────

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// SVG gradient ids are global on the web, and stacked screens stay
// mounted, so every gradient gets its own.
function useSvgId(prefix) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

// A soft colour light behind a screen's top area.
export function Glow({ colors = [SPECTRUM[5], SPECTRUM[4]], height = 360, opacity = 0.35 }) {
  const id = useSvgId('glow');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          {colors.map((c, i) => (
            <RadialGradient key={i} id={`${id}-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c} stopOpacity={opacity} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {colors.map((c, i) => {
          const x = colors.length === 1 ? 50 : 20 + (60 * i) / (colors.length - 1);
          return <Rect key={i} x={x - 55} y={-45} width={110} height={110} fill={`url(#${id}-${i})`} />;
        })}
      </Svg>
    </View>
  );
}

// Fraction 0–1 as a ring in the spectrum colours, with the percentage
// in the middle. Fills smoothly when the value changes.
export function ProgressRing({ value = 0, size = 120, stroke = 12, label, children }) {
  const reduced = useReducedMotion();
  const id = useSvgId('ring');
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const [fill] = useState(() => new Animated.Value(reduced ? value : 0));

  useEffect(() => {
    Animated.timing(fill, {
      toValue: value,
      duration: reduced ? 0 : 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, reduced, fill]);

  const pct = Math.round(value * 100);
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `${pct} percent done`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {SPECTRUM.map((c, i) => (
              <Stop key={c} offset={i / (SPECTRUM.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={LINE} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={fill.interpolate({ inputRange: [0, 1], outputRange: [length, 0] })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ?? (
        <Text style={[type.title, type.digits, { fontSize: size * 0.24, lineHeight: size * 0.3 }]}>{pct}%</Text>
      )}
    </View>
  );
}

// A thin bar version, for rows and the plan screen.
export function ProgressBar({ value = 0, height = 8 }) {
  const id = useSvgId('bar');
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: LINE, overflow: 'hidden' }}>
      <Svg width={`${Math.max(0, Math.min(1, value)) * 100}%`} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            {SPECTRUM.map((c, i) => (
              <Stop key={c} offset={i / (SPECTRUM.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} rx={height / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// Every task of the day. Still to do on top in plan order, done ones
// ticked, struck through and moved to the bottom. Only the current
// task can be ticked here (Notch runs one thing at a time); the rest
// show a lock.
export function TaskChecklist({ date, blocks, current, interactive = true }) {
  const { done } = useNotch();
  const tasks = blocks.filter(isTask);
  const open = tasks.filter((b) => !isVerified(b));
  const finished = tasks.filter(isVerified).sort((a, b) => (a.verifiedAt ?? 0) - (b.verifiedAt ?? 0));

  const tick = (block) => {
    if (NATIVE) LayoutAnimation.configureNext(LayoutAnimation.create(320, 'easeInEaseOut', 'opacity'));
    done(date, block);
  };

  return (
    <View style={styles.list}>
      {[...open, ...finished].map((b, i) => (
        <CheckRow
          key={b.id}
          block={b}
          first={i === 0}
          isCurrent={b.id === current?.id}
          canTick={interactive && b.id === current?.id}
          onTick={() => tick(b)}
        />
      ))}
    </View>
  );
}

function CheckRow({ block, first, isCurrent, canTick, onTick }) {
  const reduced = useReducedMotion();
  const isDone = isVerified(block);
  const color = networkColor(block.network);
  const wasDone = useRef(isDone);
  const [strike] = useState(() => new Animated.Value(isDone ? 1 : 0));
  const [pop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (isDone && !wasDone.current && !reduced) {
      strike.setValue(0);
      pop.setValue(0.6);
      Animated.parallel([
        Animated.timing(strike, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: NATIVE }),
      ]).start();
    } else {
      strike.setValue(isDone ? 1 : 0);
    }
    wasDone.current = isDone;
  }, [isDone, reduced, strike, pop]);

  const box = (
    <Animated.View
      style={[
        styles.box,
        isDone ? { backgroundColor: SUCCESS, borderColor: SUCCESS } : { borderColor: isCurrent ? color : FAINT },
        { transform: [{ scale: pop }] },
      ]}
    >
      {isDone ? (
        <Feather name="check" size={16} color={BG} />
      ) : !isCurrent ? (
        <Feather name="lock" size={11} color={FAINT} />
      ) : null}
    </Animated.View>
  );

  return (
    <View style={[styles.row, !first && styles.rowLine, isCurrent && { backgroundColor: alpha(color, 0.1) }]}>
      {canTick ? (
        <Pressable onPress={onTick} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Mark ${block.title} done`}>
          {box}
        </Pressable>
      ) : (
        <View accessibilityRole="checkbox" accessibilityState={{ checked: isDone, disabled: true }} accessibilityLabel={block.title}>
          {box}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
          <Text style={[type.body, isDone && { color: MUTED }]} numberOfLines={1}>
            {block.title}
          </Text>
          <Animated.View
            pointerEvents="none"
            style={[styles.strike, { width: strike.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
        <Text style={[type.caption, { color: isDone ? FAINT : MUTED }]}>
          {isDone ? 'Done' : `${clockLabel(block.start)} · ${formatMinutes(block.estimatedMinutes)}`}
          {isCurrent && !isDone ? (block.status === STATUS.IN_PROGRESS ? ' · running' : ' · up now') : ''}
        </Text>
      </View>
      <View style={[styles.tagDot, { backgroundColor: color, opacity: isDone ? 0.35 : 1 }]} />
    </View>
  );
}

// The last 14 days as bars: height = share of tasks done.
export function TrendBars({ days, height = 120 }) {
  const today = days[days.length - 1]?.date;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: height + 22 }}>
      {days.map((d, i) => {
        const h = d.rate == null ? 4 : Math.max(6, d.rate * height);
        const weekday = new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'narrow' });
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }} accessibilityLabel={d.rate == null ? `${d.date}: nothing planned` : `${d.date}: ${d.done} of ${d.tasks} done`}>
            <View
              style={{
                width: '100%',
                height: h,
                borderRadius: 4,
                backgroundColor: d.rate == null ? LINE : SPECTRUM[Math.min(SPECTRUM.length - 1, Math.floor((i / days.length) * SPECTRUM.length))],
                opacity: d.rate == null ? 1 : 0.35 + d.rate * 0.65,
              }}
            />
            <Text style={[type.caption, { fontSize: 11, lineHeight: 14, color: d.date === today ? TEXT : FAINT }]}>{weekday}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: SURFACE, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16, paddingVertical: 8 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  strike: { position: 'absolute', left: 0, top: '50%', height: 2, marginTop: -1, borderRadius: 1, backgroundColor: MUTED },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
});
