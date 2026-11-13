import '@/global.css';

import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.canvas },
      }}
    />
  );
}
