import { Text, View } from 'react-native';
import { SUPPORT_EMAIL } from '../config';
import { TEXT, type } from '../theme';
import { Screen } from './ui';

// sections: [[heading, [paragraph, ...]], ...]
export function LegalPage({ title, effective, sections }) {
  return (
    <Screen title={title}>
      <Text style={[type.caption, { marginTop: 8 }]}>Effective {effective}</Text>
      {sections.map(([heading, paragraphs]) => (
        <View key={heading} style={{ marginTop: 24, gap: 8 }}>
          <Text style={type.headline}>{heading}</Text>
          {paragraphs.map((p, i) => (
            <Text key={i} style={[type.body, { color: TEXT, opacity: 0.82 }]}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

export function contactLine() {
  return SUPPORT_EMAIL
    ? `Questions or requests: ${SUPPORT_EMAIL}.`
    : 'A contact address will be listed here before Notch is publicly released.';
}
