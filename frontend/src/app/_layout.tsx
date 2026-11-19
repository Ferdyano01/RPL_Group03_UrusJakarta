import '@/global.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';
import { initAuthStorage } from '@/services/api';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initAuthStorage().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.canvas },
      }}
    />
  );
}
