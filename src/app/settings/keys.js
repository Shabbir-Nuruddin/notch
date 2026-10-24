import { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Group, IconButton, Row, Screen } from '../../../components/ui';
import { envKeyCount, maskKey, parseKeys, testKeys } from '../../../services/gemini';
import { useNotch } from '../../../state/notch';
import { DANGER, FONT, MUTED, TEXT, type } from '../../../theme';

const STATUS_TEXT = {
  ok: 'Working',
  'rate-limited': 'Working, but rate-limited right now',
  'bad-key': 'Rejected by Google',
  'no-model': 'No Gemini model available to this key',
  'bad-request': 'Request rejected',
  unavailable: 'Couldn’t reach Google',
};

export default function Keys() {
  const { keys, setKeys } = useNotch();
  const [draft, setDraft] = useState('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const builtIn = envKeyCount();

  const add = () => {
    const fresh = parseKeys(draft).filter((k) => k.length > 20);
    if (fresh.length) setKeys([...new Set([...keys, ...fresh])]);
    setDraft('');
    setResults(null);
  };

  const test = async () => {
    setTesting(true);
    try {
      setResults(await testKeys());
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen title="AI planning">
      <Text style={[type.sub, { marginTop: 8 }]}>
        Notch plans with Google Gemini. Without a key it uses simple offline rules. Add one or more free keys; when one hits its limit, the next is used.
      </Text>

      <Group title="Your keys" footer={builtIn ? `Plus ${builtIn} built into this build.` : null}>
        {keys.map((k) => (
          <Row
            key={k}
            icon="key"
            label={maskKey(k)}
            right={<IconButton name="x" size={18} color={MUTED} label={`Remove key ending ${k.slice(-4)}`} onPress={() => setKeys(keys.filter((x) => x !== k))} />}
          />
        ))}
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Paste a key"
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
            accessibilityLabel="Gemini API key"
          />
          {draft.trim().length > 0 && <IconButton name="plus" label="Add key" onPress={add} />}
        </View>
      </Group>

      <View style={{ gap: 10, marginTop: 20 }}>
        <Button label="Test keys" kind="secondary" icon="zap" busy={testing} disabled={!keys.length && !builtIn} onPress={test} />
        <Button label="Get a free key" kind="secondary" icon="external-link" onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
      </View>

      {results && (
        <Group title="Results">
          {results.length === 0 ? (
            <Row label="No keys to test" />
          ) : (
            results.map((r, i) => (
              <Row key={i} label={r.key} detail={r.model ?? undefined} value={STATUS_TEXT[r.status] ?? r.status} />
            ))
          )}
        </Group>
      )}

      <Text style={[type.caption, { marginTop: 24 }]}>
        Keys are stored on this device and sent only to Google. On Gemini’s free tier, Google may use what you send to improve its products, so
        don’t plan anything confidential with a free key.
      </Text>
      {results?.some((r) => r.status === 'bad-key') && (
        <Text style={[type.caption, { color: DANGER, marginTop: 8 }]}>Remove rejected keys, or check they were copied in full.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  input: { flex: 1, fontFamily: FONT, fontSize: 17, color: TEXT, paddingVertical: 14, outlineStyle: 'none' },
});
