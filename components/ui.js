import { Children, useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { clockLabel } from '../services/taskEngine';
import { BG, DANGER, FAINT, LINE, MUTED, RAISED, SURFACE, TEXT, type } from '../theme';

// ─────────────────────────────────────────────────────────────
// UI KIT
// Plain platform-style pieces: a screen with a nav bar, grouped
// rows like a settings app, buttons, a switch and a time stepper.
// ─────────────────────────────────────────────────────────────

export const MAX_WIDTH = 640;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => sub?.remove?.();
  }, []);
  return reduced;
}

// A scrolling screen with a back button and a title. `background`
// draws behind everything, e.g. a <Glow />.
export function Screen({ title, back = true, right, children, scroll = true, contentStyle, background }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.scroll, contentStyle]} keyboardShouldPersistTaps="handled">
      <View style={styles.column}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }, contentStyle]}>
      <View style={[styles.column, { flex: 1 }]}>{children}</View>
    </View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {background}
      {(title || back) && <NavBar title={title} back={back} right={right} />}
      {body}
    </SafeAreaView>
  );
}

export function NavBar({ title, back = true, right }) {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        {back && (
          <IconButton
            name="chevron-left"
            label="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        )}
      </View>
      <Text style={[type.headline, styles.navTitle]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.navSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function IconButton({ name, label, onPress, color = TEXT, size = 22, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: RAISED }, style]}
    >
      <Feather name={name} size={size} color={color} />
    </Pressable>
  );
}

// A section of rows on a rounded surface, with an optional heading
// above and a note below.
export function Group({ title, footer, children }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title && <Text style={[type.caption, styles.groupTitle]}>{title}</Text>}
      <View style={styles.groupBody}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 && <View style={styles.separator} />}
            {row}
          </View>
        ))}
      </View>
      {footer && <Text style={[type.caption, styles.groupFooter]}>{footer}</Text>}
    </View>
  );
}

export function Row({ icon, iconColor = TEXT, label, detail, value, onPress, right, chevron = !!onPress, destructive, disabled }) {
  const content = (
    <View style={[styles.row, disabled && { opacity: 0.4 }]}>
      {icon && (
        <View style={styles.rowIcon}>
          {typeof icon === 'string' ? <Feather name={icon} size={18} color={destructive ? DANGER : iconColor} /> : icon}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, destructive && { color: DANGER }]}>{label}</Text>
        {detail ? <Text style={type.caption}>{detail}</Text> : null}
      </View>
      {value != null && <Text style={[type.body, { color: MUTED }]}>{value}</Text>}
      {right}
      {chevron && <Feather name="chevron-right" size={18} color={FAINT} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && { backgroundColor: RAISED }}
    >
      {content}
    </Pressable>
  );
}

export function ToggleRow({ label, detail, value, onChange, disabled, icon }) {
  return (
    <Row
      icon={icon}
      label={label}
      detail={detail}
      disabled={disabled}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ false: LINE, true: '#34C759' }}
          thumbColor="#FFFFFF"
          {...{ activeThumbColor: '#FFFFFF' }}
        />
      }
    />
  );
}

// A time of day, moved in 15-minute steps.
export function TimeRow({ label, value, onChange, step = 15 }) {
  const move = (d) => onChange((Math.round(value) + d + 1440) % 1440);
  return (
    <Row
      label={label}
      right={
        <View style={styles.stepper}>
          <IconButton name="minus" label={`${label}, ${step} minutes earlier`} onPress={() => move(-step)} size={18} style={styles.stepBtn} />
          <Text style={[type.body, type.digits, styles.stepValue]} accessibilityLabel={`${label} ${clockLabel(value)}`}>
            {clockLabel(value)}
          </Text>
          <IconButton name="plus" label={`${label}, ${step} minutes later`} onPress={() => move(step)} size={18} style={styles.stepBtn} />
        </View>
      }
    />
  );
}

// A number stepper, e.g. emergency unlocks per day.
export function CountRow({ label, detail, value, min = 0, max = 5, onChange }) {
  return (
    <Row
      label={label}
      detail={detail}
      right={
        <View style={styles.stepper}>
          <IconButton name="minus" label={`Fewer ${label}`} onPress={() => onChange(Math.max(min, value - 1))} size={18} style={styles.stepBtn} />
          <Text style={[type.body, type.digits, styles.stepValue, { minWidth: 28 }]}>{value}</Text>
          <IconButton name="plus" label={`More ${label}`} onPress={() => onChange(Math.min(max, value + 1))} size={18} style={styles.stepBtn} />
        </View>
      }
    />
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentOn]}
          >
            <Text style={[type.sub, { fontWeight: '600', color: selected ? TEXT : MUTED }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// kind: 'primary' (white), 'secondary' (grey), 'destructive'
export function Button({ label, onPress, kind = 'primary', icon, busy, disabled, color, style }) {
  const fg = kind === 'primary' ? '#000000' : kind === 'destructive' ? DANGER : TEXT;
  const bg = color ?? (kind === 'primary' ? TEXT : RAISED);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <Text style={[type.headline, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Toast({ toast, onUndo }) {
  if (!toast) return null;
  return (
    <View style={styles.toastWrap} pointerEvents="box-none">
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <Text style={[type.sub, { color: TEXT, flex: 1 }]}>{toast.text}</Text>
        {toast.undo && (
          <Pressable onPress={onUndo} accessibilityRole="button" hitSlop={10}>
            <Text style={[type.sub, { color: TEXT, fontWeight: '600' }]}>Undo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Paragraph({ children, style }) {
  return <Text style={[type.body, { color: MUTED }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },

  nav: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  navSide: { width: 96 },
  navTitle: { flex: 1, textAlign: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  group: { marginTop: 28 },
  groupTitle: { marginLeft: 16, marginBottom: 8 },
  groupBody: { backgroundColor: SURFACE, borderRadius: 14, overflow: 'hidden' },
  groupFooter: { marginHorizontal: 16, marginTop: 8 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: LINE, marginLeft: 16 },

  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowIcon: { width: 28, alignItems: 'center' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: RAISED },
  stepValue: { minWidth: 58, textAlign: 'center' },

  segmented: { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 10, padding: 3 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentOn: { backgroundColor: RAISED },

  button: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 28, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: RAISED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
});
