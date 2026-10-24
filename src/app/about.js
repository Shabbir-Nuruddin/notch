import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { Mark } from '../../components/Mark';
import { Group, Row, Screen } from '../../components/ui';
import { SUPPORT_EMAIL } from '../../config';
import { type } from '../../theme';

const STEPS = [
  ['mic', 'You say what’s on', 'Once a day, at the time you choose.'],
  ['layers', 'Notch sorts it', 'Each task gets a priority and the kind of thinking it needs. Similar tasks are grouped.'],
  ['clock', 'Notch times it', 'Hard work goes in your sharpest hours, with breaks between sessions.'],
  ['bell', 'Notch runs it', 'An alarm rings when each task starts. On Android, chosen apps stay locked until it’s done.'],
];

const SOURCES = [
  ['Attention through the day', 'Valdez 2019; Schmidt et al. 2007'],
  ['Separate networks for language, people and reasoning', 'Fedorenko et al. 2011; Hauptman, Blank & Fedorenko 2022'],
  ['Creative thinking', 'Beaty et al. 2015, 2018'],
  ['Costs of switching tasks', 'Rubinstein, Meyer & Evans 2001; Leroy 2009'],
  ['Off-peak hours and insight', 'Wieth & Zacks 2011'],
  ['Mental fatigue', 'Wiehler et al. 2022; Hagger et al. 2016'],
  ['Breaks', 'Albulescu et al. 2022; Berman, Jonides & Kaplan 2008'],
  ['Exercise and focus', 'Chang et al. 2012'],
  ['Sleep and memory', 'Mazza et al. 2016'],
  ['If–then plans', 'Gollwitzer & Sheeran 2006'],
];

export default function About() {
  return (
    <Screen title="About">
      <View style={styles.hero}>
        <Mark size={72} />
        <Text style={type.large}>Notch</Text>
        <Text style={type.caption}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>

      <Group title="How it works">
        {STEPS.map(([icon, label, detail]) => (
          <Row key={label} icon={icon} label={label} detail={detail} />
        ))}
      </Group>

      <Group>
        <Row icon="activity" label="See today’s reasoning" onPress={() => router.push('/how')} />
      </Group>

      <Group title="Research behind the plan" footer="Notch turns these findings into scheduling rules. It gives general guidance, not medical advice, and can’t measure your brain.">
        {SOURCES.map(([topic, refs]) => (
          <Row key={topic} label={topic} detail={refs} />
        ))}
      </Group>

      <Group title="Legal">
        <Row icon="shield" label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        <Row icon="file-text" label="Terms of Use" onPress={() => router.push('/legal/terms')} />
        {SUPPORT_EMAIL ? <Row icon="mail" label="Contact" value={SUPPORT_EMAIL} /> : null}
      </Group>

    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingTop: 16 },
});
