import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  SampleImageItem,
  DraftAnalysisResponse,
  getSampleImages,
  analyzeReportDraftApi,
  createReportApi,
  resolveImageUrl,
  formatSeverityBadge,
  formatCategoryLabel,
  getAuthToken,
  loginOrRegisterDemoUser,
} from '@/services/api';

const FALLBACK_SAMPLES: SampleImageItem[] = [
  {
    id: 'rusak3.jpg',
    filename: 'rusak3.jpg',
    label: 'Lubang Jalan Parah & Genangan',
    image_url: '/samples/rusak3.jpg',
    address: 'Jl. D.I. Panjaitan No. 18, Jatinegara, Jakarta Timur',
    latitude: -6.2255,
    longitude: 106.871,
    description: 'Banyak kubangan lubang aspal dalam dan tergenang air di lajur kiri',
  },
  {
    id: 'rusak1.jpeg',
    filename: 'rusak1.jpeg',
    label: 'Lubang & Retak Permukaan',
    image_url: '/samples/rusak1.jpeg',
    address: 'Jl. Gajah Mada No. 12, Gambir, Jakarta Pusat',
    latitude: -6.1628,
    longitude: 106.8195,
    description: 'Lubang jalan cukup dalam dekat halte busway membahayakan pengendara motor',
  },
  {
    id: 'rusak2.jpg',
    filename: 'rusak2.jpg',
    label: 'Kerusakan & Pengelupasan Aspal',
    image_url: '/samples/rusak2.jpg',
    address: 'Jl. Gatot Subroto Kav. 32, Kuningan, Jakarta Selatan',
    latitude: -6.2349,
    longitude: 106.8236,
    description: 'Permukaan aspal mengelupas dan berlubang pasca hujan deras',
  },
  {
    id: 'road.jpg',
    filename: 'road.jpg',
    label: 'Jalan Mulus / Normal (Uji 0 Deteksi)',
    image_url: '/samples/road.jpg',
    address: 'Jl. M.H. Thamrin No. 1, Menteng, Jakarta Pusat',
    latitude: -6.1931,
    longitude: 106.823,
    description: 'Kondisi aspal mulus dan marka jalan terlihat rapi',
  },
];

