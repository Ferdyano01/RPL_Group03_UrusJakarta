import React, { useCallback, useRef, useState } from 'react';
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
  checkSystemHealth,
  fetchAllReportsApi,
  formatDateID,
  formatSeverityBadge,
  formatStatusBadge,
  getCurrentUser,
  resolveImageUrl,
} from '@/services/api';

export default function Beranda() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(() => getCurrentUser());
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    backendOnline: boolean;
    aiOnline: boolean;
    storageMode: string;
  } | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const hasLoadedOnce = useRef(false);

  const loadData = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setErrorMsg(null);

    // Jalankan health check terpisah agar daftar laporan tidak tertahan timeout Road-AI
    void checkSystemHealth(isPullRefresh).then(setHealth);

    try {
      const reportsRes = await fetchAllReportsApi({
        status: 'SEMUA',
        sort: 'newest',
        limit: 50,
        forceRefresh: isPullRefresh,
      });
      setReports(reportsRes.data || []);
      hasLoadedOnce.current = true;
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar laporan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setUser(getCurrentUser());
      void loadData(false);
    }, [loadData])
  );

  const totalCount = reports.length;
  const inProgressCount = reports.filter((r) =>
    ['routed', 'in_progress'].includes(r.status)
  ).length;
  const fixedCount = reports.filter((r) =>
    ['fixed', 'closed'].includes(r.status)
  ).length;

  const firstName = user?.full_name
    ? user.full_name.trim().split(' ')[0]
    : null;
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
              onRefresh={() => loadData(true)}
              colors={[Palette.accent, Palette.ink]}
              tintColor={Palette.accent}
            />
          )
        }>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerCard}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>PORTAL PENGADUAN DKI JAKARTA</Text>
              <Text style={styles.greeting}>
                {firstName ? `Halo, ${firstName}` : 'Selamat Datang'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {!user && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.headerBtn, styles.headerBtnAuth]}
                  onPress={() => router.push('/signup?mode=signup' as any)}>
                  <Text style={styles.headerBtnAuthText}>Daftar / Masuk</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.headerBtn}
                onPress={() => router.push('/explore')}>
                <Text style={styles.headerBtnText}>Panduan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.headerBtn, styles.headerBtnAccent]}
                onPress={() => loadData(true)}>
                <Text style={styles.headerBtnText}>Muat Ulang</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Status Strip (selalu di-render agar tidak memicu layout shift CLS) */}
          <View style={styles.statusStrip}>
            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: health
                      ? health.backendOnline
                        ? Palette.success
                        : Palette.danger
                      : Palette.yellow,
                  },
                ]}
              />
              <Text style={styles.statusText}>
                Server: {health ? (health.backendOnline ? 'Terhubung' : 'Terputus') : 'Memeriksa...'}
              </Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: health
                      ? health.aiOnline
                        ? Palette.success
                        : Palette.yellow
                      : Palette.surfaceAlt,
                  },
                ]}
              />
              <Text style={styles.statusText}>
                Deteksi Foto: {health ? (health.aiOnline ? 'Aktif' : 'Siaga') : 'Memeriksa...'}
              </Text>
            </View>
          </View>

          {/* Hero CTA Card */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.ctaCard}
            onPress={() =>
              router.push((user ? '/lapor' : '/signup?mode=signup') as any)
            }>
            <View style={styles.ctaCopy}>
              <Text style={styles.ctaEyebrow}>LAPOR CEPAT</Text>
              <Text style={styles.ctaTitle}>Temukan jalan rusak di sekitar Anda?</Text>
              <Text style={styles.ctaDesc}>
                {user
                  ? 'Unggah foto kondisi jalan untuk deteksi otomatis dan penyusunan laporan resmi.'
                  : 'Daftar atau masuk terlebih dahulu untuk mengunggah foto dan membuat laporan resmi.'}
              </Text>
            </View>
            <View style={styles.ctaButtonBox}>
              <Text style={styles.ctaButtonText}>
                {user ? 'Buat Laporan' : 'Daftar untuk Lapor'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Summary Metrics */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Palette.surface }]}>
              <Text style={styles.statValue}>{totalCount}</Text>
              <Text style={styles.statLabel}>Total Laporan</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Palette.yellow }]}>
              <Text style={styles.statValue}>{inProgressCount}</Text>
              <Text style={styles.statLabel}>Diproses</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Palette.success }]}>
              <Text style={styles.statValue}>{fixedCount}</Text>
              <Text style={styles.statLabel}>Selesai</Text>
            </View>
          </View>

          {/* Feed Section Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Laporan Terkini</Text>
            <TouchableOpacity onPress={() => router.push('/riwayat' as any)}>
              <Text style={styles.sectionLink}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={Palette.ink} />
              <Text style={styles.stateText}>Memuat daftar laporan warga...</Text>
            </View>
          )}

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Gagal Memuat Data</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadData(true)}>
                <Text style={styles.retryBtnText}>Coba Lagi</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && reports.length === 0 && !errorMsg && (
            <View style={styles.stateBox}>
              <Text style={styles.emptyTitle}>Belum ada laporan masuk</Text>
              <Text style={styles.stateText}>
                Mulai laporkan kerusakan jalan agar dapat segera ditindaklanjuti.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() =>
                  router.push((user ? '/lapor' : '/signup?mode=signup') as any)
                }>
                <Text style={styles.emptyActionText}>
                  {user ? 'Buat Laporan Pertama' : 'Daftar untuk Melapor'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Report Cards */}
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
        onUpdated={loadData}
      />

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
    gap: 16,
  },
  headerCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    ...BrutalShadow.md,
  },
  headerTextWrap: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Palette.accent,
    letterSpacing: 0.8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '900',
    color: Palette.ink,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 11,
    paddingVertical: 7,
    ...BrutalShadow.sm,
  },
  headerBtnAccent: {
    backgroundColor: Palette.yellow,
  },
  headerBtnAuth: {
    backgroundColor: Palette.accent,
  },
  headerBtnAuthText: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.accentText,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderWidth: 1.5,
    borderColor: Palette.ink,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
  },
  statusDivider: {
    width: 1.5,
    height: 14,
    backgroundColor: '#D1D5DB',
  },
  ctaCard: {
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 18,
    gap: 14,
    ...BrutalShadow.lg,
  },
  ctaCopy: {
    gap: 4,
  },
  ctaEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Palette.yellow,
    letterSpacing: 0.9,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Palette.accentText,
    lineHeight: 26,
  },
  ctaDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: '#FFF7ED',
    fontWeight: '500',
  },
  ctaButtonBox: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...BrutalShadow.sm,
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.ink,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
    ...BrutalShadow.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Palette.ink,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.ink,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Palette.ink,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.accent,
    textDecorationLine: 'underline',
  },
  stateBox: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 24,
    alignItems: 'center',
    gap: 8,
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
  emptyActionBtn: {
    marginTop: 6,
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyActionText: {
    color: Palette.accentText,
    fontSize: 12,
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.ink,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '800',
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
