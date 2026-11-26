import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { MaxContentWidth, Palette } from '@/constants/theme';

export type NavTabKey = 'beranda' | 'lapor' | 'riwayat' | 'profil';

const NAV_ITEMS: { key: NavTabKey; label: string; route: string }[] = [
  { key: 'beranda', label: 'Beranda', route: '/beranda' },
  { key: 'lapor', label: 'Lapor', route: '/lapor' },
  { key: 'riwayat', label: 'Riwayat', route: '/riwayat' },
  { key: 'profil', label: 'Profil', route: '/profil' },
];

export function BottomNav({ active }: { active: NavTabKey }) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;

  return (
    <View style={[styles.outerWrap, bottomInset > 0 && { paddingBottom: bottomInset }]}>
      <View style={styles.bar}>
        {NAV_ITEMS.map((item, idx) => {
          const isActive = item.key === active;
          const isLast = idx === NAV_ITEMS.length - 1;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.82}
              style={[
                styles.item,
                !isLast && styles.itemBorderRight,
                isActive && styles.itemActive,
              ]}
              onPress={() => {
                if (!isActive) {
                  if (item.key === 'lapor') {
                    router.push(item.route as any);
                  } else {
                    router.replace(item.route as any);
                  }
                }
              }}>
              <View style={[styles.indicator, isActive && styles.indicatorActive]} />
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.surface,
    borderTopWidth: 2.5,
    borderTopColor: Palette.ink,
    alignItems: 'center',
    zIndex: 50,
    elevation: 12,
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    height: 62,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Palette.surface,
  },
  itemBorderRight: {
    borderRightWidth: 1.5,
    borderRightColor: Palette.ink,
  },
  itemActive: {
    backgroundColor: Palette.accent,
  },
  indicator: {
    width: 18,
    height: 3,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: Palette.ink,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: Palette.accentText,
    fontWeight: '900',
  },
});
