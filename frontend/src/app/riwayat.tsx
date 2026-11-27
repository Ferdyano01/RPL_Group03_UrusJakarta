import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { BottomNav } from '@/components/bottom-nav';
import { ReportDetailModal } from '@/components/report-detail-modal';
import { BrutalShadow, MaxContentWidth, Palette } from '@/constants/theme';
import {
  ReportItem,
  fetchAllReportsApi,
  fetchMyReportsApi,
  formatDateID,
  formatSeverityBadge,
  formatStatusBadge,
  getAuthToken,
  isAuthSessionError,
  resolveImageUrl,
  subscribeAuthChange,
} from '@/services/api';

const FILTER_TABS = [
  { key: 'SEMUA', label: 'Semua', activeBg: Palette.ink, activeText: Palette.surface },
  { key: 'MENUNGGU', label: 'Menunggu', activeBg: Palette.pending, activeText: Palette.ink },
  { key: 'PROSES', label: 'Diproses', activeBg: Palette.yellow, activeText: Palette.ink },
  { key: 'SELESAI', label: 'Selesai', activeBg: Palette.success, activeText: Palette.ink },
];

export default function Riwayat() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<string>('SEMUA');
  const [scope, setScope] = useState<'all' | 'my'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('newest');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [hasToken, setHasToken] = useState(() => Boolean(getAuthToken()));
  const hasLoadedOnce = useRef(false);

  const loadReports = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setErrorMsg(null);
    try {
      if (scope === 'my' && getAuthToken()) {
        const res = await fetchMyReportsApi({ status: activeFilter, limit: 50 });
        const rows = res.data || [];
        if (sortBy === 'priority') {
          rows.sort(
            (a, b) =>
              Number(b.ai_analysis?.priority_score ?? 0) -
              Number(a.ai_analysis?.priority_score ?? 0)
          );
        }
        setReports(rows);
      } else {
        const res = await fetchAllReportsApi({
          status: activeFilter,
          sort: sortBy,
          limit: 50,
          forceRefresh: isPullRefresh,
        });
        setReports(res.data || []);
      }
      hasLoadedOnce.current = true;
    } catch (err: any) {
      if (isAuthSessionError(err)) {
        setHasToken(false);
        setScope('all');
      }
      setErrorMsg(err.message || 'Gagal mengambil riwayat laporan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, scope, sortBy]);

  useEffect(() => {
    return subscribeAuthChange((authenticated) => {
      setHasToken(authenticated);
      if (!authenticated) {
        setScope('all');
      }
    });
  }, []);

  useEffect(() => {
    void loadReports(false);
  }, [loadReports]);

  useFocusEffect(
    useCallback(() => {
      setHasToken(Boolean(getAuthToken()));
      if (hasLoadedOnce.current) {
        void loadReports(false);
      }
    }, [loadReports])
  );

  const bottomPadding = 92 + (Platform.OS === 'web' ? 0 : insets.bottom);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS === 'web' ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadReports(true)}
              colors={[Palette.accent, Palette.ink]}
              tintColor={Palette.accent}
            />
          )
        }>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerCard}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>ARSIP & PEMANTAUAN</Text>
              <Text style={styles.headerTitle}>Riwayat Laporan</Text>
              <Text style={styles.headerSub}>
                Telusuri status tindak lanjut laporan warga berdasarkan kategori progres.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.refreshBtn}
              onPress={() => loadReports(true)}>
              <Text style={styles.refreshBtnText}>Muat Ulang</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Scope Toggle */}
          <View style={styles.scopeRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.scopeBtn, scope === 'all' && styles.scopeBtnActive]}
              onPress={() => setScope('all')}>
              <Text style={[styles.scopeBtnText, scope === 'all' && styles.scopeBtnTextActive]}>
                Semua Laporan Warga
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.scopeBtn, scope === 'my' && styles.scopeBtnActive]}
              onPress={() => setScope('my')}>
              <Text style={[styles.scopeBtnText, scope === 'my' && styles.scopeBtnTextActive]}>
                Laporan Saya
              </Text>
            </TouchableOpacity>
          </View>

          {scope === 'my' && !hasToken && (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>
                Anda belum masuk akun. Saat ini menampilkan daftar publik sementara.
              </Text>
              <TouchableOpacity
                style={styles.noticeBtn}
                onPress={() => router.push('/signup')}>
                <Text style={styles.noticeBtnText}>Masuk Akun</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Filter Tabs */}
          <View style={styles.filterRow}>
            {FILTER_TABS.map((tab) => {
              const isSelected = activeFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.85}
                  style={[
                    styles.filterBtn,
                    isSelected && [
                      styles.filterBtnActive,
                      { backgroundColor: tab.activeBg },
                    ],
                  ]}
                  onPress={() => setActiveFilter(tab.key)}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={[
                      styles.filterText,
                      isSelected && { color: tab.activeText, fontWeight: '900' },
                    ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sort Row */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Urutkan:</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.sortBtn, sortBy === 'newest' && styles.sortBtnActive]}
              onPress={() => setSortBy('newest')}>
              <Text style={[styles.sortBtnText, sortBy === 'newest' && styles.sortBtnTextActive]}>
                Terbaru
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.sortBtn, sortBy === 'priority' && styles.sortBtnActive]}
              onPress={() => setSortBy('priority')}>
              <Text style={[styles.sortBtnText, sortBy === 'priority' && styles.sortBtnTextActive]}>
                Prioritas Tertinggi
              </Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={Palette.ink} />
              <Text style={styles.stateText}>Memuat daftar laporan...</Text>
            </View>
          )}

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Terjadi Kendala</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {!loading && reports.length === 0 && !errorMsg && (
            <View style={styles.stateBox}>
              <Text style={styles.emptyTitle}>Tidak ada laporan pada filter ini</Text>
              <Text style={styles.stateText}>
                Coba pilih filter status lain atau buat laporan baru.
              </Text>
            </View>
          )}

          {/* Report List */}
          <View style={styles.listStack}>
            {reports.map((item) => {
              const statusBadge = formatStatusBadge(item.status);
              const sevBadge = formatSeverityBadge(item.severity);
              const imgUri = resolveImageUrl(item.image_url);
              const detectionsCount = item.ai_analysis?.total_detections ?? 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  style={styles.reportCard}
                  onPress={() => setSelectedReport(item)}>
                  <View style={styles.thumbBox}>
                    {imgUri ? (
                      <Image
                        source={{ uri: imgUri }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.thumbFallback}>Tanpa Foto</Text>
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title || item.address || 'Laporan Kerusakan Jalan'}
                    </Text>

                    {item.address ? (
                      <Text style={styles.cardAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    ) : null}

                    <Text style={styles.cardDate}>{formatDateID(item.created_at)}</Text>

                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                        <Text style={[styles.badgeText, { color: statusBadge.text }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: sevBadge.bg }]}>
                        <Text style={[styles.badgeText, { color: sevBadge.text }]}>
                          {sevBadge.label}
                        </Text>
                      </View>
                      {detectionsCount > 0 && (
                        <View style={[styles.badge, { backgroundColor: Palette.highlight }]}>
                          <Text style={[styles.badgeText, { color: Palette.ink }]}>
                            {detectionsCount} titik
                          </Text>
                        </View>
                      )}
                      {item.ai_analysis?.priority_score !== undefined && (
                        <View style={[styles.badge, { backgroundColor: Palette.lime }]}>
                          <Text style={[styles.badgeText, { color: Palette.ink }]}>
                            Prioritas {item.ai_analysis.priority_score}
                          </Text>
                        </View>
                      )}
                      {(item.ai_analysis?.support_count ?? 1) > 1 && (
                        <View style={[styles.badge, { backgroundColor: Palette.pending }]}>
                          <Text style={[styles.badgeText, { color: Palette.ink }]}>
                            {item.ai_analysis?.support_count} pelapor
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <ReportDetailModal
        visible={Boolean(selectedReport)}
        reportId={selectedReport?.id || null}
        initialReport={selectedReport}
        onClose={() => setSelectedReport(null)}
        onUpdated={loadReports}
      />

      <BottomNav active="riwayat" />
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
    gap: 14,
  },
  headerCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    ...BrutalShadow.md,
  },
  headerTextWrap: {
    flex: 1,
    gap: 3,
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
  headerSub: {
    fontSize: 12,
    lineHeight: 18,
    color: Palette.inkMuted,
    fontWeight: '500',
  },
  refreshBtn: {
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 11,
    paddingVertical: 7,
    ...BrutalShadow.sm,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  scopeRow: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.surface,
    ...BrutalShadow.sm,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Palette.surface,
  },
  scopeBtnActive: {
    backgroundColor: Palette.ink,
  },
  scopeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.ink,
  },
  scopeBtnTextActive: {
    color: Palette.surface,
    fontWeight: '900',
  },
  noticeCard: {
    backgroundColor: Palette.highlight,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
  },
  noticeBtn: {
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  noticeBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.accentText,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  filterBtnActive: {
    ...BrutalShadow.sm,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.inkMuted,
  },
  sortBtn: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortBtnActive: {
    backgroundColor: Palette.yellow,
    ...BrutalShadow.sm,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.ink,
  },
  sortBtnTextActive: {
    fontWeight: '900',
  },
  stateBox: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    ...BrutalShadow.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Palette.ink,
  },
  stateText: {
    fontSize: 13,
    color: Palette.inkMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  listStack: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    ...BrutalShadow.md,
  },
  thumbBox: {
    width: 96,
    height: 96,
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.inkMuted,
    textAlign: 'center',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Palette.ink,
    lineHeight: 20,
  },
  cardAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.inkSubtle,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
