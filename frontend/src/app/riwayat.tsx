import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';

export default function Riwayat() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>RIWAYAT LAPORAN</Text>

        {/* Filter Tab Laporan */}
        <View style={styles.filterContainer}>
          <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#FF5E00' }]}>
            <Text style={[styles.filterText, { color: '#fff' }]}>SEMUA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#FFD700' }]}>
            <Text style={styles.filterText}>PROSES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#fff' }]}>
            <Text style={styles.filterText}>MENUNGGU</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, { backgroundColor: '#32CD32' }]}>
            <Text style={styles.filterText}>SELESAI</Text>
          </TouchableOpacity>
        </View>

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

        {/* Kartu Laporan 3 */}
        <View style={styles.card}>
          <View style={styles.imagePlaceholder}>
            <Text style={{fontWeight: 'bold', color: '#666'}}>FOTO</Text>
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>Jl. Gajah Mada 3</Text>
            <Text style={styles.cardDate}>12 Oktober 2026</Text>
            <View style={[styles.badge, { backgroundColor: '#32CD32' }]}>
              <Text style={styles.badgeText}>SELESAI</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Menu Navigasi Bawah */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => router.push('/beranda')}
        >
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>
        
        {/* Tombol Riwayat Aktif */}
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navTextActive}>Riwayat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/profil' as never)}
        >
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollArea: { padding: 20, paddingTop: 50 },
  header: { fontSize: 24, fontWeight: '900', color: '#000', marginBottom: 20, textAlign: 'center' },
  filterContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  filterBtn: { borderWidth: 2, borderColor: '#000', paddingVertical: 5, paddingHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
  filterText: { fontSize: 10, fontWeight: '900', color: '#000' },
  card: { backgroundColor: '#E5E7EB', borderWidth: 3, borderColor: '#000', flexDirection: 'row', padding: 10, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0 },
  imagePlaceholder: { width: 100, height: 80, backgroundColor: '#ccc', borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTextContainer: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#000', marginBottom: 5 },
  cardDate: { fontSize: 14, color: '#000', marginBottom: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: '#000', borderRadius: 15 },
  badgeText: { fontSize: 12, fontWeight: '900', color: '#000' },
  bottomNav: { flexDirection: 'row', borderTopWidth: 3, borderColor: '#000', backgroundColor: '#F3F4F6', height: 70, position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#000' },
  navActive: { backgroundColor: '#FF5E00' },
  navText: { fontWeight: '900', color: '#000' },
  navTextActive: { fontWeight: '900', color: '#fff' }
});