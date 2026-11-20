import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing } from '@/constants/theme';

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};

export function HintRow({ title = 'Info', hint = '-' }: HintRowProps) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.titleText}>{title}</Text>
      <View style={styles.codeSnippet}>
        <Text style={styles.hintText}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Palette.ink,
  },
  titleText: {
    color: Palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  codeSnippet: {
    backgroundColor: Palette.yellow,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    borderRadius: 0,
    paddingVertical: 3,
    paddingHorizontal: Spacing.two,
  },
  hintText: {
    color: Palette.ink,
    fontSize: 11,
    fontWeight: '800',
  },
});
