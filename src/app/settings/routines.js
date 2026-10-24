import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Group, IconButton, Paragraph, Screen } from '../../../components/ui';
import { EVERY_DAY, WEEKDAYS, daysLabel } from '../../../services/routines';
import { useNotch } from '../../../state/notch';
import { FONT, LINE, MUTED, RAISED, SPECTRUM, TEXT, type } from '../../../theme';

// Repeating tasks. They're already on the list when you plan a day
// they fall on; nothing else carries over.
export default function Routines() {
  const { routines, saveRoutine, removeRoutine } = useNotch();
  const [draft, setDraft] = useState('');

  const add = () => {
    if (draft.trim()) saveRoutine(draft.trim(), EVERY_DAY);
    setDraft('');
  };

  return (
    <Screen title="Routines">
      <Paragraph style={{ marginTop: 8, marginBottom: 8 }}>
        Routines come back on their days when you plan. Everything else stays on the day you planned it. You can also say
        “every day” or “every Monday” when planning by voice.
      </Paragraph>

      <Group>
        {routines.map((r) => (
          <View key={r.id} style={styles.routine}>
            <View style={styles.head}>
              <Feather name="repeat" size={16} color={SPECTRUM[3]} />
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{r.title}</Text>
                <Text style={[type.caption, { color: SPECTRUM[3] }]}>{daysLabel(r.days)}</Text>
              </View>
              <IconButton name="trash-2" size={18} color={MUTED} label={`Delete ${r.title}`} onPress={() => removeRoutine(r.id)} />
            </View>
            <View style={styles.days}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = r.days.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      const next = on ? r.days.filter((x) => x !== d) : [...r.days, d];
                      if (next.length) saveRoutine(r.title, next);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${r.title} on ${WEEKDAYS[d]}`}
                    style={[styles.day, on && { backgroundColor: SPECTRUM[3], borderColor: SPECTRUM[3] }]}
                  >
                    <Text style={[type.caption, { fontWeight: '600', color: on ? '#000000' : TEXT }]}>{WEEKDAYS[d].slice(0, 2)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <View style={styles.inputRow}>
          <Feather name="plus" size={18} color={MUTED} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add a routine, e.g. Read for 20 min"
            placeholderTextColor={MUTED}
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel="Add a routine"
          />
          {draft.trim().length > 0 && <IconButton name="corner-down-left" size={18} label="Add routine" onPress={add} />}
        </View>
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  routine: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  days: { flexDirection: 'row', gap: 6, paddingLeft: 28 },
  day: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: RAISED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 4, minHeight: 52 },
  input: { flex: 1, fontFamily: FONT, fontSize: 17, color: TEXT, paddingVertical: 12, outlineStyle: 'none' },
});
