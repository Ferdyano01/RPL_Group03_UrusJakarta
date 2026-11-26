import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { BottomNav } from '@/components/bottom-nav';
import { BrutalShadow, MaxContentWidth, Palette } from '@/constants/theme';
import {
  UserProfile,
  clearAuthSession,
  fetchMyProfile,
  getAuthToken,
  getCurrentUser,
  isAuthSessionError,
  subscribeAuthChange,
  updateMyProfile,
} from '@/services/api';

function getInitials(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UJ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Profil() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserProfile | null>(() =>
    getAuthToken() ? getCurrentUser() : null
  );
  const isAuthenticated = Boolean(getAuthToken() && user);

  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');

  const [showContactInfo, setShowContactInfo] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    return subscribeAuthChange((authenticated) => {
      if (!authenticated) {
        setUser(null);
        setEditingProfile(false);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!getAuthToken()) {
        setUser(null);
        return;
      }
      const current = getCurrentUser();
      setUser(current);
      if (current) {
        setFullName(current.full_name || '');
        setPhoneNumber(current.phone_number || '');
      }
      fetchMyProfile()
        .then((profile) => {
          setUser(profile);
          setFullName(profile.full_name || '');
          setPhoneNumber(profile.phone_number || '');
        })
        .catch((err) => {
          if (isAuthSessionError(err)) {
            setUser(null);
            setEditingProfile(false);
            setFeedback({ type: 'err', text: err.message });
          }
        });
    }, [])
  );

  const handleSaveProfile = async () => {
    setFeedback(null);
    try {
      const updated = await updateMyProfile({
        full_name: fullName,
        phone_number: phoneNumber,
      });
      setUser(updated);
      setEditingProfile(false);
      setFeedback({ type: 'ok', text: 'Data profil Anda berhasil diperbarui.' });
    } catch (err: any) {
      if (isAuthSessionError(err)) {
        setUser(null);
        setEditingProfile(false);
      }
      setFeedback({ type: 'err', text: err.message || 'Gagal memperbarui profil.' });
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    router.replace('/signup?mode=login' as any);
  };

  const roleLabel =
    (user?.role || 'citizen').toLowerCase() === 'citizen'
      ? 'Warga Pelapor'
      : (user?.role || 'Petugas').toUpperCase();

  const bottomPadding = 92 + (Platform.OS === 'web' ? 0 : insets.bottom);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>AKUN & PREFERENSI</Text>
              <Text style={styles.headerTitle}>Profil Pengguna</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.guideBtn}
              onPress={() => router.push('/explore')}>
              <Text style={styles.guideBtnText}>Panduan Sistem</Text>
            </TouchableOpacity>
          </View>

          {/* Profile Card vs Guest Card */}
          {isAuthenticated && user ? (
            <View style={styles.profileCard}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitials}>{getInitials(user.full_name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.nameText}>{user.full_name}</Text>
                <Text style={styles.metaText}>{user.email}</Text>
                {user.phone_number ? (
                  <Text style={styles.metaText}>Telp: {user.phone_number}</Text>
                ) : null}
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.guestCard}>
              <Text style={styles.guestTitle}>Belum Masuk Akun</Text>
              <Text style={styles.guestDesc}>
                Daftar atau masuk menggunakan akun Anda untuk mengelola profil dan mengirim laporan
                kerusakan jalan.
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.panelBtn, { backgroundColor: Palette.accent }]}
                  onPress={() => router.push('/signup?mode=signup' as any)}>
                  <Text style={[styles.panelBtnText, { color: Palette.accentText }]}>
                    Daftar Baru
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.panelBtn, { backgroundColor: Palette.surface }]}
                  onPress={() => router.push('/signup?mode=login' as any)}>
                  <Text style={styles.panelBtnText}>Masuk</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {feedback && (
            <View
              style={[
                styles.feedbackBanner,
                {
                  backgroundColor:
                    feedback.type === 'ok' ? Palette.success : Palette.danger,
                },
              ]}>
              <Text style={styles.feedbackTitle}>
                {feedback.type === 'ok' ? 'Berhasil' : 'Perhatian'}
              </Text>
              <Text style={styles.feedbackText}>{feedback.text}</Text>
            </View>
          )}

          {/* Action Menu Stack */}
          <View style={styles.menuStack}>
            {isAuthenticated && (
              <View style={styles.accordionCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.menuHeader}
                  onPress={() => setEditingProfile((v) => !v)}>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Ubah Data Profil</Text>
                    <Text style={styles.menuSub}>Perbarui nama lengkap dan nomor telepon</Text>
                  </View>
                  <View style={[styles.stateChip, editingProfile && styles.stateChipActive]}>
                    <Text
                      style={[styles.stateChipText, editingProfile && styles.stateChipTextActive]}>
                      {editingProfile ? 'Tutup' : 'Edit'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {editingProfile && (
                  <View style={styles.panelBody}>
                    <Text style={styles.inputLabel}>Nama Lengkap</Text>
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Nama Lengkap"
                      placeholderTextColor={Palette.inkSubtle}
                    />
                    <Text style={styles.inputLabel}>Nomor Telepon</Text>
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="08xxxxxxxxxx"
                      placeholderTextColor={Palette.inkSubtle}
                      keyboardType="phone-pad"
                    />
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.panelBtn, { backgroundColor: Palette.success }]}
                        onPress={handleSaveProfile}>
                        <Text style={styles.panelBtnText}>Simpan Perubahan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.panelBtn, { backgroundColor: Palette.surface }]}
                        onPress={() => setEditingProfile(false)}>
                        <Text style={styles.panelBtnText}>Batal</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Info Dinas & Kontak */}
            <View style={styles.accordionCard}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.menuHeader}
                onPress={() => setShowContactInfo((v) => !v)}>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuTitle}>Informasi Layanan & Instansi</Text>
                  <Text style={styles.menuSub}>Kontak resmi Dinas Bina Marga DKI Jakarta</Text>
                </View>
                <View style={[styles.stateChip, showContactInfo && styles.stateChipActive]}>
                  <Text
                    style={[
                      styles.stateChipText,
                      showContactInfo && styles.stateChipTextActive,
                    ]}>
                    {showContactInfo ? 'Tutup' : 'Lihat'}
                  </Text>
                </View>
              </TouchableOpacity>

              {showContactInfo && (
                <View style={styles.panelBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Instansi Tujuan</Text>
                    <Text style={styles.infoVal}>Dinas Bina Marga Provinsi DKI Jakarta</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Email Resmi</Text>
                    <Text style={styles.infoVal}>binamarga@jakarta.go.id</Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <Text style={styles.infoKey}>Tim Pengembang</Text>
                    <Text style={styles.infoVal}>Kelompok 03 RPL — FT Universitas Indonesia</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {isAuthenticated && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.logoutBtn}
              onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Keluar dari Akun</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav active="profil" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 92,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Palette.accent,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Palette.ink,
  },
  guideBtn: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...BrutalShadow.sm,
  },
  guideBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  profileCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...BrutalShadow.lg,
  },
  avatarBox: {
    width: 68,
    height: 68,
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '900',
    color: Palette.accentText,
    letterSpacing: 1,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '900',
    color: Palette.ink,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: Palette.yellow,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
  },
  guestCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 18,
    gap: 10,
    ...BrutalShadow.lg,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Palette.ink,
  },
  guestDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: Palette.inkMuted,
  },
  feedbackBanner: {
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    gap: 2,
  },
  feedbackTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: Palette.ink,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  menuStack: {
    gap: 12,
  },
  accordionCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    ...BrutalShadow.md,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  menuCopy: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Palette.ink,
  },
  menuSub: {
    fontSize: 12,
    color: Palette.inkMuted,
    fontWeight: '500',
  },
  stateChip: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stateChipActive: {
    backgroundColor: Palette.ink,
  },
  stateChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.ink,
  },
  stateChipTextActive: {
    color: Palette.surface,
  },
  panelBody: {
    borderTopWidth: 2,
    borderTopColor: Palette.ink,
    backgroundColor: Palette.highlight,
    padding: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    color: Palette.ink,
    fontWeight: '600',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  panelBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 10,
    alignItems: 'center',
    ...BrutalShadow.sm,
  },
  panelBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.ink,
  },
  infoRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 2,
  },
  infoKey: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.inkMuted,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  logoutBtn: {
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    ...BrutalShadow.md,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: Palette.ink,
  },
});