export default function LaporScreen() {
  const [samples, setSamples] = useState<SampleImageItem[]>(FALLBACK_SAMPLES);
  const [selectedSample, setSelectedSample] = useState<string>('rusak3.jpg');
  const [webFile, setWebFile] = useState<File | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(
    resolveImageUrl('/samples/rusak3.jpg')
  );

  const [address, setAddress] = useState(FALLBACK_SAMPLES[0].address);
  const [latitude, setLatitude] = useState(String(FALLBACK_SAMPLES[0].latitude));
  const [longitude, setLongitude] = useState(String(FALLBACK_SAMPLES[0].longitude));
  const [userNotes, setUserNotes] = useState(FALLBACK_SAMPLES[0].description);

  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<DraftAnalysisResponse | null>(null);

  // State draf hasil AI yang dapat diedit warga sebelum dikirim
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftCategory, setDraftCategory] = useState('pothole');
  const [draftSeverity, setDraftSeverity] = useState<'low' | 'medium' | 'high'>('high');

  const [previewLayout, setPreviewLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    getSampleImages()
      .then((list) => {
        if (list && list.length > 0) {
          setSamples(list);
        }
      })
      .catch(() => {
        // Gunakan fallback samples
      });
  }, []);

  const handleSelectSample = (sample: SampleImageItem) => {
    setWebFile(null);
    setSelectedSample(sample.filename);
    setPreviewUri(resolveImageUrl(sample.image_url));
    setAddress(sample.address);
    setLatitude(String(sample.latitude));
    setLongitude(String(sample.longitude));
    setUserNotes(sample.description);
    setAnalysisData(null);
    setErrorMsg(null);
  };

  const handlePickWebFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        setWebFile(file);
        setSelectedSample('');
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
        },
        () => {
          setErrorMsg('Gagal mengakses GPS browser, menggunakan koordinat default Jakarta.');
        }
      );
    }
  };

  const ensureAuthenticated = async () => {
    if (!getAuthToken()) {
      await loginOrRegisterDemoUser();
    }
  };

  const handleAnalyzeWithAI = async () => {
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      await ensureAuthenticated();
      const result = await analyzeReportDraftApi({
        webFile,
        sampleImage: webFile ? null : selectedSample,
        latitude,
        longitude,
        address,
        description: userNotes,
        uploadImage: true,
      });
      setAnalysisData(result);
      setDraftTitle(result.draft.title);
      setDraftDesc(result.draft.description);
      setDraftCategory(result.draft.category);
      setDraftSeverity(result.draft.severity);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menjalankan analisis AI.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitReport = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await ensureAuthenticated();
      await createReportApi({
        title: analysisData ? draftTitle : undefined,
        description: analysisData ? draftDesc : userNotes,
        category: analysisData ? draftCategory : undefined,
        severity: analysisData ? draftSeverity : undefined,
        latitude,
        longitude,
        address,
        image_url: analysisData?.draft.image_url || (selectedSample ? `/samples/${selectedSample}` : undefined),
        ai_analysis: analysisData?.ai_analysis || null,
        status: analysisData?.draft.suggested_status || 'submitted',
        webFile: analysisData ? null : webFile,
        sampleImage: analysisData ? null : selectedSample || null,
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← KEMBALI</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>LAPOR JALAN RUSAK (AI)</Text>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

        {/* TAHAP 1: PILIH FOTO */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>1. FOTO KONDISI JALAN</Text>

          {Platform.OS === 'web' && (
            <TouchableOpacity style={styles.uploadFileBtn} onPress={handlePickWebFile}>
              <Text style={styles.uploadFileBtnText}>
                📷 {webFile ? `File Terpilih: ${webFile.name}` : 'UNGGAH FOTO DARI KOMPUTER'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.subLabel}>
            Atau klik salah satu sampel citra uji Road-AI di bawah ini:
          </Text>
          <View style={styles.sampleGrid}>
            {samples.map((s) => {
              const isSelected = !webFile && selectedSample === s.filename;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.sampleChip,
                    isSelected && styles.sampleChipSelected,
                  ]}
                  onPress={() => handleSelectSample(s)}>
                  <Text
                    style={[
                      styles.sampleChipTitle,
                      isSelected && { color: '#fff' },
                    ]}>
                    {s.filename}
                  </Text>
                  <Text
                    style={[
                      styles.sampleChipSub,
                      isSelected && { color: '#FEF3C7' },
                    ]}
                    numberOfLines={1}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preview Gambar + Overlay Bounding Box YOLO */}
          {previewUri && (
            <View
              style={styles.previewBox}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setPreviewLayout({ width, height });
              }}>
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="stretch"
              />
              {imgDims &&
                imgDims.width > 0 &&
                imgDims.height > 0 &&
                previewLayout.width > 0 &&
                detections.map((det) => {
                  const scaleX = previewLayout.width / imgDims.width;
                  const scaleY = previewLayout.height / imgDims.height;
                  const left = det.bounding_box.x1 * scaleX;
                  const top = det.bounding_box.y1 * scaleY;
                  const width = Math.max(
                    18,
                    (det.bounding_box.x2 - det.bounding_box.x1) * scaleX
                  );
                  const height = Math.max(
                    18,
                    (det.bounding_box.y2 - det.bounding_box.y1) * scaleY
                  );
                  return (
                    <View
                      key={det.detection_id}
                      style={[styles.bbox, { left, top, width, height }]}>
                      <View style={styles.bboxTag}>
                        <Text style={styles.bboxTagText}>
                          {det.class} {(det.confidence * 100).toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>

        {/* TAHAP 2: LOKASI & CATATAN WARGA */}
        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionHeader}>2. LOKASI & KETERANGAN</Text>
            {Platform.OS === 'web' && (
              <TouchableOpacity style={styles.gpsBtn} onPress={handleGetBrowserLocation}>
                <Text style={styles.gpsBtnText}>📍 GPS Saat Ini</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.inputLabel}>Alamat / Nama Jalan</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Contoh: Jl. D.I. Panjaitan No. 18, Jakarta Timur"
            placeholderTextColor="#666"
          />

          <View style={styles.coordRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Catatan Tambahan Warga (Opsional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 65 }]}
            value={userNotes}
            onChangeText={setUserNotes}
            multiline
            placeholder="Jelaskan kondisi jalan (misal: lubang tergenang air di lajur kiri)"
            placeholderTextColor="#666"
          />

          {/* Tombol Analisis AI */}
          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={handleAnalyzeWithAI}
            disabled={analyzing || submitting}>
            {analyzing ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.analyzeBtnText}>
                  MENGANALISIS FOTO DENGAN YOLO AI...
                </Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>
                🤖 1. ANALISIS AI (DETEKSI YOLO + SUSUN DRAF)
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* TAHAP 3: HASIL DETEKSI AI & KONFIRMASI DRAF */}
        {analysisData && (
          <View style={[styles.sectionCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.sectionHeader}>
              3. HASIL DETEKSI AI & DRAF LAPORAN
            </Text>

            <View style={styles.aiMetricsBox}>
              <Text style={styles.metricLine}>
                🔍 Status Road-AI YOLO:{' '}
                {analysisData.ai_analysis.vision_service_available
                  ? 'ONLINE (Deteksi Visual Aktif)'
                  : 'Mode Fallback Naratif Teks'}
              </Text>
              <Text style={styles.metricLine}>
                🎯 Total Titik Terdeteksi: {analysisData.ai_analysis.total_detections} titik
              </Text>
              <Text style={styles.metricLine}>
                📊 Akurasi (Confidence) Maks:{' '}
                {(analysisData.ai_analysis.max_confidence * 100).toFixed(1)}%
              </Text>
              <Text style={styles.metricLine}>
                🏷️ Klasifikasi Utama: {analysisData.ai_analysis.primary_damage_label}
              </Text>
              <Text style={styles.metricLine}>
                🚦 Rekomendasi Status:{' '}
                {analysisData.draft.suggested_status.toUpperCase()}{' '}
                {analysisData.draft.needs_manual_review
                  ? '(Perlu Tinjauan Moderator)'
                  : '(Siap Diproses Otomatis)'}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Judul Draf Laporan (Dapat Diedit)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#fff' }]}
              value={draftTitle}
              onChangeText={setDraftTitle}
            />

            <Text style={styles.inputLabel}>Deskripsi Naratif AI (Dapat Diedit)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#fff', minHeight: 90 }]}
              value={draftDesc}
              onChangeText={setDraftDesc}
              multiline
            />

            <Text style={styles.inputLabel}>Tingkat Keparahan (Severity)</Text>
            <View style={styles.severitySelector}>
              {(['low', 'medium', 'high'] as const).map((sev) => {
                const badge = formatSeverityBadge(sev);
                const active = draftSeverity === sev;
                return (
                  <TouchableOpacity
                    key={sev}
                    style={[
                      styles.sevOption,
                      { backgroundColor: active ? badge.bg : '#fff' },
                      active && { borderWidth: 3 },
                    ]}
                    onPress={() => setDraftSeverity(sev)}>
                    <Text
                      style={[
                        styles.sevOptionText,
                        { color: active ? badge.text : '#000' },
                      ]}>
                      {sev.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* TOMBOL KIRIM LAPORAN RESMI */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmitReport}
          disabled={submitting || analyzing}>
          {submitting ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.submitBtnText}>MENGIRIM LAPORAN...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>
              🚀 {analysisData ? '2. KONFIRMASI & KIRIM LAPORAN RESMI' : 'KIRIM LAPORAN SEKARANG'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5E00',
    paddingTop: 45,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderColor: '#000',
    gap: 12,
  },
  backBtn: {
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
  backBtnText: {
    fontWeight: '900',
    fontSize: 12,
    color: '#000',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  scrollArea: {
    padding: 18,
  },
  errorBanner: {
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
  sectionCard: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadFileBtn: {
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  uploadFileBtnText: {
    fontWeight: '900',
    fontSize: 13,
    color: '#000',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  sampleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sampleChip: {
    width: '48%',
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#000',
    padding: 8,
  },
  sampleChipSelected: {
    backgroundColor: '#FF5E00',
  },
  sampleChipTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  sampleChipSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  previewBox: {
    width: '100%',
    height: 220,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FF5E00',
    backgroundColor: 'rgba(255, 94, 0, 0.22)',
  },
  bboxTag: {
    backgroundColor: '#FF5E00',
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  bboxTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  gpsBtn: {
    backgroundColor: '#C1FF72',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 14,
    color: '#000',
    marginBottom: 12,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 10,
  },
  analyzeBtn: {
    backgroundColor: '#FF5E00',
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  analyzeBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiMetricsBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 12,
  },
  metricLine: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  severitySelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  sevOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
  },
  sevOptionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  submitBtn: {
    backgroundColor: '#C1FF72',
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
});

