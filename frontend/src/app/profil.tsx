import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function Profil() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>PROFIL</Text>

      {/* Bagian Info Profil */}
      <View style={styles.profileInfoContainer}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarIcon}>👤</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.nameText}>Warga</Text>
          <Text style={styles.emailText}>Warga@email.com</Text>
        </View>
      </View>

      {/* Tombol-tombol Menu Profil */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuButtonText}>📝 UBAH PROFIL</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuButtonText}>💬 HUBUNGI KAMI</Text>
        </TouchableOpacity>

        {/* Tombol Keluar (kembali ke Sign Up) */}
        <TouchableOpacity 
          style={[styles.menuButton, { backgroundColor: '#FF5E00' }]}
          onPress={() => router.replace('/signup')}
        >
          <Text style={[styles.menuButtonText, { color: '#fff' }]}>← KELUAR</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Navigasi Bawah */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => router.push('/beranda')}
        >
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => router.push('/riwayat')}
        >
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
  header: { fontSize: 24, fontWeight: '900', color: '#000', marginTop: 50, marginBottom: 40, textAlign: 'center' },
  profileInfoContainer: { flexDirection: 'row', paddingHorizontal: 30, alignItems: 'center', marginBottom: 50 },
  avatarBox: { width: 80, height: 80, backgroundColor: '#E5E7EB', borderWidth: 4, borderColor: '#000', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0, marginRight: 20 },
  avatarIcon: { fontSize: 40 },
  profileText: { flex: 1 },
  nameText: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 5 },
  emailText: { fontSize: 14, fontWeight: 'bold', color: '#666' },
  menuContainer: { paddingHorizontal: 30 },
  menuButton: { backgroundColor: '#E5E7EB', borderWidth: 3, borderColor: '#000', padding: 15, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  menuButtonText: { fontSize: 16, fontWeight: '900', color: '#000' },
  bottomNav: { flexDirection: 'row', borderTopWidth: 3, borderColor: '#000', backgroundColor: '#F3F4F6', height: 70, position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#000' },
  navActive: { backgroundColor: '#FF5E00' },
  navText: { fontWeight: '900', color: '#000' },
  navTextActive: { fontWeight: '900', color: '#fff' }
});