import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button, CountRow, Group, Row, Screen, ToggleRow } from '../../../components/ui';
import { getLaunchableApps, guardAvailable, isServiceEnabled, openServiceSettings } from '../../../modules/notch-guard';
import { EMERGENCY_UNLOCK_MINUTES } from '../../../services/guard';
import { useNotch } from '../../../state/notch';
import { FONT, LINE, MUTED, RAISED, SURFACE, TEXT, type } from '../../../theme';

const SUGGESTED = new Set(['game', 'social', 'video']);

export default function Blocking() {
  if (!guardAvailable) return <Unavailable />;
  return <BlockingSettings />;
}

function Unavailable() {
  return (
    <Screen title="App blocking">
      <View style={styles.notice}>
        <Feather name="smartphone" size={28} color={TEXT} />
        <Text style={type.title}>{Platform.OS === 'android' ? 'Needs the Notch app' : 'Android only'}</Text>
        <Text style={type.sub}>
          {Platform.OS === 'android'
            ? 'Blocking uses a part of Notch that Expo Go doesn’t include. Install the Notch APK to use it.'
            : Platform.OS === 'ios'
              ? 'iPhone doesn’t let apps block other apps without Apple’s Screen Time approval, which Notch doesn’t have yet. Alarms still work.'
              : 'A website can’t control other apps. Install Notch on an Android phone to block apps.'}
        </Text>
      </View>
    </Screen>
  );
}

function BlockingSettings() {
  const { profile, setProfile } = useNotch();
  const blocking = profile.blocking;
  const [serviceOn, setServiceOn] = useState(() => isServiceEnabled());
  const [apps, setApps] = useState(null);
  const [query, setQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const patch = useCallback((values) => setProfile({ blocking: { ...blocking, ...values } }), [blocking, setProfile]);

  // Coming back from Android's settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setServiceOn(isServiceEnabled()));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getLaunchableApps()
      .then(setApps)
      .catch(() => setApps([]));
  }, []);

  const chosen = new Set(blocking.apps.map((a) => a.packageName));
  const toggle = (app) => {
    const list = chosen.has(app.packageName)
      ? blocking.apps.filter((a) => a.packageName !== app.packageName)
      : [...blocking.apps, { packageName: app.packageName, label: app.label }];
    patch({ apps: list });
  };
  const chooseSuggested = () => {
    const extra = (apps ?? []).filter((a) => SUGGESTED.has(a.category) && !chosen.has(a.packageName));
    patch({ apps: [...blocking.apps, ...extra.map(({ packageName, label }) => ({ packageName, label }))] });
  };

  const q = query.trim().toLowerCase();
  const visible = (apps ?? []).filter((a) => !q || a.label.toLowerCase().includes(q));

  return (
    <Screen title="App blocking">
      {!serviceOn ? (
        <View style={styles.disclosure}>
          <Feather name="lock" size={26} color={TEXT} />
          <Text style={type.title}>Allow Notch to block apps</Text>
          <Text style={type.sub}>
            Notch uses Android’s Accessibility service to see which app is open. When it’s one of the apps you choose and a task is due,
            Notch brings you back to the task.
          </Text>
          <Text style={type.sub}>
            It only reads the name of the app in front. It doesn’t read your screen, what you type or your messages, and nothing leaves
            your phone. You can turn it off any time in Android’s settings.
          </Text>
          <Button label="Agree and open settings" onPress={openServiceSettings} style={{ marginTop: 8 }} />
          <Pressable onPress={() => setShowHelp((h) => !h)} accessibilityRole="button" style={styles.help}>
            <Text style={[type.sub, { color: TEXT }]}>Notch is greyed out in the list?</Text>
            <Feather name={showHelp ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
          </Pressable>
          {showHelp && (
            <Text style={type.sub}>
              Android 13 and later restrict apps installed from an APK. Open Settings › Apps › Notch, tap ⋮ (top right), choose “Allow
              restricted settings”, then come back and try again.
            </Text>
          )}
        </View>
      ) : (
        <Group>
          <Row icon="check-circle" iconColor="#4CD97B" label="Blocking service" value="On" onPress={openServiceSettings} />
        </Group>
      )}

      <Group footer={blocking.holdUntilDone ? 'Apps stay locked from a task’s start time until you mark it done, or until bedtime.' : 'Apps are locked only during each task’s planned time.'}>
        <ToggleRow label="Block apps during tasks" value={blocking.enabled} onChange={(enabled) => patch({ enabled })} disabled={!serviceOn} />
        <ToggleRow label="Keep blocked until done" value={blocking.holdUntilDone} onChange={(holdUntilDone) => patch({ holdUntilDone })} />
        <CountRow
          label="Emergency unlocks"
          detail={`${EMERGENCY_UNLOCK_MINUTES} minutes each, per day`}
          value={blocking.unlocksPerDay}
          min={0}
          max={5}
          onChange={(unlocksPerDay) => patch({ unlocksPerDay })}
        />
      </Group>

      <Group title={`Apps to block${blocking.apps.length ? ` (${blocking.apps.length})` : ''}`}>
        <View style={styles.search}>
          <Feather name="search" size={16} color={MUTED} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={MUTED}
            style={styles.input}
            accessibilityLabel="Search apps"
          />
        </View>
        {apps && apps.some((a) => SUGGESTED.has(a.category) && !chosen.has(a.packageName)) && !q && (
          <Row icon="zap" label="Add all games, social and video apps" onPress={chooseSuggested} chevron={false} />
        )}
        {apps === null ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator color={TEXT} />
          </View>
        ) : (
          visible.map((app) => {
            const on = chosen.has(app.packageName);
            return (
              <Pressable
                key={app.packageName}
                onPress={() => toggle(app)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={app.label}
                style={({ pressed }) => [styles.app, pressed && { backgroundColor: RAISED }]}
              >
                {app.icon ? <Image source={{ uri: app.icon }} style={styles.icon} /> : <View style={[styles.icon, { backgroundColor: RAISED }]} />}
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  {app.label}
                </Text>
                <View style={[styles.check, on && styles.checkOn]}>{on && <Feather name="check" size={14} color="#000000" />}</View>
              </Pressable>
            );
          })
        )}
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginTop: 24, gap: 10, padding: 20, borderRadius: 18, backgroundColor: SURFACE },
  disclosure: { marginTop: 16, gap: 12, padding: 20, borderRadius: 18, backgroundColor: SURFACE },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  input: { flex: 1, fontFamily: FONT, fontSize: 17, color: TEXT, paddingVertical: 12, outlineStyle: 'none' },
  app: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  icon: { width: 32, height: 32, borderRadius: 8 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: TEXT, borderColor: TEXT },
});
