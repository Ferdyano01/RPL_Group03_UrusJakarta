import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrutalShadow, Palette, Spacing } from '@/constants/theme';

export function Collapsible({
  children,
  title,
  tag,
  defaultOpen = false,
}: PropsWithChildren & { title: string; tag?: string; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={() => setIsOpen((value) => !value)}>
        <View style={styles.headingLeft}>
          {tag ? (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
          <Text style={styles.titleText}>{title}</Text>
        </View>

        <View style={[styles.toggleBox, isOpen && styles.toggleBoxActive]}>
          <Text style={[styles.toggleText, isOpen && styles.toggleTextActive]}>
            {isOpen ? '-' : '+'}
          </Text>
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: 0,
    ...BrutalShadow.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    backgroundColor: Palette.surface,
  },
  pressedHeading: {
    backgroundColor: Palette.highlight,
  },
  headingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tagBadge: {
    backgroundColor: Palette.yellow,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    color: Palette.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  titleText: {
    flex: 1,
    color: Palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  toggleBox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxActive: {
    backgroundColor: Palette.accent,
  },
  toggleText: {
    color: Palette.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 17,
  },
  toggleTextActive: {
    color: Palette.accentText,
  },
  content: {
    borderTopWidth: 2,
    borderTopColor: Palette.ink,
    backgroundColor: Palette.highlight,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
