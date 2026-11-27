import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Stack, router, useFocusEffect } from 'expo-router';

import { WebCameraModal } from '@/components/web-camera-modal';
import { YoloDetectionViewer } from '@/components/yolo-detection-viewer';
import { BrutalShadow, MaxContentWidth, Palette } from '@/constants/theme';
import {
  DraftAnalysisResponse,
  PickedImageFile,
  analyzeReportDraftApi,
  confirmDuplicateReportApi,
  createReportApi,
  fetchMyProfile,
  formatCategoryLabel,
  formatSeverityBadge,
  formatStatusBadge,
  getAuthToken,
  isAuthSessionError,
  reverseGeocodeApi,
  subscribeAuthChange,
  uploadImageApi,
} from '@/services/api';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const AUTO_UPLOAD_MAX_BYTES = 4.8 * 1024 * 1024;
const HARD_MAX_BYTES = 9.8 * 1024 * 1024;
const WEB_COMPRESS_THRESHOLD_BYTES = 350 * 1024;
const WEB_MAX_IMAGE_SIDE = 1600;
const WEB_JPEG_QUALITY = 0.82;
const SESSION_EXPIRED_FALLBACK_MSG =
  'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.';

const optimizeWebImageFile = async (file: File): Promise<File> => {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof globalThis.Image === 'undefined'
  ) {
    return file;
  }

  const normalizedType = (file.type || '').toLowerCase();
  const shouldOptimize =
    normalizedType === 'image/png' || file.size > WEB_COMPRESS_THRESHOLD_BYTES;
  if (!shouldOptimize) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new globalThis.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal memuat gambar'));
      el.src = objectUrl;
    });

    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    if (!srcWidth || !srcHeight) {
      return file;
    }

    const scale = Math.min(1, WEB_MAX_IMAGE_SIDE / Math.max(srcWidth, srcHeight));
    const needsResize = scale < 1;
    const isHeavyPng = normalizedType === 'image/png' && file.size > 150 * 1024;
    if (!needsResize && !isHeavyPng && file.size <= WEB_COMPRESS_THRESHOLD_BYTES) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcWidth * scale));
    canvas.height = Math.max(1, Math.round(srcHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', WEB_JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || `road-${Date.now()}`;
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export default function LaporScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<PickedImageFile | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [webCameraOpen, setWebCameraOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  const previewUriRef = useRef<string | null>(null);
  const uploadAttemptRef = useRef(0);

  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [userNotes, setUserNotes] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);
  const [gpsHint, setGpsHint] = useState<string | null>(null);
  const [confirmingDupId, setConfirmingDupId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<DraftAnalysisResponse | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftCategory, setDraftCategory] = useState('pothole');
  const [draftSeverity, setDraftSeverity] = useState<'low' | 'medium' | 'high'>('high');

  const handleSessionExpired = useCallback((message?: string) => {
    uploadAttemptRef.current += 1;
    setUploadStatus('idle');
    setUploadedImageUrl(null);
    setUploadStatusMsg(null);
    setErrorMsg(null);
    setIsAuthenticated(false);
    setSessionNotice(message || SESSION_EXPIRED_FALLBACK_MSG);
  }, []);

  useEffect(() => {
    return subscribeAuthChange((authenticated) => {
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setSessionNotice(null);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const hasToken = Boolean(getAuthToken());
      setIsAuthenticated(hasToken);
      if (!hasToken) return;

      setSessionNotice(null);
      void fetchMyProfile().catch((err) => {
        if (isAuthSessionError(err)) {
          handleSessionExpired(err.message);
        }
      });
    }, [handleSessionExpired])
  );

  useEffect(() => {
    return () => {
      if (
        Platform.OS === 'web' &&
        previewUriRef.current &&
        previewUriRef.current.startsWith('blob:')
      ) {
        URL.revokeObjectURL(previewUriRef.current);
      }
    };
  }, []);

  const autoUploadSelectedImage = async (picked: PickedImageFile) => {
    if (!getAuthToken()) {
      handleSessionExpired();
      return;
    }

    const attemptId = ++uploadAttemptRef.current;
    setUploadStatus('uploading');
    setUploadedImageUrl(null);
    setUploadStatusMsg('Mengunggah foto otomatis ke sistem...');

    try {
      const uploaded = await uploadImageApi(picked);
      if (uploadAttemptRef.current !== attemptId) return;
      setUploadedImageUrl(uploaded.url);
      setUploadStatus('uploaded');
      setUploadStatusMsg('Foto otomatis terunggah dan tersimpan di sistem.');
    } catch (err: any) {
      if (uploadAttemptRef.current !== attemptId) return;
      if (isAuthSessionError(err)) {
        handleSessionExpired(err.message);
        return;
      }
      setUploadStatus('error');
      setUploadStatusMsg(
        err?.message || 'Unggah otomatis gagal. Foto tetap siap dikirim atau coba unggah ulang.'
      );
    }
  };

  const applySelectedImage = (picked: PickedImageFile, shouldAutoUpload = true) => {
    if (
      Platform.OS === 'web' &&
      previewUriRef.current &&
      previewUriRef.current.startsWith('blob:') &&
      previewUriRef.current !== picked.uri
    ) {
      URL.revokeObjectURL(previewUriRef.current);
    }
    previewUriRef.current = picked.uri;
    setImageFile(picked);
    setPreviewUri(picked.uri);
    setAnalysisData(null);
    setUploadedImageUrl(null);
    setUploadStatus('idle');
    setUploadStatusMsg(null);

    if (shouldAutoUpload) {
      void autoUploadSelectedImage(picked);
    }
  };

  const handleWebCameraCapture = (picked: PickedImageFile) => {
    setWebCameraOpen(false);
    setErrorMsg(null);
    applySelectedImage(picked, true);
  };

  const handlePickImage = async (fromCamera = false) => {
    setErrorMsg(null);

    if (Platform.OS === 'web') {
      if (fromCamera) {
        setWebCameraOpen(true);
        return;
      }

      if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.onchange = async (e: any) => {
          const rawFile: File | undefined = e.target?.files?.[0];
          if (!rawFile) return;

          const optimizedFile = await optimizeWebImageFile(rawFile);
          if (optimizedFile.size > HARD_MAX_BYTES) {
            setErrorMsg(
              'Ukuran foto melebihi batas 10 MB. Pilih foto lain yang lebih kecil.'
            );
            return;
          }

          const uri = URL.createObjectURL(optimizedFile);
          applySelectedImage(
            {
              uri,
              name: optimizedFile.name,
              type: optimizedFile.type || 'image/jpeg',
              webFile: optimizedFile,
            },
            optimizedFile.size <= AUTO_UPLOAD_MAX_BYTES
          );
        };
        input.click();
        return;
      }
    }

    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      setErrorMsg(
        fromCamera
          ? 'Izin kamera ditolak. Aktifkan izin kamera pada pengaturan perangkat.'
          : 'Izin akses galeri foto ditolak. Aktifkan izin foto pada pengaturan perangkat.'
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.6,
          exif: false,
          cameraType: ImagePicker.CameraType.back,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          exif: false,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `road-${Date.now()}.jpg`;
      const inferredType =
        asset.mimeType && asset.mimeType.startsWith('image/')
          ? asset.mimeType.toLowerCase()
          : name.toLowerCase().endsWith('.png')
            ? 'image/png'
            : name.toLowerCase().endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      const normalizedType = inferredType === 'image/jpg' ? 'image/jpeg' : inferredType;

      if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedType)) {
        setErrorMsg(
          `Format foto (${normalizedType}) belum didukung. Gunakan foto berformat JPG, PNG, atau WEBP.`
        );
        return;
      }

      if (asset.fileSize && asset.fileSize > HARD_MAX_BYTES) {
        setErrorMsg(
          'Ukuran foto melebihi batas 10 MB. Pilih foto lain atau gunakan resolusi kamera yang lebih rendah.'
        );
        return;
      }

      const shouldAutoUpload = !asset.fileSize || asset.fileSize <= AUTO_UPLOAD_MAX_BYTES;
      applySelectedImage({ uri: asset.uri, name, type: normalizedType }, shouldAutoUpload);
    }
  };

  const formatNativeGeoAddress = (place: Location.LocationGeocodedAddress): string | null => {
    const streetPart =
      place.street && place.streetNumber
        ? `${place.street} No. ${place.streetNumber}`
        : place.street || place.name || null;
    const parts: string[] = [];
    for (const part of [streetPart, place.district, place.subregion || place.city]) {
      if (part && !parts.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
        parts.push(part);
      }
    }
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const applyCoordinatesAndAddress = async (latNum: number, lngNum: number) => {
    setLatitude(latNum.toFixed(6));
    setLongitude(lngNum.toFixed(6));

    const shouldAutoFillAddress = !address.trim() || addressAutoFilled;
    if (!shouldAutoFillAddress) {
      setGpsHint('Koordinat GPS diperbarui (alamat manual Anda tetap dipertahankan).');
      return;
    }

    let resolvedAddress: string | null = null;

    if (Platform.OS !== 'web') {
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: latNum,
          longitude: lngNum,
        });
        if (places && places.length > 0) {
          resolvedAddress = formatNativeGeoAddress(places[0]);
        }
      } catch {
        // Fallback ke endpoint backend di bawah
      }
    }

    if (!resolvedAddress) {
      try {
        const geo = await reverseGeocodeApi(latNum, lngNum);
        if (geo.available && geo.address) {
          resolvedAddress = geo.address;
        }
      } catch {
        // Biarkan pengguna mengisi alamat secara manual jika gagal
      }
    }

    if (resolvedAddress) {
      setAddress(resolvedAddress);
      setAddressAutoFilled(true);
      setGpsHint('Alamat terisi otomatis dari GPS — silakan sunting atau tambahkan patokan bila perlu.');
    } else {
      setGpsHint('Koordinat GPS terisi, tetapi nama jalan otomatis belum tersedia. Silakan isi alamat secara manual.');
    }
  };

  const handleGetLocation = async () => {
    setErrorMsg(null);
    setGpsHint(null);
    setLocating(true);

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await applyCoordinatesAndAddress(pos.coords.latitude, pos.coords.longitude);
          } finally {
            setLocating(false);
          }
        },
        () => {
          setLocating(false);
          setErrorMsg('Akses lokasi browser ditolak. Silakan isi koordinat dan alamat secara manual.');
        }
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Izin lokasi ditolak. Silakan isi Latitude, Longitude, dan alamat secara manual.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await applyCoordinatesAndAddress(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setErrorMsg('Gagal mengambil lokasi GPS. Silakan isi koordinat dan alamat secara manual.');
    } finally {
      setLocating(false);
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
      handleSessionExpired();
      return;
    }
    if (!imageFile) {
      setErrorMsg('Silakan pilih atau unggah foto kondisi jalan terlebih dahulu.');
      return;
    }
    if (uploadStatus === 'uploading') {
      setErrorMsg('Tunggu sebentar hingga unggahan foto otomatis selesai.');
      return;
    }
    if (!validateLocationFields()) return;

    setAnalyzing(true);
    try {
      const result = await analyzeReportDraftApi({
        imageFile,
        latitude,
        longitude,
        address: address.trim(),
        description: userNotes.trim(),
        imageUrl: uploadedImageUrl,
        uploadImage: !uploadedImageUrl,
      });
      setAnalysisData(result);
      setDraftTitle(result.draft.title);
      setDraftDesc(result.draft.description);
      setDraftCategory(result.draft.category);
      setDraftSeverity(result.draft.severity);
    } catch (err: any) {
      if (isAuthSessionError(err)) {
        handleSessionExpired(err.message);
        return;
      }
      setErrorMsg(err.message || 'Gagal menjalankan analisis foto.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitReport = async () => {
    setErrorMsg(null);
    if (!getAuthToken()) {
      handleSessionExpired();
      return;
    }
    if (!imageFile && !analysisData?.draft.image_url && !uploadedImageUrl) {
      setErrorMsg('Silakan unggah foto kondisi jalan terlebih dahulu sebelum mengirim laporan.');
      return;
    }
    if (uploadStatus === 'uploading') {
      setErrorMsg('Tunggu sebentar hingga unggahan foto otomatis selesai.');
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
        image_url: analysisData?.draft.image_url || uploadedImageUrl || undefined,
        ai_analysis: analysisData?.ai_analysis || null,
        status: analysisData?.draft.suggested_status || 'submitted',
        imageFile: analysisData ? null : imageFile,
      });
      router.replace('/riwayat' as any);
    } catch (err: any) {
      if (isAuthSessionError(err)) {
        handleSessionExpired(err.message);
        return;
      }
      setErrorMsg(err.message || 'Gagal mengirim laporan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDuplicate = async (reportId: string) => {
    setErrorMsg(null);
    if (!getAuthToken()) {
      handleSessionExpired();
      return;
    }
    setConfirmingDupId(reportId);
    try {
      await confirmDuplicateReportApi(
        reportId,
        userNotes.trim()
          ? `Konfirmasi warga di lokasi yang sama: "${userNotes.trim()}"`
          : undefined
      );
      router.replace('/riwayat' as any);
    } catch (err: any) {
      if (isAuthSessionError(err)) {
        handleSessionExpired(err.message);
        return;
      }
      setErrorMsg(err.message || 'Gagal mengonfirmasi laporan duplikat.');
    } finally {
      setConfirmingDupId(null);
    }
  };

  const detections = analysisData?.ai_analysis?.detections || [];
  const imgDims = analysisData?.ai_analysis?.image_dimensions;
  const locationContext =
    analysisData?.draft?.location_context || analysisData?.ai_analysis?.location_context;
  const possibleDuplicates =
    analysisData?.draft?.possible_duplicates ||
    analysisData?.ai_analysis?.possible_duplicates ||
    [];
  const recommendedStatus = analysisData
    ? formatStatusBadge(analysisData.draft.suggested_status)
    : null;

  const bottomPadding = 24;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Bar */}
      <View style={styles.topBarWrap}>
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/beranda' as any);
              }
            }}>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {!isAuthenticated ? (
            <View style={styles.authGateCard}>
              {sessionNotice && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorTitle}>Sesi Berakhir</Text>
                  <Text style={styles.errorText}>{sessionNotice}</Text>
                </View>
              )}
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

                <View style={styles.uploadRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.uploadBtn, { flex: 1, marginBottom: 0 }]}
                    onPress={() => handlePickImage(false)}
                    disabled={uploadStatus === 'uploading'}>
                    <Text style={styles.uploadBtnText} numberOfLines={1}>
                      {imageFile ? `Ganti Foto (${imageFile.name})` : 'Pilih Foto Kondisi Jalan'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.cameraBtn, uploadStatus === 'uploading' && styles.btnDisabled]}
                    onPress={() => handlePickImage(true)}
                    disabled={uploadStatus === 'uploading'}>
                    <Text style={styles.uploadBtnText}>
                      {Platform.OS === 'web' ? 'Kamera Web' : 'Kamera'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {previewUri ? (
                  <View style={styles.previewWrap}>
                    <View style={styles.previewBox}>
                      <Image
                        source={{ uri: previewUri }}
                        style={styles.previewImage}
                        resizeMode="cover"
                      />
                    </View>

                    {uploadStatus !== 'idle' && (
                      <View
                        style={[
                          styles.uploadStatusBox,
                          uploadStatus === 'uploaded' && styles.uploadStatusSuccess,
                          uploadStatus === 'error' && styles.uploadStatusError,
                        ]}>
                        <View style={styles.uploadStatusRow}>
                          {uploadStatus === 'uploading' && (
                            <ActivityIndicator size="small" color={Palette.ink} />
                          )}
                          <Text style={styles.uploadStatusText}>{uploadStatusMsg}</Text>
                        </View>
                        {uploadStatus === 'error' && imageFile && (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.retryUploadBtn}
                            onPress={() => autoUploadSelectedImage(imageFile)}>
                            <Text style={styles.retryUploadBtnText}>Coba Unggah Ulang</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

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
                      Pilih gambar dari perangkat atau gunakan kamera untuk memfoto langsung dan mengunggah otomatis ke sistem.
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

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.gpsBtn, locating && styles.btnDisabled]}
                    onPress={handleGetLocation}
                    disabled={locating}>
                    <Text style={styles.gpsBtnText}>
                      {locating ? 'Mencari GPS...' : 'Gunakan GPS'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Alamat atau Patokan Jalan</Text>
                <TextInput
                  style={[styles.input, gpsHint ? { marginBottom: 5 } : null]}
                  value={address}
                  onChangeText={(text: string) => {
                    setAddress(text);
                    setAddressAutoFilled(text.trim() === '');
                  }}
                  placeholder="Masukkan nama jalan atau klik Gunakan GPS"
                  placeholderTextColor={Palette.inkSubtle}
                />
                {gpsHint && <Text style={styles.gpsHintText}>{gpsHint}</Text>}

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
                    {analysisData.draft.priority_score !== undefined && (
                      <View style={styles.metricCell}>
                        <Text style={styles.metricLabel}>Skor Prioritas</Text>
                        <Text style={styles.metricValue}>
                          {analysisData.draft.priority_score}/100
                        </Text>
                      </View>
                    )}
                    {locationContext && (
                      <View style={styles.metricCell}>
                        <Text style={styles.metricLabel}>Lokasi Strategis</Text>
                        <Text style={styles.metricValue} numberOfLines={1}>
                          {locationContext.strategic_score}/100 ({locationContext.road_class_label})
                        </Text>
                      </View>
                    )}
                  </View>

                  {locationContext && (
                    <View style={styles.locationIntelBox}>
                      <Text style={styles.locationIntelTitle}>
                        Konteks Lokasi: {locationContext.detected_region} · Kepadatan{' '}
                        {locationContext.population_density_tier === 'high'
                          ? 'Tinggi'
                          : locationContext.population_density_tier === 'medium'
                            ? 'Sedang'
                            : 'Rendah'}
                      </Text>
                      <Text style={styles.locationIntelSub}>
                        {locationContext.nearby_vital_facilities?.length > 0
                          ? `Dekat fasilitas vital: ${locationContext.nearby_vital_facilities.join(', ')}.`
                          : 'Tidak ada fasilitas vital radius 300m yang terdeteksi.'}{' '}
                        Laporan sekitar (150m): {locationContext.nearby_report_count} laporan.
                      </Text>
                      {analysisData.draft.severity_adjusted &&
                        analysisData.draft.severity_adjustment_reason && (
                          <Text style={styles.severityBoostNote}>
                            {analysisData.draft.severity_adjustment_reason}
                          </Text>
                        )}
                    </View>
                  )}

                  {possibleDuplicates.length > 0 && (
                    <View style={styles.duplicateCard}>
                      <Text style={styles.duplicateEyebrow}>
                        KEMUNGKINAN DUPLIKAT TERDETEKSI ({possibleDuplicates.length})
                      </Text>
                      <Text style={styles.duplicateDesc}>
                        Sudah ada laporan aktif dalam radius 35m dari titik ini. Anda dapat
                        mengonfirmasi laporan yang sama untuk menaikkan prioritasnya, atau tetap
                        kirim sebagai laporan terpisah.
                      </Text>
                      {possibleDuplicates.slice(0, 2).map((dup) => (
                        <View key={dup.id} style={styles.duplicateItem}>
                          <Text style={styles.duplicateTitle} numberOfLines={1}>
                            {dup.title}
                          </Text>
                          <Text style={styles.duplicateMeta}>
                            Jarak {dup.distance_meters} m · {dup.support_count} pelapor · Status:{' '}
                            {formatStatusBadge(dup.status).label}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                              styles.duplicateBtn,
                              confirmingDupId === dup.id && styles.btnDisabled,
                            ]}
                            onPress={() => handleConfirmDuplicate(dup.id)}
                            disabled={Boolean(confirmingDupId)}>
                            <Text style={styles.duplicateBtnText}>
                              {confirmingDupId === dup.id
                                ? 'Mengonfirmasi...'
                                : 'Konfirmasi Laporan yang Sama (+1 Dukungan)'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

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
      </KeyboardAvoidingView>
      {Platform.OS === 'web' && (
        <WebCameraModal
          visible={webCameraOpen}
          onClose={() => setWebCameraOpen(false)}
          onCapture={handleWebCameraCapture}
        />
      )}
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
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
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
  cameraBtn: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  uploadStatusBox: {
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  uploadStatusSuccess: {
    backgroundColor: Palette.success,
  },
  uploadStatusError: {
    backgroundColor: Palette.danger,
  },
  uploadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  retryUploadBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retryUploadBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
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
  gpsHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.inkMuted,
    marginBottom: 12,
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
    width: '48%',
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
  locationIntelBox: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
    gap: 4,
    marginBottom: 12,
  },
  locationIntelTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.ink,
  },
  locationIntelSub: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  severityBoostNote: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: Palette.accent,
  },
  duplicateCard: {
    backgroundColor: Palette.pending,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 12,
    gap: 8,
    marginBottom: 14,
    ...BrutalShadow.sm,
  },
  duplicateEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
    letterSpacing: 0.4,
  },
  duplicateDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: Palette.ink,
  },
  duplicateItem: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
    gap: 4,
  },
  duplicateTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.ink,
  },
  duplicateMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.inkMuted,
  },
  duplicateBtn: {
    marginTop: 4,
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  duplicateBtnText: {
    fontSize: 12,
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
