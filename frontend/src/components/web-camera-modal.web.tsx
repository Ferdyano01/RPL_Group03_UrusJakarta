import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrutalShadow, Palette } from '@/constants/theme';
import type { PickedImageFile } from '@/services/api';
import type { WebCameraModalProps } from './web-camera-modal';

const MAX_CAPTURE_SIDE = 1600;
const JPEG_QUALITY = 0.85;

const getCameraErrorMessage = (err: unknown): string => {
  const name = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Izin kamera ditolak oleh browser. Klik ikon kamera/gembok pada bilah alamat browser untuk mengizinkan akses kamera.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kamera tidak ditemukan pada perangkat ini.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
  }
  if (name === 'OverconstrainedError') {
    return 'Pengaturan kamera tidak didukung perangkat ini.';
  }
  return 'Gagal mengakses kamera browser. Pastikan situs diakses melalui HTTPS atau localhost.';
};

export function WebCameraModal({ visible, onClose, onCapture }: WebCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(
    async (preferredFacing: 'environment' | 'user') => {
      stopStream();
      setCameraError(null);
      setStarting(true);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setStarting(false);
        setCameraError(
          'Browser tidak mendukung akses kamera atau halaman tidak dibuka melalui HTTPS / localhost.'
        );
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: preferredFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (constraintErr) {
          // Fallback ke kamera default jika facingMode spesifik gagal
          if ((constraintErr as { name?: string })?.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw constraintErr;
          }
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setCameraReady(true);
        }
      } catch (err) {
        setCameraError(getCameraErrorMessage(err));
      } finally {
        setStarting(false);
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (visible) {
      startCamera(facingMode);
    } else {
      stopStream();
      setCameraError(null);
    }

    return () => {
      stopStream();
    };
  }, [visible, facingMode, startCamera, stopStream]);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleToggleFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturing) {
      return;
    }

    setCapturing(true);
    setCameraError(null);

    try {
      const srcWidth = video.videoWidth;
      const srcHeight = video.videoHeight;
      const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(srcWidth, srcHeight));
      const targetWidth = Math.round(srcWidth * scale);
      const targetHeight = Math.round(srcHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas tidak tersedia');
      }

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          setCapturing(false);
          if (!blob) {
            setCameraError('Gagal memproses hasil foto kamera. Silakan coba lagi.');
            return;
          }

          const fileName = `road-cam-${Date.now()}.jpg`;
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          const uri = URL.createObjectURL(file);

          stopStream();
          onCapture({
            uri,
            name: fileName,
            type: 'image/jpeg',
            webFile: file,
          });
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    } catch {
      setCapturing(false);
      setCameraError('Gagal mengambil gambar dari kamera.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>KAMERA WEB</Text>
              <Text style={styles.title}>Ambil Foto Kondisi Jalan</Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.viewport}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: cameraError ? 'none' : 'block',
              }}
            />

            {starting && (
              <View style={styles.overlayState}>
                <ActivityIndicator size="large" color={Palette.yellow} />
                <Text style={styles.overlayText}>Meminta izin dan menyalakan kamera...</Text>
              </View>
            )}

            {cameraError && !starting && (
              <View style={styles.overlayState}>
                <Text style={styles.errorTitle}>Kamera Tidak Dapat Diakses</Text>
                <Text style={styles.errorText}>{cameraError}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.retryBtn}
                  onPress={() => startCamera(facingMode)}>
                  <Text style={styles.retryBtnText}>Coba Lagi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.hintText}>
            Setelah dijepret, foto akan langsung terunggah otomatis ke sistem sebelum dianalisis.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.switchBtn}
              onPress={handleToggleFacing}
              disabled={starting || capturing}>
              <Text style={styles.switchBtnText}>
                {facingMode === 'environment' ? 'Kamera Depan' : 'Kamera Belakang'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.shutterBtn,
                (!cameraReady || starting || capturing || Boolean(cameraError)) &&
                  styles.btnDisabled,
              ]}
              onPress={handleTakePhoto}
              disabled={!cameraReady || starting || capturing || Boolean(cameraError)}>
              <Text style={styles.shutterBtnText}>
                {capturing ? 'Memproses...' : 'Ambil & Unggah Foto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: Palette.surface,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    padding: 16,
    gap: 12,
    ...BrutalShadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Palette.accent,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: Palette.ink,
  },
  closeBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...BrutalShadow.sm,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  viewport: {
    width: '100%',
    height: 320,
    backgroundColor: Palette.ink,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    overflow: 'hidden',
    position: 'relative',
  },
  overlayState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  overlayText: {
    color: Palette.surface,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorTitle: {
    color: Palette.danger,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: Palette.surface,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  retryBtnText: {
    color: Palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  hintText: {
    fontSize: 12,
    color: Palette.inkMuted,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  switchBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...BrutalShadow.sm,
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  shutterBtn: {
    flex: 1,
    backgroundColor: Palette.accent,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...BrutalShadow.md,
  },
  shutterBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.accentText,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
