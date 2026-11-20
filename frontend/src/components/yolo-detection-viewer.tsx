import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrutalShadow, Palette } from '@/constants/theme';
import { YoloDetection } from '@/services/api';

interface YoloDetectionViewerProps {
  imageUri: string;
  detections?: YoloDetection[];
  imageDimensions?: { width: number; height: number } | null;
  visionAvailable?: boolean;
  analyzed?: boolean;
  emptyNote?: string;
}

const CLASS_LABEL_ID: Record<string, string> = {
  pothole: 'Lubang Jalan',
  potholes: 'Lubang Jalan',
  lubang: 'Lubang Jalan',
  crack: 'Retak Jalan',
  cracks: 'Retak Jalan',
  retak_kulit_buaya: 'Retak Kulit Buaya',
  retak_memanjang: 'Retak Memanjang',
  retak_melintang: 'Retak Melintang',
  longitudinal_crack: 'Retak Memanjang',
  transverse_crack: 'Retak Melintang',
  alligator_crack: 'Retak Kulit Buaya',
  pengelupasan_lapisan_permukaan: 'Pengelupasan Aspal',
  surface_damage: 'Pengelupasan Aspal',
  sidewalk_damage: 'Kerusakan Trotoar',
  d00: 'Retak Memanjang',
  d10: 'Retak Melintang',
  d20: 'Retak Kulit Buaya',
  d40: 'Lubang Jalan',
};

