import {
  TabList,
  TabListProps,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
  Tabs,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrutalShadow, MaxContentWidth, Palette, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="beranda" href="/beranda" asChild>
            <TabButton>Beranda</TabButton>
          </TabTrigger>
          <TabTrigger name="lapor" href="/lapor" asChild>
            <TabButton>Lapor</TabButton>
          </TabTrigger>
          <TabTrigger name="riwayat" href="/riwayat" asChild>
            <TabButton>Riwayat</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Panduan</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButtonView, isFocused && styles.tabButtonActive]}>
        <Text style={[styles.tabButtonText, isFocused && styles.tabButtonTextActive]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandText}>UrusJakarta</Text>
        </View>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    ...BrutalShadow.md,
  },
  brandBadge: {
    marginRight: 'auto',
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brandText: {
    color: Palette.accentText,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
  },
  tabButtonView: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.canvas,
    borderRadius: 0,
  },
  tabButtonActive: {
    backgroundColor: Palette.yellow,
  },
  tabButtonText: {
    color: Palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: Palette.ink,
    fontWeight: '900',
  },
});
