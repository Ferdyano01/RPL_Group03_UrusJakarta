import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';

export default function Beranda() {
  return (
    <View style={styles.container}>
      {/* Area yang bisa di-scroll */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>HALO, WARGA!</Text>

        {/* Tombol Lapor Jalan Rusak */}
        <TouchableOpacity style={styles.reportButton}>
          <Text style={styles.reportButtonText}>+ Lapor Jalan rusak</Text>
        </TouchableOpacity>

        {/* Statistik Mini (Pengisi Ruang Kosong) */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: '#fff' }]}>
            <Text style={styles.statText}>Laporan: 5</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#C1FF72' }]}>
            <Text style={styles.statText}>Selesai: 3</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Laporan Terkini</Text>

        {/* Kartu Laporan 1 */}
        <View style={styles.card}>
          <View style={styles.imagePlaceholder}>
            <Text style={{fontWeight: 'bold', color: '#666'}}>FOTO</Text>
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>Jl. Gajah Mada 1</Text>
            <Text style={styles.cardDate}>10 Oktober 2026</Text>
            <View style={[styles.badge, { backgroundColor: '#FFD700' }]}>
              <Text style={styles.badgeText}>PROSES</Text>
            </View>
          </View>
        </View>

        {/* Kartu Laporan 2 */}
        <View style={styles.card}>
          <View style={styles.imagePlaceholder}>
            <Text style={{fontWeight: 'bold', color: '#666'}}>FOTO</Text>
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>Jl. Gajah Mada 2</Text>
            <Text style={styles.cardDate}>11 Oktober 2026</Text>
            <View style={[styles.badge, { backgroundColor: '#fff' }]}>
              <Text style={styles.badgeText}>MENUNGGU</Text>
            </View>
          </View>
        </View>

        {/* Jarak kosong di bawah agar tidak tertutup menu navigasi */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Menu Navigasi Bawah */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navTextActive}>Beranda</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => router.push('/riwayat' as any)}
        >
          <Text style={styles.navText}>Riwayat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/profil' as any)}
        >
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollArea: {
    padding: 20,
    paddingTop: 50,
  },
  header: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginBottom: 30,
  },
  reportButton: {
    backgroundColor: '#FADCB6', 
    padding: 18,
    borderRadius: 30, 
    borderWidth: 3,
    borderColor: '#3B2313', 
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  reportButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#3B2313',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#000',
    padding: 10,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  statText: {
    fontWeight: '900',
    fontSize: 14,
    color: '#000',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#E5E7EB',
    borderWidth: 3,
    borderColor: '#000',
    flexDirection: 'row',
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  imagePlaceholder: {
    width: 100,
    height: 80,
    backgroundColor: '#ccc',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    marginBottom: 5,
  },
  cardDate: {
    fontSize: 14,
    color: '#000',
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 15,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
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
  navActive: {
    backgroundColor: '#FF5E00', // Warna oranye saat aktif
  },
  navText: {
    fontWeight: '900',
    color: '#000',
  },
  navTextActive: {
    fontWeight: '900',
    color: '#fff',
  }
});