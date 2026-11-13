import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { BrutalShadow, Palette } from '@/constants/theme';
import { loginUserApi, registerUserApi } from '@/services/api';

export default function SignUp() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = params.mode === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (params.mode === 'signup' || params.mode === 'login') {
      setMode(params.mode);
    }
  }, [params.mode]);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setErrorMsg('Nama lengkap wajib diisi untuk pendaftaran.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await registerUserApi({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          phone_number: phoneNumber.trim() || undefined,
        });
      }
      await loginUserApi({
        email: email.trim(),
        password,
      });
      router.replace('/beranda');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (target: 'login' | 'signup') => {
    if (target === mode) return;
    setErrorMsg(null);
    setMode(target);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.wrapper}>
          {/* Top Brand Strip */}
          <View style={styles.topRow}>
            <View style={styles.brandGroup}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>UJ</Text>
              </View>
              <Text style={styles.brandName}>UrusJakarta</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.backLink}
              onPress={() => router.push('/')}>
              <Text style={styles.backLinkText}>Halaman Awal</Text>
            </TouchableOpacity>
          </View>

          {/* Main Auth Card */}
          <View style={styles.card}>
            {/* Segmented Switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
                onPress={() => switchMode('login')}>
                <Text style={[styles.tabBtnText, mode === 'login' && styles.tabBtnTextActive]}>
                  Masuk
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.tabBtn, mode === 'signup' && styles.tabBtnActive]}
                onPress={() => switchMode('signup')}>
                <Text style={[styles.tabBtnText, mode === 'signup' && styles.tabBtnTextActive]}>
                  Daftar Baru
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>
              {mode === 'signup' ? 'Daftar Akun Warga' : 'Masuk ke Portal'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signup'
                ? 'Daftarkan akun Anda untuk mulai membuat dan memantau laporan kerusakan jalan.'
                : 'Gunakan email dan kata sandi yang sudah terdaftar untuk melanjutkan pelaporan.'}
            </Text>

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorTitle}>Perhatian</Text>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nama Lengkap</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Masukkan nama lengkap Anda"
                  placeholderTextColor={Palette.inkSubtle}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Alamat Email</Text>
              <TextInput
                style={styles.input}
                placeholder="nama@email.com"
                placeholderTextColor={Palette.inkSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {mode === 'signup' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nomor Telepon (Opsional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="08xxxxxxxxxx"
                  placeholderTextColor={Palette.inkSubtle}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Kata Sandi</Text>
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                  <Text style={styles.togglePwdText}>
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Minimal 8 karakter"
                placeholderTextColor={Palette.inkSubtle}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={Palette.accentText} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'signup' ? 'Daftar dan Masuk' : 'Masuk Sekarang'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
  },
  wrapper: {
    width: '100%',
    maxWidth: 460,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 32,
    height: 32,
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: Palette.accentText,
    fontSize: 12,
    fontWeight: '900',
  },
  brandName: {
    color: Palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  backLink: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLinkText: {
    color: Palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 20,
    ...BrutalShadow.lg,
  },
  tabRow: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: Palette.ink,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Palette.canvas,
  },
  tabBtnActive: {
    backgroundColor: Palette.ink,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.ink,
  },
  tabBtnTextActive: {
    color: Palette.surface,
    fontWeight: '900',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Palette.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: Palette.inkMuted,
    marginBottom: 18,
  },
  errorBanner: {
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    marginBottom: 16,
    gap: 2,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: Palette.ink,
    letterSpacing: 0.6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
    marginBottom: 6,
  },
  togglePwdText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.accent,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: Palette.ink,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    ...BrutalShadow.md,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: Palette.accentText,
    fontSize: 15,
    fontWeight: '900',
  },
});