function formatYoloClass(rawClass: string): string {
  const key = (rawClass || '').trim().toLowerCase();
  if (CLASS_LABEL_ID[key]) return CLASS_LABEL_ID[key];
  if (!rawClass) return 'Kerusakan Jalan';
  return rawClass
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toPct(val: number): `${number}%` {
  const clamped = Math.max(0, Math.min(100, val));
  return `${Number(clamped.toFixed(2))}%` as `${number}%`;
}

function getConfidenceTier(conf: number): { label: string; color: string } {
  if (conf >= 0.7) return { label: 'Akurasi Tinggi', color: Palette.success };
  if (conf >= 0.4) return { label: 'Akurasi Sedang', color: Palette.yellow };
  return { label: 'Akurasi Rendah', color: Palette.pending };
}

export function YoloDetectionViewer({
  imageUri,
  detections = [],
  imageDimensions,
  visionAvailable = false,
  analyzed = false,
  emptyNote,
}: YoloDetectionViewerProps) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (detections.length > 0) {
      let best = detections[0];
      for (const det of detections) {
        if (det.confidence > best.confidence) best = det;
      }
      setSelectedId(best.detection_id);
      setShowBoxes(true);
    } else {
      setSelectedId(null);
    }
  }, [detections]);

  const effectiveDims =
    imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0
      ? imageDimensions
      : naturalSize;

  const canRenderBoxes =
    showBoxes &&
    detections.length > 0 &&
    Boolean(effectiveDims && effectiveDims.width > 0 && effectiveDims.height > 0);

  const aspectRatio =
    effectiveDims && effectiveDims.width > 0 && effectiveDims.height > 0
      ? Math.max(0.65, Math.min(2.4, effectiveDims.width / effectiveDims.height))
      : 16 / 9;

  const selectedDetection =
    detections.find((d) => d.detection_id === selectedId) || detections[0] || null;

  const selectedAreaPct =
    selectedDetection && effectiveDims && effectiveDims.width > 0 && effectiveDims.height > 0
      ? (((selectedDetection.bounding_box.x2 - selectedDetection.bounding_box.x1) *
          (selectedDetection.bounding_box.y2 - selectedDetection.bounding_box.y1)) /
          (effectiveDims.width * effectiveDims.height)) *
        100
      : null;

  const selectedTier = selectedDetection
    ? getConfidenceTier(selectedDetection.confidence)
    : null;

  return (
    <View style={styles.wrapper}>
      {/* Toolbar status & kontrol interaktif */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: !analyzed
                  ? Palette.canvas
                  : detections.length > 0
                    ? Palette.success
                    : visionAvailable
                      ? Palette.yellow
                      : Palette.pending,
              },
            ]}>
            <Text style={styles.statusPillText}>
              {!analyzed
                ? 'Pratinjau Foto'
                : detections.length > 0
                  ? `YOLO: ${detections.length} Titik Terdeteksi`
                  : visionAvailable
                    ? 'YOLO: 0 Objek Terdeteksi'
                    : 'YOLO: Mode Siaga'}
            </Text>
          </View>
        </View>

        {detections.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.toggleBtn, showBoxes && styles.toggleBtnActive]}
            onPress={() => setShowBoxes((v) => !v)}>
            <Text style={[styles.toggleBtnText, showBoxes && styles.toggleBtnTextActive]}>
              {showBoxes ? 'Sembunyikan Kotak' : 'Tampilkan Kotak'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Canvas Foto + Overlay Bounding Box */}
      <View style={[styles.imageFrame, { aspectRatio }]}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="stretch"
          onLoad={(e: any) => {
            const src = e?.nativeEvent?.source;
            if (src?.width > 0 && src?.height > 0) {
              setNaturalSize({ width: src.width, height: src.height });
            }
          }}
        />

        {canRenderBoxes &&
          effectiveDims &&
          detections.map((det, idx) => {
            const isSelected = selectedDetection?.detection_id === det.detection_id;
            const leftPct = (det.bounding_box.x1 / effectiveDims.width) * 100;
            const topPct = (det.bounding_box.y1 / effectiveDims.height) * 100;
            const widthPct =
              ((det.bounding_box.x2 - det.bounding_box.x1) / effectiveDims.width) * 100;
            const heightPct =
              ((det.bounding_box.y2 - det.bounding_box.y1) / effectiveDims.height) * 100;

            return (
              <TouchableOpacity
                key={det.detection_id}
                activeOpacity={0.9}
                onPress={() => setSelectedId(det.detection_id)}
                style={[
                  styles.bbox,
                  {
                    left: toPct(leftPct),
                    top: toPct(topPct),
                    width: toPct(Math.max(4, widthPct)),
                    height: toPct(Math.max(4, heightPct)),
                  },
                  isSelected ? styles.bboxSelected : styles.bboxDefault,
                ]}>
                <View style={[styles.bboxTag, isSelected && styles.bboxTagSelected]}>
                  <Text
                    numberOfLines={1}
                    style={[styles.bboxTagText, isSelected && styles.bboxTagTextSelected]}>
                    #{idx + 1} · {(det.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* Daftar Chip Interaktif & Inspector Akurasi */}
      {analyzed && detections.length > 0 && (
        <View style={styles.inspectorCard}>
          <Text style={styles.inspectorLabel}>
            Pilih titik deteksi pada foto atau daftar di bawah untuk memeriksa akurasi:
          </Text>

          <View style={styles.chipRow}>
            {detections.map((det, idx) => {
              const active = selectedDetection?.detection_id === det.detection_id;
              return (
                <TouchableOpacity
                  key={det.detection_id}
                  activeOpacity={0.85}
                  style={[styles.detChip, active && styles.detChipActive]}
                  onPress={() => {
                    setShowBoxes(true);
                    setSelectedId(det.detection_id);
                  }}>
                  <Text style={[styles.detChipText, active && styles.detChipTextActive]}>
                    #{idx + 1} {formatYoloClass(det.class)} ({(det.confidence * 100).toFixed(1)}%)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDetection && selectedTier && (
            <View style={styles.detailBox}>
              <View style={styles.detailTopRow}>
                <View style={styles.detailTitleWrap}>
                  <Text style={styles.detailClass}>
                    {formatYoloClass(selectedDetection.class)}
                  </Text>
                  <Text style={styles.detailRawClass}>Label model: {selectedDetection.class}</Text>
                </View>
                <View style={[styles.tierBadge, { backgroundColor: selectedTier.color }]}>
                  <Text style={styles.tierBadgeText}>{selectedTier.label}</Text>
                </View>
              </View>

              {/* Progress bar akurasi */}
              <View style={styles.confHeader}>
                <Text style={styles.confLabel}>Skor Keyakinan YOLO</Text>
                <Text style={styles.confValue}>
                  {(selectedDetection.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: toPct(selectedDetection.confidence * 100),
                      backgroundColor: selectedTier.color,
                    },
                  ]}
                />
              </View>

              <View style={styles.metaFoot}>
                <Text style={styles.metaFootText}>
                  Area kotak: {Math.round(selectedDetection.bounding_box.x1)},
                  {Math.round(selectedDetection.bounding_box.y1)} ke{' '}
                  {Math.round(selectedDetection.bounding_box.x2)},
                  {Math.round(selectedDetection.bounding_box.y2)} px
                </Text>
                {selectedAreaPct !== null && (
                  <Text style={styles.metaFootText}>
                    Cakupan: {selectedAreaPct.toFixed(1)}% luas foto
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Keterangan saat analisis selesai tetapi 0 deteksi */}
      {analyzed && detections.length === 0 && (
        <View style={styles.emptyInfoBox}>
          <Text style={styles.emptyInfoText}>
            {emptyNote ||
              (visionAvailable
                ? 'Model YOLO tidak menemukan objek kerusakan jalan di atas ambang keyakinan 15% pada foto ini. Anda tetap dapat meninjau atau melengkapi laporan secara manual.'
                : 'Layanan deteksi visual YOLO sedang tidak aktif sehingga kotak deteksi belum dapat ditampilkan. Laporan disusun berdasarkan keterangan lokasi Anda.')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
  },
  toggleBtn: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...BrutalShadow.sm,
  },
  toggleBtnActive: {
    backgroundColor: Palette.ink,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.ink,
  },
  toggleBtnTextActive: {
    color: Palette.yellow,
  },
  imageFrame: {
    width: '100%',
    maxHeight: 460,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    backgroundColor: Palette.ink,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bbox: {
    position: 'absolute',
  },
  bboxDefault: {
    borderWidth: 2,
    borderColor: Palette.accent,
    backgroundColor: 'rgba(255, 94, 0, 0.16)',
  },
  bboxSelected: {
    borderWidth: 3,
    borderColor: Palette.yellow,
    backgroundColor: 'rgba(253, 224, 71, 0.24)',
    zIndex: 5,
  },
  bboxTag: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.accent,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bboxTagSelected: {
    backgroundColor: Palette.yellow,
  },
  bboxTagText: {
    color: Palette.accentText,
    fontSize: 10,
    fontWeight: '900',
  },
  bboxTagTextSelected: {
    color: Palette.ink,
  },
  inspectorCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    gap: 10,
  },
  inspectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.inkMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detChip: {
    backgroundColor: Palette.canvas,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  detChipActive: {
    backgroundColor: Palette.ink,
  },
  detChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.ink,
  },
  detChipTextActive: {
    color: Palette.yellow,
  },
  detailBox: {
    backgroundColor: Palette.highlight,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    padding: 10,
    gap: 8,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailTitleWrap: {
    flex: 1,
  },
  detailClass: {
    fontSize: 14,
    fontWeight: '900',
    color: Palette.ink,
  },
  detailRawClass: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  tierBadge: {
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: Palette.ink,
  },
  confHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  confValue: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.ink,
  },
  progressTrack: {
    height: 12,
    backgroundColor: Palette.surface,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  metaFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  metaFootText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
  emptyInfoBox: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
  },
  emptyInfoText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: Palette.inkMuted,
  },
});
