import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Mark } from '../../components/Mark';
import { Button, Group, IconButton, MAX_WIDTH, Row, Segmented, TimeRow, ToggleRow } from '../../components/ui';
import { guardAvailable } from '../../modules/notch-guard';
import { requestNotifications } from '../../services/notify';
import { useNotch } from '../../state/notch';
import { BG, FAINT, TEXT, type } from '../../theme';

const STEPS = ['intro', 'day', 'planning', 'alarms', ...(guardAvailable ? ['blocking'] : []), 'terms'];

export default function Welcome() {
  const { profile, setProfile } = useNotch();
  const [step, setStep] = useState(0);
  const [alarms, setAlarms] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const name = STEPS[step];
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const finish = (then = '/') => {
    setProfile({ onboarded: true, acceptedTermsAt: Date.now() });
    router.replace(then);
  };

  const allowAlarms = async () => {
    const status = await requestNotifications();
    setAlarms(status);
    if (status === 'granted') next();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View style={{ width: 44 }}>{step > 0 && <IconButton name="chevron-left" label="Back" onPress={() => setStep((s) => s - 1)} />}</View>
        <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i <= step && { backgroundColor: TEXT }]} />
          ))}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        {name === 'intro' && (
          <View style={styles.intro}>
            <Mark size={96} />
            <Text style={[type.hero, { marginTop: 24 }]}>Notch</Text>
            <Text style={[type.title, { color: FAINT, textAlign: 'center', fontWeight: '500' }]}>Say what’s on.{'\n'}It runs your day.</Text>
          </View>
        )}

        {name === 'day' && (
          <>
            <Heading title="Your day" />
            <Group>
              <TimeRow label="Wake up" value={profile.wake} onChange={(wake) => setProfile({ wake })} />
              <TimeRow label="Sleep" value={profile.sleep} onChange={(sleep) => setProfile({ sleep })} />
            </Group>
            <Group title="Sharpest in the">
              <View style={{ padding: 8 }}>
                <Segmented
                  label="Chronotype"
                  value={profile.chronotype}
                  onChange={(chronotype) => setProfile({ chronotype })}
                  options={[
                    { value: 'morning', label: 'Morning' },
                    { value: 'neither', label: 'Daytime' },
                    { value: 'evening', label: 'Evening' },
                  ]}
                />
              </View>
            </Group>
          </>
        )}

        {name === 'planning' && (
          <>
            <Heading title="When should Notch ask?" detail="Once a day it asks what’s on, and you tell it out loud." />
            <Group>
              <View style={{ padding: 8 }}>
                <Segmented
                  label="Planning time"
                  value={profile.planning.mode}
                  onChange={(mode) => setProfile({ planning: { mode, minute: mode === 'night' ? 21 * 60 + 30 : profile.wake + 15 } })}
                  options={[
                    { value: 'night', label: 'The night before' },
                    { value: 'morning', label: 'In the morning' },
                  ]}
                />
              </View>
              <TimeRow label="At" value={profile.planning.minute} onChange={(minute) => setProfile({ planning: { ...profile.planning, minute } })} />
            </Group>
          </>
        )}

        {name === 'alarms' && (
          <>
            <Heading
              title="Alarms"
              detail={
                Platform.OS === 'web'
                  ? 'In a browser, Notch can only ring while this tab is open. The phone app rings even when closed.'
                  : 'Notch rings when each task starts, even with the app closed.'
              }
            />
            {alarms === 'denied' && (
              <Text style={[type.sub, { marginTop: 16 }]}>Alarms are off. You can turn them on later in your phone’s settings.</Text>
            )}
          </>
        )}

        {name === 'blocking' && (
          <Heading title="Block distracting apps" detail="Pick apps that stay locked until the current task is done. You can do this now or later in Settings." />
        )}

        {name === 'terms' && (
          <>
            <Heading title="Before you start" />
            <Group footer="Notch gives general planning guidance based on published research. It isn’t medical advice.">
              <Row icon="shield" label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
              <Row icon="file-text" label="Terms of Use" onPress={() => router.push('/legal/terms')} />
            </Group>
            <Group>
              <ToggleRow label="I agree to the Terms and Privacy Policy" value={agreed} onChange={setAgreed} />
            </Group>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {name === 'intro' && <Button label="Get started" onPress={next} />}
        {(name === 'day' || name === 'planning') && <Button label="Continue" onPress={next} />}
        {name === 'alarms' && (
          <>
            <Button label="Allow alarms" icon="bell" onPress={allowAlarms} />
            <Button label="Not now" kind="secondary" onPress={next} />
          </>
        )}
        {name === 'blocking' && (
          <>
            <Button label="Continue" onPress={next} />
          </>
        )}
        {name === 'terms' && (
          <>
            <Button label="Start" disabled={!agreed} onPress={() => finish('/')} />
            {guardAvailable && <Button label="Start and choose apps to block" kind="secondary" disabled={!agreed} onPress={() => finish('/settings/blocking')} />}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Heading({ title, detail }) {
  return (
    <View style={{ gap: 8, marginTop: 24 }}>
      <Text style={type.large}>{title}</Text>
      {detail && <Text style={type.sub}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FAINT },
  body: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16 },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  footer: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
});
