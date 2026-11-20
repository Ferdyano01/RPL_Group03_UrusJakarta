import '@/global.css';

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';

import { Palette } from '@/constants/theme';
import { initAuthStorage } from '@/services/api';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'UrusJakarta — Pelaporan Jalan Rusak DKI',
  '/beranda': 'Beranda — UrusJakarta',
  '/lapor': 'Lapor Jalan Rusak — UrusJakarta',
  '/riwayat': 'Riwayat Laporan — UrusJakarta',
  '/profil': 'Profil Akun — UrusJakarta',
  '/signup': 'Masuk / Daftar — UrusJakarta',
  '/explore': 'Panduan Sistem — UrusJakarta',
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const pageTitle = ROUTE_TITLES[pathname] || 'UrusJakarta — Pelaporan Jalan Rusak DKI';

  useEffect(() => {
    initAuthStorage().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = pageTitle;
    }
  }, [pageTitle]);

  if (!ready) return null;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Palette.canvas },
        }}
      />
    </>
  );
}
