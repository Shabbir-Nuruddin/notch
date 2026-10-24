import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { NETWORKS, TASK_NETWORK_KEYS } from '../services/brainScience';
import { FAINT, LINE, MUTED, RAISED, SURFACE, TEXT, alpha, formatMinutes, networkColor, type } from '../theme';

// ─────────────────────────────────────────────────────────────
// BRAIN MAP
// A side view of the brain (front to the left). Each network lights
// up where its main regions sit, sized by how many minutes of the day
// it gets. Tap a network to see which tasks use it.
// Positions are approximate and for orientation only.
// ─────────────────────────────────────────────────────────────

const CEREBRUM =
  'M28 84C22 52 52 18 100 16C146 14 178 38 182 70C185 92 172 104 156 106C148 118 128 122 112 116C100 124 76 124 62 114C44 112 31 100 28 84Z';

// [x, y, r] in the 200 × 140 drawing.
const REGIONS = {
  EXECUTIVE: [[56, 50, 15], [136, 42, 12]],
  MEMORY: [[110, 100, 10]],
  LANGUAGE: [[64, 90, 9], [142, 86, 9]],
  CREATIVE: [[36, 70, 9], [158, 56, 9]],
  SOCIAL: [[166, 84, 9], [40, 84, 7]],
  MOTOR: [[100, 26, 10], [150, 116, 11]],
  ROUTINE: [[90, 70, 9]],
};

export function BrainMap({ byNetwork = {}, selected, onSelect, width = 320 }) {
  const height = (width * 140) / 200;
  const max = Math.max(1, ...TASK_NETWORK_KEYS.map((k) => byNetwork[k]?.minutes ?? 0));
  const used = TASK_NETWORK_KEYS.filter((k) => (byNetwork[k]?.minutes ?? 0) > 0);

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.canvas}>
        <Svg width={width} height={height} viewBox="0 0 200 140" accessibilityLabel="Brain regions used by today's plan">
          {/* Outline */}
          <Ellipse cx={150} cy={116} rx={22} ry={13} fill={SURFACE} stroke={LINE} strokeWidth={1.2} />
          <Path d="M118 116C120 126 122 132 124 138" stroke={LINE} strokeWidth={7} strokeLinecap="round" fill="none" />
          <Path d={CEREBRUM} fill={SURFACE} stroke={LINE} strokeWidth={1.4} />
          {/* Central and lateral fissures */}
          <Path d="M104 17C100 34 96 50 98 64" stroke={LINE} strokeWidth={1} fill="none" />
          <Path d="M60 92C84 82 110 80 138 84" stroke={LINE} strokeWidth={1} fill="none" />

          {TASK_NETWORK_KEYS.map((key) => {
            const minutes = byNetwork[key]?.minutes ?? 0;
            const on = minutes > 0;
            const focus = !selected || selected === key;
            const scale = on ? 0.75 + 0.5 * (minutes / max) : 0.6;
            const color = networkColor(key);
            return (
              <G key={key} opacity={focus ? 1 : 0.25}>
                {REGIONS[key].map(([x, y, r], i) => (
                  <G key={i}>
                    {on && <Circle cx={x} cy={y} r={r * scale * 1.6} fill={alpha(color, 0.18)} />}
                    <Circle
                      cx={x}
                      cy={y}
                      r={r * scale}
                      fill={on ? color : 'none'}
                      stroke={on ? color : FAINT}
                      strokeWidth={on ? 0 : 1}
                      strokeDasharray={on ? undefined : '2 2'}
                      opacity={on ? 0.9 : 0.8}
                    />
                  </G>
                ))}
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.chips}>
        {used.map((key) => {
          const on = selected === key;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect?.(on ? null : key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && { backgroundColor: RAISED, borderColor: networkColor(key) }]}
            >
              <View style={[styles.dot, { backgroundColor: networkColor(key) }]} />
              <Text style={[type.sub, { color: TEXT }]}>{NETWORKS[key].label}</Text>
              <Text style={[type.caption, type.digits, { color: MUTED }]}>{formatMinutes(byNetwork[key].minutes)}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected && byNetwork[selected] && (
        <View style={styles.detail}>
          <Text style={type.headline}>{NETWORKS[selected].system}</Text>
          <Text style={type.caption}>{NETWORKS[selected].regions}</Text>
          <Text style={[type.sub, { marginTop: 6 }]}>{NETWORKS[selected].does}</Text>
          {byNetwork[selected].titles.length > 0 && (
            <View style={{ marginTop: 10, gap: 4 }}>
              {byNetwork[selected].titles.map((t, i) => (
                <Text key={i} style={[type.sub, { color: TEXT }]}>
                  {t}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  detail: { backgroundColor: SURFACE, borderRadius: 14, padding: 16 },
});
