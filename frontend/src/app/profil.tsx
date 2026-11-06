import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import {
  UserProfile,
  getCurrentUser,
  fetchMyProfile,
  updateMyProfile,
  clearAuthSession,
  getApiBaseUrl,
  setApiBaseUrl,
  checkSystemHealth,
} from '@/services/api';

export default function Profil() {
  const [user, setUser] = useState<UserProfile | null>(getCurrentUser());
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || 'Budi Warga Jakarta');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');

  const [showServerConfig, setShowServerConfig] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(getApiBaseUrl());
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMyProfile()
      .then((profile) => {
        setUser(profile);
        setFullName(profile.full_name || '');
        setPhoneNumber(profile.phone_number || '');
      })
      .catch(() => {
        // Gunakan profil tersimpan jika belum login
      });
  }, []);

  const handleSaveProfile = async () => {
    setStatusMessage(null);
    try {
      const updated = await updateMyProfile({
        full_name: fullName,
        phone_number: phoneNumber,
      });
      setUser(updated);
      setEditingProfile(false);
      setStatusMessage('✅ Profil berhasil diperbarui!');
    } catch (err: any) {
      setStatusMessage(`⚠️ ${err.message || 'Gagal memperbarui profil.'}`);
    }
  };

  const handleSaveApiUrl = async () => {
    setApiBaseUrl(apiUrlInput);
    const health = await checkSystemHealth();
    setShowServerConfig(false);
    setStatusMessage(
      health.backendOnline
        ? `✅ Terhubung ke Backend (${getApiBaseUrl()}) | Road-AI: ${
            health.aiOnline ? 'ONLINE' : 'FALLBACK'
          }`
        : `⚠️ Tidak dapat menghubungi server di ${getApiBaseUrl()}`
    );
  };

  const handleLogout = () => {
    clearAuthSession();
    router.replace('/signup');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>PROFIL</Text>

        {/* Bagian Info Profil */}
        <View style={styles.profileInfoContainer}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.nameText}>{user?.full_name || 'Warga Jakarta'}</Text>
            <Text style={styles.emailText}>{user?.email || 'warga@jakarta.id'}</Text>
            {user?.phone_number ? (
              <Text style={styles.phoneText}>📞 {user.phone_number}</Text>
            ) : null}
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                PERAN: {(user?.role || 'citizen').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {statusMessage && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{statusMessage}</Text>
          </View>
        )}

        {/* Form Ubah Profil */}
        {editingProfile && (
          <View style={styles.panelBox}>
            <Text style={styles.panelTitle}>UBAH PROFIL WARGA</Text>
            <Text style={styles.inputLabel}>Nama Lengkap</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nama Lengkap"
            />
            <Text style={styles.inputLabel}>Nomor Telepon</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="0812xxxxxxxx"
              keyboardType="phone-pad"
            />
            <View style={styles.panelBtnRow}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#C1FF72' }]}
                onPress={handleSaveProfile}>
                <Text style={styles.smallBtnText}>SIMPAN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#fff' }]}
                onPress={() => setEditingProfile(false)}>
                <Text style={styles.smallBtnText}>BATAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Form Konfigurasi URL Server Lokal */}
        {showServerConfig && (
          <View style={styles.panelBox}>
            <Text style={styles.panelTitle}>KONFIGURASI URL BACKEND API</Text>
            <Text style={styles.inputLabel}>Alamat URL Server Backend</Text>
            <TextInput
              style={styles.input}
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              autoCapitalize="none"
              placeholder="http://localhost:5000"
            />
            <View style={styles.panelBtnRow}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#FFD700' }]}
                onPress={handleSaveApiUrl}>
                <Text style={styles.smallBtnText}>UJI & SIMPAN URL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#fff' }]}
                onPress={() => setShowServerConfig(false)}>
                <Text style={styles.smallBtnText}>TUTUP</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Panel Hubungi Kami */}
        {showContactInfo && (
          <View style={styles.panelBox}>
            <Text style={styles.panelTitle}>LAYANAN PENGADUAN URUSJAKARTA</Text>
            <Text style={styles.contactText}>
              • Instansi Tujuan: Dinas Bina Marga Provinsi DKI Jakarta
            </Text>
            <Text style={styles.contactText}>
              • Email Resmi: binamarga@jakarta.go.id
            </Text>
            <Text style={styles.contactText}>
              • Pengembang: Kelompok 03 RPL — FT Universitas Indonesia
            </Text>
          </View>
        )}

        {/* Tombol-tombol Menu Profil */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setEditingProfile(!editingProfile)}>
            <Text style={styles.menuButtonText}>📝 UBAH PROFIL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowServerConfig(!showServerConfig)}>
            <Text style={styles.menuButtonText}>⚙️ PENGATURAN SERVER API</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowContactInfo(!showContactInfo)}>
            <Text style={styles.menuButtonText}>💬 HUBUNGI KAMI</Text>
          </TouchableOpacity>

          {/* Tombol Keluar (kembali ke Sign Up) */}
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: '#FF5E00' }]}
            onPress={handleLogout}>
            <Text style={[styles.menuButtonText, { color: '#fff' }]}>
              ← KELUAR
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Menu Navigasi Bawah */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/beranda')}>
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/riwayat')}>
          <Text style={styles.navText}>Riwayat</Text>
        </TouchableOpacity>

        {/* Tombol Profil Aktif */}
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navTextActive}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollArea: { paddingHorizontal: 25, paddingTop: 45 },
  header: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginBottom: 30,
    textAlign: 'center',
  },
  profileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  avatarBox: {
    width: 75,
    height: 75,
    backgroundColor: '#FADCB6',
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarIcon: { fontSize: 36 },
  profileText: { flex: 1 },
  nameText: { fontSize: 18, fontWeight: '900', color: '#000', marginBottom: 3 },
  emailText: { fontSize: 13, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 },
  phoneText: { fontSize: 12, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#C1FF72',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '900', color: '#000' },
  statusBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 16,
  },
  statusBannerText: { fontWeight: '900', fontSize: 12, color: '#000' },
  panelBox: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  panelTitle: { fontSize: 14, fontWeight: '900', color: '#000', marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '900', color: '#000', marginBottom: 4 },
  input: {
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 14,
    color: '#000',
    marginBottom: 10,
  },
  panelBtnRow: { flexDirection: 'row', gap: 10 },
  smallBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 10,
    alignItems: 'center',
  },
  smallBtnText: { fontWeight: '900', fontSize: 12, color: '#000' },
  contactText: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 4 },
  menuContainer: { marginTop: 5 },
  menuButton: {
    backgroundColor: '#E5E7EB',
    borderWidth: 3,
    borderColor: '#000',
    padding: 15,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  menuButtonText: { fontSize: 15, fontWeight: '900', color: '#000' },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 3,
    borderColor: '#000',
    backgroundColor: '#F3F4F6',
    height: 70,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#000',
  },
  navActive: { backgroundColor: '#FF5E00' },
  navText: { fontWeight: '900', color: '#000' },
  navTextActive: { fontWeight: '900', color: '#fff' },
});
