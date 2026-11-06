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
  getCurrentUser,
  checkSystemHealth,
  fetchAllReportsApi,
  resolveImageUrl,
  formatStatusBadge,
  formatSeverityBadge,
  formatDateID,
} from '@/services/api';
import { ReportDetailModal } from '@/components/report-detail-modal';

export default function Beranda() {
  const user = getCurrentUser();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    backendOnline: boolean;
    aiOnline: boolean;
    storageMode: string;
  } | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [healthData, reportsRes] = await Promise.all([
        checkSystemHealth(),
        fetchAllReportsApi({ limit: 50 }),
      ]);
      setHealth(healthData);
      setReports(reportsRes.data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar laporan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalCount = reports.length;
  const inProgressCount = reports.filter((r) =>
    ['routed', 'in_progress'].includes(r.status)
  ).length;
  const fixedCount = reports.filter((r) =>
    ['fixed', 'closed'].includes(r.status)
  ).length;

  const firstName = user?.full_name
    ? user.full_name.split(' ')[0].toUpperCase()
    : 'WARGA';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>HALO, {firstName}!</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Text style={styles.refreshBtnText}>↻ REFRESH</Text>
          </TouchableOpacity>
        </View>

        {/* Status Integrasi Sistem */}
        {health && (
          <View style={styles.statusBannerRow}>
            <View
              style={[
                styles.statusTag,
                { backgroundColor: health.backendOnline ? '#C1FF72' : '#FCA5A5' },
              ]}>
              <Text style={styles.statusTagText}>
                API: {health.backendOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
            <View
              style={[
                styles.statusTag,
                { backgroundColor: health.aiOnline ? '#C1FF72' : '#FFD700' },
              ]}>
              <Text style={styles.statusTagText}>
                YOLO AI: {health.aiOnline ? 'ACTIVE' : 'FALLBACK'}
              </Text>
            </View>
          </View>
        )}

        {/* Tombol Lapor Jalan Rusak */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => router.push('/lapor' as any)}>
          <Text style={styles.reportButtonText}>+ Lapor Jalan rusak (Analisis AI)</Text>
        </TouchableOpacity>

        {/* Statistik Dinamis */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: '#fff' }]}>
            <Text style={styles.statText}>Laporan: {totalCount}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FFD700' }]}>
            <Text style={styles.statText}>Proses: {inProgressCount}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#C1FF72' }]}>
            <Text style={styles.statText}>Selesai: {fixedCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Laporan Terkini</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Memuat laporan warga...</Text>
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
              Belum ada laporan. Klik "+ Lapor Jalan rusak" untuk membuat laporan baru!
            </Text>
          </View>
        )}

        {/* Daftar Kartu Laporan */}
        {reports.map((item) => {
          const statusBadge = formatStatusBadge(item.status);
          const sevBadge = formatSeverityBadge(item.severity);
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

                <View style={styles.cardBadgesRow}>
                  <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                    <Text style={[styles.badgeText, { color: statusBadge.text }]}>
                      {statusBadge.label}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: sevBadge.bg }]}>
                    <Text style={[styles.badgeText, { color: sevBadge.text }]}>
                      {item.severity?.toUpperCase() || 'MEDIUM'}
                    </Text>
                  </View>
                  {detectionsCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={styles.badgeText}>🤖 {detectionsCount} titik</Text>
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
        onUpdated={loadData}
      />

      {/* Menu Navigasi Bawah */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navActive]}>
          <Text style={styles.navTextActive}>Beranda</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/riwayat' as any)}>
          <Text style={styles.navText}>Riwayat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/profil' as any)}>
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
    paddingTop: 45,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000',
  },
  refreshBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  statusBannerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statusTag: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
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
    fontSize: 17,
    fontWeight: '900',
    color: '#3B2313',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  statText: {
    fontWeight: '900',
    fontSize: 13,
    color: '#000',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    marginBottom: 15,
  },
  centerBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontWeight: '800',
    color: '#000',
  },
  errorBox: {
    backgroundColor: '#FCA5A5',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontWeight: '900',
    color: '#000',
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
  },
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
    width: 105,
    height: 90,
    backgroundColor: '#ccc',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000',
    marginBottom: 3,
  },
  cardAddress: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 12,
    color: '#000',
    marginBottom: 8,
  },
  cardBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
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
    backgroundColor: '#FF5E00',
  },
  navText: {
    fontWeight: '900',
    color: '#000',
  },
  navTextActive: {
    fontWeight: '900',
    color: '#fff',
  },
});
