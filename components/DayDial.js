import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';
import { clockLabel, isVerified } from '../services/taskEngine';
import { FAINT, FONT, LINE, MUTED, TEXT, networkColor } from '../theme';
import { useReducedMotion } from './ui';

// ─────────────────────────────────────────────────────────────
// DAY DIAL
// The waking day as a 300° arc, wake at the lower left, sleep at the
// lower right, night in the gap at the bottom. Every block is an arc:
//   colour     = brain network
//   thickness  = how demanding it is (intensity 0–5)
//   brightness = done (dim), now (full), still to come (half)
// The needle is the current time. Whatever sits in the middle comes
// from `children`.
// ─────────────────────────────────────────────────────────────

const SWEEP = 300;
const GAP_DEG = 0.7; // space between neighbouring blocks

export function DayDial({ blocks = [], profile, nowMin = null, current = null, size = 340, planKey, children }) {
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(1));

  // The one orchestrated moment: a new plan winds onto the dial.
  useEffect(() => {
    if (reduced || !planKey) return;
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [planKey, reduced, spin]);

  const c = size / 2;
  const r = c - 38;
  const bedtime = profile.sleep > profile.wake ? profile.sleep : profile.sleep + 1440;
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const from = Math.min(profile.wake, first?.start ?? Infinity);
  const to = Math.max(bedtime, last ? last.start + last.estimatedMinutes : 0);
  const angle = (m) => -SWEEP / 2 + (SWEEP * (m - from)) / (to - from);

  const hours = [];
  for (let h = Math.ceil(from / 60); h * 60 <= to; h++) hours.push(h);

  const nowAngle = nowMin != null && nowMin >= from && nowMin <= to ? angle(nowMin) : null;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: spin,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) }],
          },
        ]}
      >
        <Svg width={size} height={size}>
          {/* Base track */}
          <Path d={arc(c, r, -SWEEP / 2, SWEEP / 2)} stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round" />

          {/* Hour ticks, labelled every three hours */}
          {hours.map((h) => {
            const a = angle(h * 60);
            const major = h % 3 === 0;
            const [x1, y1] = polar(c, r + 13, a);
            const [x2, y2] = polar(c, r + (major ? 20 : 16), a);
            const [lx, ly] = polar(c, r + 30, a);
            return (
              <G key={h}>
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? MUTED : FAINT} strokeWidth={major ? 1.6 : 1} strokeLinecap="round" />
                {major && (
                  <SvgText x={lx} y={ly + 4} fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight="600" textAnchor="middle">
                    {String(h % 24).padStart(2, '0')}
                  </SvgText>
                )}
              </G>
            );
          })}

          {/* Time already spent today */}
          {nowAngle != null && nowAngle > -SWEEP / 2 + 1 && (
            <Path d={arc(c, r - 17, -SWEEP / 2, nowAngle)} stroke={MUTED} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
          )}

          {/* Blocks */}
          {blocks.map((b) => {
            const a0 = angle(b.start) + GAP_DEG;
            const a1 = angle(b.start + b.estimatedMinutes) - GAP_DEG;
            if (a1 <= a0) return null;
            const color = networkColor(b.network);
            const isCurrent = current?.id === b.id;
            const opacity = isCurrent ? 1 : isVerified(b) ? 0.28 : 0.62;
            const isBreak = b.kind === 'break';
            return (
              <G key={b.id}>
                <Path
                  d={arc(c, r, a0, a1)}
                  stroke={color}
                  strokeWidth={isBreak ? 3 : 4 + b.intensity * 3}
                  strokeDasharray={isBreak ? '1 5' : undefined}
                  strokeLinecap={isBreak ? 'round' : 'butt'}
                  fill="none"
                  opacity={opacity}
                />
                {isCurrent && (
                  <Path d={arc(c, r + 14 - 4, a0, a1)} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
                )}
              </G>
            );
          })}

          {/* Now */}
          {nowAngle != null && <Needle c={c} r={r} a={nowAngle} />}

          {/* Night, in the gap */}
          <SvgText x={c} y={c + r * 0.93} fill={FAINT} fontSize={11} fontFamily={FONT} fontWeight="600" textAnchor="middle">
            {`Sleep ${clockLabel(profile.sleep)} to ${clockLabel(profile.wake)}`}
          </SvgText>
        </Svg>
      </Animated.View>

      <View style={[styles.center, { left: c - r * 0.72, top: c - r * 0.62, width: r * 1.44, height: r * 1.24 }]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

function Needle({ c, r, a }) {
  const [x1, y1] = polar(c, r - 22, a);
  const [x2, y2] = polar(c, r + 14, a);
  const [tx, ty] = polar(c, r + 22, a);
  const [lx, ly] = polar(c, r + 15, a - 3);
  const [rx, ry] = polar(c, r + 15, a + 3);
  return (
    <G>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={TEXT} strokeWidth={2.4} strokeLinecap="round" />
      <Path d={`M${tx} ${ty}L${lx} ${ly}L${rx} ${ry}Z`} fill={TEXT} />
    </G>
  );
}

// 0° is twelve o'clock, angles grow clockwise.
function polar(c, r, deg) {
  const t = (deg * Math.PI) / 180;
  return [c + r * Math.sin(t), c - r * Math.cos(t)];
}

function arc(c, r, a0, a1) {
  const [x0, y0] = polar(c, r, a0);
  const [x1, y1] = polar(c, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
