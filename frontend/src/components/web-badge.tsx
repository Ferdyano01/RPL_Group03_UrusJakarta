import { StyleSheet, Text, View } from 'react-native';

import { BrutalShadow, Palette, Spacing } from '@/constants/theme';

export function WebBadge() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.brandText}>UrusJakarta</Text>
        <View style={styles.divider} />
        <Text style={styles.tagText}>Portal Pelaporan Warga DKI</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...BrutalShadow.sm,
  },
  brandText: {
    color: Palette.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  divider: {
    width: 1.5,
    height: 12,
    backgroundColor: Palette.ink,
  },
  tagText: {
    color: Palette.ink,
    fontSize: 11,
    fontWeight: '700',
  },
});
