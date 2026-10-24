import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FAINT, networkColor } from '../theme';
import { TIER_NOTCHES } from '../services/taskEngine';

// ─────────────────────────────────────────────────────────────
// GLYPHS
// One drawn mark per brain network, so a block can be read at a
// glance without words or emoji. Each shape echoes how that network
// works: a lattice for rule-holding, a spiral for memory, lines of
// text for language, an uneven burst for ideas, overlapping minds for
// social, a stride for movement, a grid of repeats for habit and a
// breath for rest.
// ─────────────────────────────────────────────────────────────

const SHAPES = {
  EXECUTIVE: (c) => (
    <>
      <Path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" stroke={c} />
      <Path d="M7.25 7.25 16.75 16.75M16.75 7.25 7.25 16.75" stroke={c} />
    </>
  ),
  MEMORY: (c) => <Path d="M12 12.4c.9 0 1.4-.8 1.2-1.6-.3-1.3-2-1.6-3-.9-1.6 1-1.4 3.5.2 4.4 2.3 1.3 5-.3 5.4-2.8.5-3.2-2.4-5.6-5.4-5.1-4 .6-6 5-4.4 8.6 1.9 4.2 7.4 5.2 10.8 2.4" stroke={c} />,
  LANGUAGE: (c) => (
    <>
      <Path d="M3 7c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0" stroke={c} />
      <Path d="M3 12c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0" stroke={c} />
      <Path d="M3 17c2-1.6 3.5-1.6 5.5 0s3.5 1.6 4.5.8" stroke={c} />
    </>
  ),
  CREATIVE: (c) => (
    <>
      <Path d="M12 12 12 2M12 12 20.5 6.5M12 12 21 15M12 12 14.5 21.5M12 12 5 19M12 12 3 10.5M12 12 6.5 4" stroke={c} />
      <Circle cx={12} cy={12} r={1.6} fill={c} />
    </>
  ),
  SOCIAL: (c) => (
    <>
      <Circle cx={9} cy={12} r={6} stroke={c} />
      <Circle cx={15} cy={12} r={6} stroke={c} />
    </>
  ),
  MOTOR: (c) => <Path d="M2.5 16.5 7 8l4 8.5 4-8.5 4.5 8.5" stroke={c} />,
  ROUTINE: (c) => (
    <>
      {[6, 12, 18].flatMap((y) => [6, 12, 18].map((x) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.7} fill={c} />))}
    </>
  ),
  RECOVERY: (c) => (
    <>
      <Path d="M3 15a9 9 0 0 1 18 0" stroke={c} />
      <Path d="M7.5 15a4.5 4.5 0 0 1 9 0" stroke={c} />
      <Circle cx={12} cy={15} r={1.4} fill={c} />
    </>
  ),
};

export function NetworkGlyph({ network, size = 22, color, strokeWidth = 1.8 }) {
  const c = color ?? networkColor(network);
  const shape = SHAPES[network] ?? SHAPES.ROUTINE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {shape(c)}
    </Svg>
  );
}

// Priority as notches cut in a bar: three for high, two for medium,
// one for low.
export function Notches({ priority, color, height = 14 }) {
  if (!priority) return null;
  const filled = TIER_NOTCHES[priority] ?? 0;
  return (
    <View
      style={styles.notches}
      accessible
      accessibilityLabel={`${priority} priority`}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.notch,
            { height, backgroundColor: i < filled ? color : 'transparent', borderColor: i < filled ? color : FAINT },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notches: { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  notch: { width: 5, borderRadius: 1, borderWidth: 1, transform: [{ skewX: '-14deg' }] },
});
