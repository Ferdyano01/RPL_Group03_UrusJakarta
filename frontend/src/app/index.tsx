import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BrutalShadow, Palette } from '@/constants/theme';
import { checkSystemHealth, getAuthToken } from '@/services/api';

const STEPS = [
  {
    num: '01',
    title: 'Foto Lokasi',
    desc: 'Unggah foto kerusakan jalan beserta titik alamat.',
  },
  {
    num: '02',
    title: 'Deteksi Otomatis',
    desc: 'Sistem memetakan lubang dan menyusun draf laporan.',
  },
  {
    num: '03',
    title: 'Pantau Progres',
    desc: 'Ikuti status penanganan dinas secara langsung.',
  },
];

export default function Index() {
  const [health, setHealth] = useState<{
    backendOnline: boolean;
    aiOnline: boolean;
    modelLoaded: boolean;
  } | null>(null);

  const hasSession = Boolean(getAuthToken());

  useEffect(() => {
    checkSystemHealth().then(setHealth);
  }, []);

  const handleStart = () => {
    if (getAuthToken()) {
      router.push('/beranda' as any);
    } else {
      router.push('/signup');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.wrapper}>
          {/* Masthead */}
          <View style={styles.masthead}>
            <View style={styles.brandGroup}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>UJ</Text>
              </View>
              <View>
                <Text style={styles.brandTitle}>UrusJakarta</Text>
                <Text style={styles.brandSub}>Pelaporan Infrastruktur Jalan DKI</Text>
              </View>
            </View>
            <View style={styles.cityTag}>
              <Text style={styles.cityTagText}>DKI JAKARTA</Text>
            </View>
          </View>

          {/* Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>PORTAL PENGADUAN WARGA</Text>
            </View>

            <Text style={styles.heroHeadline}>
              Laporkan jalan rusak lebih cepat, akurat, dan terpantau.
            </Text>

            <Text style={styles.heroCopy}>
              Ambil foto kondisi jalan di sekitar Anda. Sistem membantu mengenali tingkat kerusakan
              dan merapikan keterangan laporan sebelum diteruskan ke instansi terkait.
            </Text>

            <View style={styles.ctaGroup}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryBtn}
                onPress={handleStart}>
                <Text style={styles.primaryBtnText}>
                  {hasSession ? 'Buka Beranda Laporan' : 'Masuk atau Daftar Warga'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.secondaryBtn}
                onPress={() => router.push('/explore')}>
                <Text style={styles.secondaryBtnText}>Pelajari Alur & Klasifikasi</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3-Step Strip */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsHeading}>Cara Kerja Layanan</Text>
            <View style={styles.stepsList}>
              {STEPS.map((step, idx) => (
                <View
                  key={step.num}
                  style={[styles.stepRow, idx < STEPS.length - 1 && styles.stepRowBorder]}>
                  <View style={styles.stepNumBox}>
                    <Text style={styles.stepNumText}>{step.num}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* System Status Footer */}
          {health && (
            <View style={styles.statusBar}>
              <View style={styles.statusItem}>
                <View
                  style={[
                    styles.statusSquare,
                    { backgroundColor: health.backendOnline ? Palette.success : Palette.danger },
                  ]}
                />
                <Text style={styles.statusText}>
                  Server Layanan: {health.backendOnline ? 'Terhubung' : 'Tidak Terjangkau'}
                </Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <View
                  style={[
                    styles.statusSquare,
                    { backgroundColor: health.aiOnline ? Palette.success : Palette.yellow },
                  ]}
                />
                <Text style={styles.statusText}>
                  Deteksi Foto: {health.aiOnline ? 'Aktif' : 'Siaga'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
  },
  wrapper: {
    width: '100%',
    maxWidth: 520,
    gap: 16,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 40,
    height: 40,
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...BrutalShadow.sm,
  },
  logoMarkText: {
    color: Palette.accentText,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTitle: {
    color: Palette.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  brandSub: {
    color: Palette.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  cityTag: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cityTagText: {
    color: Palette.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heroCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 22,
    gap: 14,
    ...BrutalShadow.lg,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eyebrowText: {
    color: Palette.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heroHeadline: {
    color: Palette.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  heroCopy: {
    color: Palette.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  ctaGroup: {
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    ...BrutalShadow.md,
  },
  primaryBtnText: {
    color: Palette.accentText,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  stepsCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 16,
    gap: 10,
    ...BrutalShadow.md,
  },
  stepsHeading: {
    color: Palette.ink,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepsList: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  stepRowBorder: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
  },
  stepNumBox: {
    width: 32,
    height: 32,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: Palette.yellow,
    fontSize: 12,
    fontWeight: '900',
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    color: Palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  stepDesc: {
    color: Palette.inkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  statusBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusSquare: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: Palette.ink,
  },
  statusText: {
    color: Palette.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  statusDivider: {
    width: 1.5,
    height: 14,
    backgroundColor: '#D1D5DB',
  },
});
