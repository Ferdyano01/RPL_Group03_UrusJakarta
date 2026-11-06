import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import {
  ReportItem,
  getAuthToken,
  fetchMyReportsApi,
  fetchAllReportsApi,
  resolveImageUrl,
  formatStatusBadge,
  formatDateID,
} from '@/services/api';
import { ReportDetailModal } from '@/components/report-detail-modal';

const FILTER_TABS = [
  { key: 'SEMUA', label: 'SEMUA', bg: '#FF5E00', activeText: '#fff' },
  { key: 'PROSES', label: 'PROSES', bg: '#FFD700', activeText: '#000' },
  { key: 'MENUNGGU', label: 'MENUNGGU', bg: '#fff', activeText: '#000' },
  { key: 'SELESAI', label: 'SELESAI', bg: '#32CD32', activeText: '#000' },
];

export default function Riwayat() {
  const [activeFilter, setActiveFilter] = useState<string>('SEMUA');
  const [scope, setScope] = useState<'my' | 'all'>('all');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const hasToken = Boolean(getAuthToken());
      if (scope === 'my' && hasToken) {
        const res = await fetchMyReportsApi({ status: activeFilter, limit: 50 });
        setReports(res.data || []);
      } else {
        const res = await fetchAllReportsApi({ status: activeFilter, limit: 50 });
        setReports(res.data || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengambil riwayat laporan.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, scope]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>RIWAYAT LAPORAN</Text>

        {/* Toggle Cakupan: Semua Laporan Publik vs Laporan Saya */}
        <View style={styles.scopeRow}>
          <TouchableOpacity
            style={[
              styles.scopeBtn,
              scope === 'all' && styles.scopeBtnActive,
            ]}
            onPress={() => setScope('all')}>
            <Text
              style={[
                styles.scopeBtnText,
                scope === 'all' && { color: '#fff' },
              ]}>
              Semua Laporan Warga
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.scopeBtn,
              scope === 'my' && styles.scopeBtnActive,
            ]}
            onPress={() => setScope('my')}>
            <Text
              style={[
                styles.scopeBtnText,
                scope === 'my' && { color: '#fff' },
              ]}>
              Laporan Saya
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tab Laporan */}
        <View style={styles.filterContainer}>
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterBtn,
                  { backgroundColor: tab.bg },
                  isSelected && styles.filterBtnSelected,
                ]}
                onPress={() => setActiveFilter(tab.key)}>
                <Text
                  style={[
                    styles.filterText,
                    tab.key === 'SEMUA' && { color: '#fff' },
                  ]}>
                  {isSelected ? `✓ ${tab.label}` : tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Memuat riwayat ({activeFilter})...</Text>
          </View>
        )}

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

        {!loading && reports.length === 0 && !errorMsg && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Tidak ada laporan pada kategori filter "{activeFilter}".
            </Text>
          </View>
        )}

        {/* Daftar Kartu Laporan */}
        {reports.map((item) => {
          const statusBadge = formatStatusBadge(item.status);
          const imgUri = resolveImageUrl(item.image_url);
          const detectionsCount = item.ai_analysis?.total_detections ?? 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => setSelectedReport(item)}>
              <View style={styles.imagePlaceholder}>
                {imgUri ? (
                  <Image
                    source={{ uri: imgUri }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontWeight: 'bold', color: '#666' }}>FOTO</Text>
                )}
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title || item.address || 'Laporan Kerusakan Jalan'}
                </Text>
                {item.address && (
                  <Text style={styles.cardAddress} numberOfLines={1}>
                    📍 {item.address}
                  </Text>
                )}
                <Text style={styles.cardDate}>{formatDateID(item.created_at)}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                    <Text style={[styles.badgeText, { color: statusBadge.text }]}>
                      {statusBadge.label}
                    </Text>
                  </View>
                  {detectionsCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={styles.badgeText}> {detectionsCount} titik</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal Detail & Evaluasi Laporan */}
      <ReportDetailModal
        visible={Boolean(selectedReport)}
        reportId={selectedReport?.id || null}
        initialReport={selectedReport}
        onClose={() => setSelectedReport(null)}
        onUpdated={loadReports}
      />

      {/* Menu Navigasi Bawah */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/beranda')}>
          <Text style={styles.navText}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navTextActive}>Riwayat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/profil' as never)}>
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollArea: { padding: 20, paddingTop: 45 },
  header: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  scopeBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
  },
  scopeBtnActive: {
    backgroundColor: '#000',
  },
  scopeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 6,
  },
  filterBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  filterBtnSelected: {
    borderWidth: 3,
    shadowOffset: { width: 4, height: 4 },
  },
  filterText: { fontSize: 10, fontWeight: '900', color: '#000' },
  centerBox: { padding: 30, alignItems: 'center' },
  loadingText: { marginTop: 8, fontWeight: '800', color: '#000' },
  errorBox: {
    backgroundColor: '#FCA5A5',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    marginBottom: 15,
  },
  errorText: { fontWeight: '900', color: '#000' },
  emptyBox: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontWeight: '800', color: '#374151', textAlign: 'center' },
  card: {
    backgroundColor: '#E5E7EB',
    borderWidth: 3,
    borderColor: '#000',
    flexDirection: 'row',
    padding: 10,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  imagePlaceholder: {
    width: 100,
    height: 85,
    backgroundColor: '#ccc',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%' },
  cardTextContainer: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#000', marginBottom: 3 },
  cardAddress: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#000', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '900', color: '#000' },
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
