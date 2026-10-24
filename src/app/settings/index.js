import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { Group, Row, Screen, Segmented, TimeRow, ToggleRow } from '../../../components/ui';
import { guardAvailable } from '../../../modules/notch-guard';
import { notificationStatus, requestNotifications, testAlarm } from '../../../services/notify';
import { exportAll } from '../../../services/storage';
import { voiceAvailable } from '../../../services/voice';
import { useNotch } from '../../../state/notch';
import { FONT, MUTED, TEXT } from '../../../theme';

const PERMISSION = { granted: 'On', denied: 'Off', undetermined: 'Not set', unsupported: 'Not supported' };

export default function Settings() {
  const { profile, setProfile, keys, routines, resetAll } = useNotch();
  const [permission, setPermission] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    notificationStatus().then(setPermission).catch(() => setPermission('unsupported'));
  }, []);

  const patch = (group, values) => setProfile({ [group]: { ...profile[group], ...values } });

  const exportData = async () => {
    const json = JSON.stringify(await exportAll(), null, 2);
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notch-data.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ title: 'Notch data', message: json });
  };

  const deleteAll = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await resetAll();
    router.replace('/welcome');
  };

  const blockingValue = !guardAvailable
    ? Platform.OS === 'android'
      ? 'Needs the app build'
      : 'Android only'
    : profile.blocking.enabled
      ? `${profile.blocking.apps.length} apps`
      : 'Off';

  return (
    <Screen title="Settings">
      <Group title="Your day">
        <TimeRow label="Wake up" value={profile.wake} onChange={(wake) => setProfile({ wake })} />
        <TimeRow label="Sleep" value={profile.sleep} onChange={(sleep) => setProfile({ sleep })} />
        <View style={styles.pad}>
          <Segmented
            label="Sharpest in the"
            value={profile.chronotype}
            onChange={(chronotype) => setProfile({ chronotype })}
            options={[
              { value: 'morning', label: 'Morning' },
              { value: 'neither', label: 'Daytime' },
              { value: 'evening', label: 'Evening' },
            ]}
          />
        </View>
        <View style={styles.pad}>
          <TextInput
            value={profile.role}
            onChangeText={(role) => setProfile({ role })}
            placeholder="What you do, e.g. student, nurse, designer"
            placeholderTextColor={MUTED}
            style={styles.input}
            accessibilityLabel="What you do"
          />
        </View>
      </Group>

      <Group title="Daily planning">
        <View style={styles.pad}>
          <Segmented
            label="Planning time"
            value={profile.planning.mode}
            onChange={(mode) => patch('planning', { mode })}
            options={[
              { value: 'night', label: 'Night before' },
              { value: 'morning', label: 'Morning' },
            ]}
          />
        </View>
        <TimeRow label="Remind me at" value={profile.planning.minute} onChange={(minute) => patch('planning', { minute })} />
        <Row icon="repeat" label="Routines" value={routines.length ? String(routines.length) : 'None'} onPress={() => router.push('/settings/routines')} />
        <ToggleRow
          label="Spoken replies"
          detail={voiceAvailable() ? null : 'Voice input isn’t available here'}
          value={profile.voiceReplies}
          onChange={(voiceReplies) => setProfile({ voiceReplies })}
        />
      </Group>

      <Group title="Alarms">
        <Row
          label="Notifications"
          value={PERMISSION[permission] ?? ''}
          onPress={permission === 'undetermined' ? () => requestNotifications().then(setPermission) : undefined}
        />
        <ToggleRow label="Ring when a task starts" value={profile.alerts.atStart} onChange={(atStart) => patch('alerts', { atStart })} />
        <ToggleRow label="Heads-up 5 min before" value={profile.alerts.headsUp} onChange={(headsUp) => patch('alerts', { headsUp })} />
        <Row icon="bell" label="Test alarm" detail={Platform.OS === 'web' ? 'Rings now' : 'Rings in 5 seconds'} onPress={testAlarm} chevron={false} />
      </Group>

      <Group title="Focus">
        <Row icon="lock" label="App blocking" value={blockingValue} onPress={() => router.push('/settings/blocking')} />
        <Row icon="cpu" label="AI planning" value={keys.length ? `${keys.length} ${keys.length === 1 ? 'key' : 'keys'}` : 'Offline'} onPress={() => router.push('/settings/keys')} />
      </Group>

      <Group title="Your data" footer="Everything is stored on this device only.">
        <Row icon="download" label="Export my data" onPress={exportData} chevron={false} />
        <Row
          icon="trash-2"
          label={confirmDelete ? 'Tap again to delete everything' : 'Delete all data'}
          destructive
          onPress={deleteAll}
          chevron={false}
        />
      </Group>

      <Group title="About">
        <Row icon="info" label="About Notch" onPress={() => router.push('/about')} />
        <Row icon="activity" label="How planning works" onPress={() => router.push('/how')} />
        <Row icon="shield" label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        <Row icon="file-text" label="Terms of Use" onPress={() => router.push('/legal/terms')} />
        <Row label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 8 },
  input: { fontFamily: FONT, fontSize: 17, color: TEXT, paddingHorizontal: 8, paddingVertical: 10, outlineStyle: 'none' },
});
