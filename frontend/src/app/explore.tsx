import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/bottom-nav';
import { Collapsible } from '@/components/ui/collapsible';
import { BrutalShadow, MaxContentWidth, Palette } from '@/constants/theme';
import { getAuthToken } from '@/services/api';

const SEVERITIES = [
  {
    label: 'Ringan',
    bg: Palette.lime,
    text: Palette.ink,
    note: 'Kerusakan kecil permukaan aspal dan belum menghambat lajur utama.',
  },
  {
    label: 'Sedang',
    bg: Palette.yellow,
    text: Palette.ink,
    note: 'Membutuhkan perbaikan terjadwal dalam beberapa hari.',
  },
  {
    label: 'Parah',
    bg: Palette.accent,
    text: Palette.accentText,
    note: 'Lubang dalam atau rusak berat yang berisiko membahayakan pengendara.',
  },
];

const STATUS_ITEMS = [
  {
    label: 'Menunggu',
    bg: Palette.surface,
    desc: 'Laporan sudah masuk dan menunggu verifikasi petugas.',
  },
  {
    label: 'Perlu Tinjauan',
    bg: Palette.pending,
    desc: 'Laporan membutuhkan konfirmasi tambahan dari moderator.',
  },
  {
    label: 'Diproses',
    bg: Palette.yellow,
    desc: 'Laporan diteruskan ke dinas terkait dan sedang ditindaklanjuti.',
  },
  {
    label: 'Selesai',
    bg: Palette.success,
    desc: 'Perbaikan jalan di lapangan telah diselesaikan.',
  },
  {
    label: 'Ditolak',
    bg: Palette.danger,
    desc: 'Laporan tidak valid, duplikat, atau di luar cakupan wilayah layanan.',
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const isAuthenticated = Boolean(getAuthToken());

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>UJ</Text>
              </View>
              <View>
                <Text style={styles.brandName}>UrusJakarta</Text>
                <Text style={styles.brandSub}>Panduan Pelaporan Jalan Rusak</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/beranda')}
              style={styles.backBtn}>
              <Text style={styles.backBtnText}>Beranda</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>PANDUAN PENGGUNA</Text>
            </View>
            <Text style={styles.heroTitle}>Cara Melaporkan Kerusakan Jalan</Text>
            <Text style={styles.heroDesc}>
              Pelajari alur pemeriksaan foto otomatis, tips pengambilan gambar, serta arti status
              penanganan agar laporan kerusakan jalan Anda diproses lebih cepat.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push((isAuthenticated ? '/lapor' : '/signup?mode=signup') as any)
              }
              style={styles.primaryCta}>
              <Text style={styles.primaryCtaText}>
                {isAuthenticated ? 'Buat Laporan Jalan' : 'Daftar untuk Melapor'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Alur Verifikasi */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Alur Pemeriksaan Otomatis</Text>
            <View style={styles.stack}>
              <Collapsible tag="Tahap 1" title="Deteksi Titik Kerusakan pada Foto" defaultOpen>
                <Text style={styles.bodyText}>
                  Sistem memindai foto jalan yang Anda unggah untuk menandai area lubang, retakan,
                  atau pengelupasan aspal beserta tingkat keyakinan deteksinya.
                </Text>
              </Collapsible>

              <Collapsible tag="Tahap 2" title="Penyusunan Draf dan Estimasi Keparahan">
                <Text style={styles.bodyText}>
                  Hasil deteksi dipadukan dengan catatan lokasi Anda untuk membentuk judul singkat,
                  deskripsi, dan rekomendasi tingkat keparahan yang tetap dapat Anda edit sebelum
                  dikirim.
                </Text>
              </Collapsible>

              <Collapsible tag="Tips" title="Tips Mengambil Foto Jalan yang Jelas">
                <Text style={styles.bodyText}>
                  Ambil gambar pada pencahayaan cukup, posisikan kerusakan jalan di tengah bingkai,
                  dan sertakan nama jalan atau patokan terdekat agar petugas mudah menemukan titik
                  lokasi.
                </Text>
              </Collapsible>
            </View>
          </View>

          {/* Legenda */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Skala Keparahan & Status Laporan</Text>
            <View style={styles.legendCard}>
              <Text style={styles.legendLabel}>Tingkat Keparahan</Text>
              <View style={styles.legendList}>
                {SEVERITIES.map((sev) => (
                  <View key={sev.label} style={styles.legendRow}>
                    <View style={[styles.pillBadge, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.pillText, { color: sev.text }]}>{sev.label}</Text>
                    </View>
                    <Text style={styles.legendNote}>{sev.note}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.legendDivider} />

              <Text style={styles.legendLabel}>Status Penanganan</Text>
              <View style={styles.legendList}>
                {STATUS_ITEMS.map((st) => (
                  <View key={st.label} style={styles.legendRow}>
                    <View style={[styles.pillBadge, { backgroundColor: st.bg }]}>
                      <Text style={styles.pillText}>{st.label}</Text>
                    </View>
                    <Text style={styles.legendNote}>{st.desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomNav active="beranda" />
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
    gap: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...BrutalShadow.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: Palette.accentText,
    fontSize: 13,
    fontWeight: '900',
  },
  brandName: {
    color: Palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  brandSub: {
    color: Palette.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  backBtn: {
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...BrutalShadow.sm,
  },
  backBtnText: {
    color: Palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  heroCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 18,
    gap: 10,
    ...BrutalShadow.lg,
  },
  heroTag: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.ink,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroTagText: {
    color: Palette.yellow,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: Palette.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroDesc: {
    color: Palette.inkMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryCta: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 4,
    ...BrutalShadow.sm,
  },
  primaryCtaText: {
    color: Palette.accentText,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    color: Palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  stack: {
    gap: 10,
  },
  bodyText: {
    color: Palette.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  legendCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 16,
    gap: 12,
    ...BrutalShadow.md,
  },
  legendLabel: {
    color: Palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  legendList: {
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillBadge: {
    minWidth: 104,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  pillText: {
    color: Palette.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  legendNote: {
    flex: 1,
    color: Palette.inkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  legendDivider: {
    height: 2,
    backgroundColor: Palette.ink,
    marginVertical: 2,
  },
});
