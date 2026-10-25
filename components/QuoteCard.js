import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { quoteFor } from '../services/quotes';
import { LINE, MUTED, SPECTRUM, SURFACE, TEXT } from '../theme';
import { useDayProgress } from './Scenery';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

// A motivating line for where you are in the day. Tap for another.
export function QuoteCard({ style }) {
  const progress = useDayProgress();
  const [offset, setOffset] = useState(0);
  const quote = quoteFor(progress, offset);

  return (
    <Pressable
      onPress={() => setOffset((n) => n + 1)}
      accessibilityRole="button"
      accessibilityLabel={`${quote.text} ${quote.author}`}
      accessibilityHint="Shows another quote"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, style]}
    >
      <Text style={styles.mark} accessibilityElementsHidden importantForAccessibility="no">
        “
      </Text>
      <Text style={styles.text}>{quote.text}</Text>
      <View style={styles.foot}>
        <Text style={styles.author}>{quote.author}</Text>
        <Feather name="refresh-cw" size={14} color={MUTED} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  mark: { fontFamily: SERIF, fontSize: 44, lineHeight: 44, color: SPECTRUM[1], height: 30 },
  text: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, lineHeight: 28, color: TEXT },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  author: { fontSize: 14, color: MUTED },
});
