import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { YoloDetectionViewer } from '@/components/yolo-detection-viewer';
import { BrutalShadow, MaxContentWidth, Palette } from '@/constants/theme';
import {
  DraftAnalysisResponse,
  analyzeReportDraftApi,
  createReportApi,
  formatCategoryLabel,
  formatSeverityBadge,
  formatStatusBadge,
  getAuthToken,
} from '@/services/api';

export default function LaporScreen() {
  const isAuthenticated = Boolean(getAuthToken());

  const [webFile, setWebFile] = useState<File | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [userNotes, setUserNotes] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<DraftAnalysisResponse | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftCategory, setDraftCategory] = useState('pothole');
  const [draftSeverity, setDraftSeverity] = useState<'low' | 'medium' | 'high'>('high');

  const handlePickWebFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        setWebFile(file);
        setPreviewUri(URL.createObjectURL(file));
        setAnalysisData(null);
        setErrorMsg(null);
      }
    };
    input.click();
  };

  const handleGetBrowserLocation = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toFixed(6));
          setLongitude(pos.coords.longitude.toFixed(6));
          setErrorMsg(null);
        },
        () => {
          setErrorMsg('Akses lokasi browser ditolak. Silakan isi koordinat secara manual.');
        }
      );
    }
  };

  const validateLocationFields = (): boolean => {
    if (!address.trim()) {
      setErrorMsg('Alamat atau patokan jalan wajib diisi.');
      return false;
    }
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setErrorMsg('Koordinat lokasi wajib diisi. Gunakan tombol GPS atau isi Latitude & Longitude.');
      return false;
    }
    return true;
  };

  const handleAnalyzeWithAI = async () => {
    setErrorMsg(null);
    if (!getAuthToken()) {
      router.replace('/signup?mode=login' as any);
      return;
    }
    if (!webFile) {
      setErrorMsg('Silakan pilih atau unggah foto kondisi jalan terlebih dahulu.');
      return;
    }
    if (!validateLocationFields()) return;

    setAnalyzing(true);
    try {
      const result = await analyzeReportDraftApi({
        webFile,
        latitude,
        longitude,
        address: address.trim(),
        description: userNotes.trim(),
        uploadImage: true,
      });
      setAnalysisData(result);
      setDraftTitle(result.draft.title);
      setDraftDesc(result.draft.description);
      setDraftCategory(result.draft.category);
      setDraftSeverity(result.draft.severity);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menjalankan analisis foto.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitReport = async () => {
    setErrorMsg(null);
    if (!getAuthToken()) {
      router.replace('/signup?mode=login' as any);
      return;
    }
    if (!webFile && !analysisData?.draft.image_url) {
      setErrorMsg('Silakan unggah foto kondisi jalan terlebih dahulu sebelum mengirim laporan.');
      return;
    }
    if (!validateLocationFields()) return;

    setSubmitting(true);
    try {
      await createReportApi({
        title: analysisData ? draftTitle : undefined,
        description: analysisData ? draftDesc : userNotes.trim(),
        category: analysisData ? draftCategory : undefined,
        severity: analysisData ? draftSeverity : undefined,
        latitude,
        longitude,
        address: address.trim(),
        image_url: analysisData?.draft.image_url || undefined,
        ai_analysis: analysisData?.ai_analysis || null,
        status: analysisData?.draft.suggested_status || 'submitted',
        webFile: analysisData ? null : webFile,
      });
      router.replace('/riwayat' as any);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim laporan.');
    } finally {
      setSubmitting(false);
    }
  };

  const detections = analysisData?.ai_analysis?.detections || [];
  const imgDims = analysisData?.ai_analysis?.image_dimensions;
  const recommendedStatus = analysisData
    ? formatStatusBadge(analysisData.draft.suggested_status)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Bar */}
      <View style={styles.topBarWrap}>
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backBtn}
            onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
          <View style={styles.topBarCopy}>
            <Text style={styles.topBarTitle}>Buat Laporan Jalan</Text>
          </View>
          {isAuthenticated && (
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>
                {analysisData ? 'Langkah 3/3' : 'Langkah 1-2'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {!isAuthenticated ? (
            <View style={styles.authGateCard}>
              <View style={styles.authGateTag}>
                <Text style={styles.authGateTagText}>AKSES TERDAFTAR</Text>
              </View>
              <Text style={styles.authGateTitle}>
                Daftar atau Masuk Terlebih Dahulu
              </Text>
              <Text style={styles.authGateDesc}>
                Untuk menjaga keaslian laporan dan memudahkan pemantauan tindak lanjut di lapangan,
                warga perlu mendaftar dan masuk ke akun sebelum membuat laporan kerusakan jalan.
              </Text>

              <View style={styles.authGateActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.authPrimaryBtn}
                  onPress={() => router.push('/signup?mode=signup' as any)}>
                  <Text style={styles.authPrimaryBtnText}>Daftar Akun Warga</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.authSecondaryBtn}
                  onPress={() => router.push('/signup?mode=login' as any)}>
                  <Text style={styles.authSecondaryBtnText}>Sudah Punya Akun? Masuk</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {errorMsg && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorTitle}>Perhatian</Text>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {/* Langkah 1: Foto */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>01</Text>
                  </View>
                  <View style={styles.cardHeaderCopy}>
                    <Text style={styles.cardTitle}>Dokumentasi Foto Jalan</Text>
                    <Text style={styles.cardSub}>
                      Unggah foto kerusakan jalan dari perangkat Anda (format JPG, PNG, atau WEBP).
                    </Text>
                  </View>
                </View>

                {Platform.OS === 'web' ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.uploadBtn}
                    onPress={handlePickWebFile}>
                    <Text style={styles.uploadBtnText}>
                      {webFile ? `Ganti Foto (${webFile.name})` : 'Pilih Foto Kondisi Jalan'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.platformNotice}>
                    <Text style={styles.platformNoticeText}>
                      Unggah foto langsung tersedia melalui akses peramban web pada perangkat ini.
                    </Text>
                  </View>
                )}

                {previewUri ? (
                  <View style={styles.previewWrap}>
                    <View style={styles.previewBox}>
                      <Image
                        source={{ uri: previewUri }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={styles.previewHint}>
                      {analysisData
                        ? 'Foto telah dianalisis. Lihat kotak deteksi dan akurasi YOLO pada Langkah 03 di bawah.'
                        : 'Foto siap dianalisis. Lanjutkan isi lokasi dan jalankan analisis pada Langkah 02.'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyPreviewBox}>
                    <Text style={styles.emptyPreviewTitle}>Belum ada foto dipilih</Text>
                    <Text style={styles.emptyPreviewSub}>
                      Pratinjau foto akan tampil di sini sebelum dianalisis.
                    </Text>
                  </View>
                )}
              </View>

              {/* Langkah 2: Lokasi & Keterangan */}
              <View style={styles.card}>
                <View style={styles.cardHeaderBetween}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>02</Text>
                    </View>
                    <View style={styles.cardHeaderCopy}>
                      <Text style={styles.cardTitle}>Lokasi & Catatan Lapangan</Text>
                      <Text style={styles.cardSub}>
                        Isi alamat jalan serta titik koordinat lokasi kerusakan.
                      </Text>
                    </View>
                  </View>

                  {Platform.OS === 'web' && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.gpsBtn}
                      onPress={handleGetBrowserLocation}>
                      <Text style={styles.gpsBtnText}>Gunakan GPS</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.inputLabel}>Alamat atau Patokan Jalan</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Masukkan nama jalan, nomor, dan kelurahan/kecamatan"
                  placeholderTextColor={Palette.inkSubtle}
                />

                <View style={styles.coordRow}>
                  <View style={styles.coordCol}>
                    <Text style={styles.inputLabel}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      value={latitude}
                      onChangeText={setLatitude}
                      placeholder="-6.200000"
                      placeholderTextColor={Palette.inkSubtle}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.coordCol}>
                    <Text style={styles.inputLabel}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      value={longitude}
                      onChangeText={setLongitude}
                      placeholder="106.816666"
                      placeholderTextColor={Palette.inkSubtle}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Keterangan Tambahan (Opsional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={userNotes}
                  onChangeText={setUserNotes}
                  multiline
                  placeholder="Jelaskan kondisi sekitar, misalnya lubang cukup dalam di lajur kiri"
                  placeholderTextColor={Palette.inkSubtle}
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.analyzeBtn, (analyzing || submitting) && styles.btnDisabled]}
                  onPress={handleAnalyzeWithAI}
                  disabled={analyzing || submitting}>
                  {analyzing ? (
                    <View style={styles.btnRow}>
                      <ActivityIndicator size="small" color={Palette.accentText} />
                      <Text style={styles.analyzeBtnText}>
                        Menganalisis foto dan menyusun draf...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.analyzeBtnText}>
                      Analisis Foto & Susun Draf Laporan
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Langkah 3: Hasil Analisis & Edit Draf */}
              {analysisData && (
                <View style={[styles.card, styles.reviewCard]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: Palette.accent }]}>
                      <Text style={[styles.stepBadgeText, { color: Palette.accentText }]}>03</Text>
                    </View>
                    <View style={styles.cardHeaderCopy}>
                      <Text style={styles.cardTitle}>Tinjau Hasil Analisis & Draf</Text>
                      <Text style={styles.cardSub}>
                        Periksa dan sesuaikan isi draf sebelum dikirim ke sistem.
                      </Text>
                    </View>
                  </View>

                  {previewUri && (
                    <View style={{ marginBottom: 14 }}>
                      <YoloDetectionViewer
                        imageUri={previewUri}
                        detections={detections}
                        imageDimensions={imgDims}
                        visionAvailable={Boolean(analysisData.ai_analysis.vision_service_available)}
                        analyzed
                      />
                    </View>
                  )}

                  <View style={styles.metricsGrid}>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricLabel}>Deteksi Visual</Text>
                      <Text style={styles.metricValue}>
                        {analysisData.ai_analysis.vision_service_available
                          ? 'Aktif'
                          : 'Ringkasan Teks'}
                      </Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricLabel}>Titik Kerusakan</Text>
                      <Text style={styles.metricValue}>
                        {analysisData.ai_analysis.total_detections} titik
                      </Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricLabel}>Keyakinan Maks</Text>
                      <Text style={styles.metricValue}>
                        {(analysisData.ai_analysis.max_confidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricLabel}>Klasifikasi</Text>
                      <Text style={styles.metricValue} numberOfLines={1}>
                        {formatCategoryLabel(
                          analysisData.draft.category ||
                            analysisData.ai_analysis.primary_damage_label
                        )}
                      </Text>
                    </View>
                  </View>

                  {recommendedStatus && (
                    <View style={styles.recommendRow}>
                      <Text style={styles.recommendLabel}>Rekomendasi Alur:</Text>
                      <View style={[styles.recBadge, { backgroundColor: recommendedStatus.bg }]}>
                        <Text style={[styles.recBadgeText, { color: recommendedStatus.text }]}>
                          {recommendedStatus.label}
                        </Text>
                      </View>
                      <Text style={styles.recommendNote}>
                        {analysisData.draft.needs_manual_review
                          ? 'Perlu tinjauan petugas'
                          : 'Siap diteruskan'}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Judul Laporan</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: Palette.surface }]}
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                  />

                  <Text style={styles.inputLabel}>Deskripsi Laporan</Text>
                  <TextInput
                    style={[styles.input, styles.textAreaLg, { backgroundColor: Palette.surface }]}
                    value={draftDesc}
                    onChangeText={setDraftDesc}
                    multiline
                  />

                  <Text style={styles.inputLabel}>Tingkat Keparahan</Text>
                  <View style={styles.severitySelector}>
                    {(['low', 'medium', 'high'] as const).map((sev) => {
                      const badge = formatSeverityBadge(sev);
                      const active = draftSeverity === sev;
                      return (
                        <TouchableOpacity
                          key={sev}
                          activeOpacity={0.85}
                          style={[
                            styles.sevOption,
                            { backgroundColor: active ? badge.bg : Palette.surface },
                            active && styles.sevOptionActive,
                          ]}
                          onPress={() => setDraftSeverity(sev)}>
                          <Text
                            style={[
                              styles.sevOptionText,
                              { color: active ? badge.text : Palette.ink },
                            ]}>
                            {badge.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.submitBtn, (submitting || analyzing) && styles.btnDisabled]}
                onPress={handleSubmitReport}
                disabled={submitting || analyzing}>
                {submitting ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color={Palette.ink} />
                    <Text style={styles.submitBtnText}>Mengirim laporan...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitBtnText}>
                    {analysisData
                      ? 'Konfirmasi dan Kirim Laporan'
                      : 'Kirim Laporan Tanpa Analisis'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  topBarWrap: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 2.5,
    borderBottomColor: Palette.ink,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 11,
    paddingVertical: 6,
    ...BrutalShadow.sm,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  topBarCopy: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Palette.ink,
  },
  stepPill: {
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: 16,
  },
  authGateCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 22,
    gap: 12,
    marginTop: 12,
    ...BrutalShadow.lg,
  },
  authGateTag: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  authGateTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: Palette.ink,
    letterSpacing: 0.8,
  },
  authGateTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Palette.ink,
    lineHeight: 28,
  },
  authGateDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: Palette.inkMuted,
  },
  authGateActions: {
    gap: 10,
    marginTop: 6,
  },
  authPrimaryBtn: {
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingVertical: 13,
    alignItems: 'center',
    ...BrutalShadow.md,
  },
  authPrimaryBtnText: {
    color: Palette.accentText,
    fontSize: 14,
    fontWeight: '900',
  },
  authSecondaryBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authSecondaryBtnText: {
    color: Palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    gap: 2,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: Palette.ink,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  card: {
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 16,
    ...BrutalShadow.md,
  },
  reviewCard: {
    backgroundColor: Palette.highlight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 30,
    height: 30,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: Palette.yellow,
    fontSize: 12,
    fontWeight: '900',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Palette.ink,
  },
  cardSub: {
    fontSize: 12,
    color: Palette.inkMuted,
    lineHeight: 17,
  },
  uploadBtn: {
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 14,
    ...BrutalShadow.sm,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.ink,
  },
  platformNotice: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    marginBottom: 14,
  },
  platformNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.inkMuted,
  },
  emptyPreviewBox: {
    width: '100%',
    height: 150,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Palette.ink,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 4,
  },
  emptyPreviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Palette.ink,
  },
  emptyPreviewSub: {
    fontSize: 12,
    color: Palette.inkMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  previewWrap: {
    gap: 8,
  },
  previewBox: {
    width: '100%',
    height: 220,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    backgroundColor: Palette.ink,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewHint: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  gpsBtn: {
    backgroundColor: Palette.success,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 11,
    paddingVertical: 10,
    fontSize: 14,
    color: Palette.ink,
    fontWeight: '600',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  textAreaLg: {
    minHeight: 94,
    textAlignVertical: 'top',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordCol: {
    flex: 1,
  },
  analyzeBtn: {
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 4,
    ...BrutalShadow.md,
  },
  analyzeBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: Palette.accentText,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricCell: {
    width: '48.5%',
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Palette.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    color: Palette.ink,
  },
  recommendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
    marginBottom: 14,
  },
  recommendLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  recBadge: {
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  recommendNote: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  severitySelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  sevOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sevOptionActive: {
    ...BrutalShadow.sm,
  },
  sevOptionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  submitBtn: {
    backgroundColor: Palette.success,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingVertical: 15,
    alignItems: 'center',
    ...BrutalShadow.lg,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: Palette.ink,
  },
});
