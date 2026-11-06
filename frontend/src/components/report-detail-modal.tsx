import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  ReportItem,
  fetchReportDetailApi,
  updateReportApi,
  deleteReportApi,
  resolveImageUrl,
  formatStatusBadge,
  formatSeverityBadge,
  formatCategoryLabel,
  formatDateID,
} from '@/services/api';

interface ReportDetailModalProps {
  visible: boolean;
  reportId: string | null;
  initialReport?: ReportItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function ReportDetailModal({
  visible,
  reportId,
  initialReport,
  onClose,
  onUpdated,
}: ReportDetailModalProps) {
  const [report, setReport] = useState<ReportItem | null>(initialReport || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [boxAreaSize, setBoxAreaSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (initialReport) {
      setReport(initialReport);
      setEditTitle(initialReport.title || '');
      setEditDesc(initialReport.description || '');
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditing(false);
    setConfirmDelete(false);

    if (visible && reportId) {
      setLoading(true);
      fetchReportDetailApi(reportId)
        .then((fullData) => {
          setReport(fullData);
          setEditTitle(fullData.title || '');
          setEditDesc(fullData.description || '');
        })
        .catch((err) => {
          setErrorMsg(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, reportId, initialReport]);

  if (!visible || !report) return null;

  const statusBadge = formatStatusBadge(report.status);
  const severityBadge = formatSeverityBadge(report.severity);
  const imgUri = resolveImageUrl(report.image_url);
  const ai = report.ai_analysis;
  const detections = ai?.detections || [];
  const imgDims = ai?.image_dimensions;

  const handleSaveEdit = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await updateReportApi(report.id, {
        title: editTitle,
        description: editDesc,
      });
      setReport({ ...report, ...updated });
      setIsEditing(false);
      setSuccessMsg('Laporan berhasil diperbarui!');
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui laporan.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (newStatus: string, label: string) => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateReportApi(report.id, {
        status: newStatus,
        status_notes: `Status diubah menjadi ${label} melalui panel pengujian lokal.`,
      });
      const refreshed = await fetchReportDetailApi(report.id);
      setReport(refreshed);
      setSuccessMsg(`Status laporan diubah menjadi ${label}!`);
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah status laporan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await deleteReportApi(report.id);
      onUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus laporan.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Modal */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>DETAIL LAPORAN</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ TUTUP</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.loadingText}>Memuat rincian lengkap...</Text>
              </View>
            )}

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            )}

            {successMsg && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ {successMsg}</Text>
              </View>
            )}

            {/* Foto & Bounding Box Deteksi YOLO */}
            {imgUri ? (
              <View
                style={styles.imageWrapper}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setBoxAreaSize({ width, height });
                }}>
                <Image source={{ uri: imgUri }} style={styles.reportImage} resizeMode="stretch" />
                {imgDims &&
                  imgDims.width > 0 &&
                  imgDims.height > 0 &&
                  boxAreaSize.width > 0 &&
                  detections.map((det) => {
                    const scaleX = boxAreaSize.width / imgDims.width;
                    const scaleY = boxAreaSize.height / imgDims.height;
                    const left = det.bounding_box.x1 * scaleX;
                    const top = det.bounding_box.y1 * scaleY;
                    const width = Math.max(16, (det.bounding_box.x2 - det.bounding_box.x1) * scaleX);
                    const height = Math.max(16, (det.bounding_box.y2 - det.bounding_box.y1) * scaleY);
                    return (
                      <View
                        key={det.detection_id}
                        style={[
                          styles.bboxOverlay,
                          { left, top, width, height },
                        ]}>
                        <View style={styles.bboxLabelTag}>
                          <Text style={styles.bboxLabelText}>
                            {det.class} {(det.confidence * 100).toFixed(0)}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            ) : (
              <View style={styles.noImageBox}>
                <Text style={styles.noImageText}>TANPA LAMPIRAN FOTO</Text>
              </View>
            )}

            {/* Badges Status & Keparahan */}
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[styles.badgeText, { color: statusBadge.text }]}>
                  STATUS: {statusBadge.label} ({report.status})
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: severityBadge.bg }]}>
                <Text style={[styles.badgeText, { color: severityBadge.text }]}>
                  {severityBadge.label}
                </Text>
              </View>
            </View>

            {/* Judul & Deskripsi (Mode Baca vs Edit) */}
            {isEditing ? (
              <View style={styles.editSection}>
                <Text style={styles.fieldLabel}>Judul Laporan</Text>
                <TextInput
                  style={styles.textInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />
                <Text style={styles.fieldLabel}>Deskripsi Laporan</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 80 }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#C1FF72' }]}
                    onPress={handleSaveEdit}
                    disabled={saving}>
                    <Text style={styles.actionBtnText}>
                      {saving ? 'MENYIMPAN...' : '💾 SIMPAN PERUBAHAN'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#fff' }]}
                    onPress={() => setIsEditing(false)}>
                    <Text style={styles.actionBtnText}>BATAL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infoBlock}>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <Text style={styles.metaLine}>
                  📅 Dilaporkan: {formatDateID(report.created_at)}
                </Text>
                <Text style={styles.metaLine}>
                  📍 Lokasi: {report.address || 'Koordinat GPS'} ({report.latitude},{' '}
                  {report.longitude})
                </Text>
                <Text style={styles.metaLine}>
                  🏷️ Kategori: {formatCategoryLabel(report.category)}
                </Text>
                {report.reporter?.full_name && (
                  <Text style={styles.metaLine}>
                    👤 Pelapor: {report.reporter.full_name} ({report.reporter.email})
                  </Text>
                )}

                <View style={styles.descBox}>
                  <Text style={styles.descText}>
                    {report.description || 'Tidak ada deskripsi.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Kotak Analisis AI (YOLO Vision + Narrative Generator) */}
            {ai && (
              <View style={styles.aiCard}>
                <Text style={styles.aiHeader}>🤖 HASIL ANALISIS AI (YOLO VISION)</Text>
                <Text style={styles.aiLine}>
                  • Status Vision AI:{' '}
                  {ai.vision_service_available ? 'Aktif (Terhubung)' : 'Fallback Teks'}
                </Text>
                <Text style={styles.aiLine}>
                  • Klasifikasi Utama: {ai.primary_damage_label || formatCategoryLabel(report.category)}
                </Text>
                <Text style={styles.aiLine}>
                  • Jumlah Titik Deteksi: {ai.total_detections} titik
                </Text>
                <Text style={styles.aiLine}>
                  • Confidence Maksimum: {(Number(ai.max_confidence || 0) * 100).toFixed(1)}%
                </Text>
                <Text style={styles.aiLine}>
                  • Generator Naratif: {ai.narrative_generator || 'template_orchestrator'}
                </Text>
                {ai.classes_detected && Object.keys(ai.classes_detected).length > 0 && (
                  <View style={styles.aiClassesBox}>
                    <Text style={styles.aiSubTitle}>Rincian Kelas YOLO Terdeteksi:</Text>
                    {Object.entries(ai.classes_detected).map(([cls, info]) => (
                      <Text key={cls} style={styles.aiClassItem}>
                        ▸ {cls}: {info.count} titik (conf maks {(info.max_confidence * 100).toFixed(1)}%)
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Riwayat Perubahan Status (status_history) */}
            {report.status_history && report.status_history.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.sectionSubHeader}>📜 RIWAYAT STATUS LAPORAN</Text>
                {report.status_history.map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <Text style={styles.historyStatus}>
                      {item.previous_status ? `${item.previous_status} → ` : ''}
                      {item.new_status.toUpperCase()}
                    </Text>
                    <Text style={styles.historyNotes}>{item.notes || '-'}</Text>
                    <Text style={styles.historyDate}>{formatDateID(item.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Panel Simulasi & Aksi Pengujian Lokal */}
            <View style={styles.actionsCard}>
              <Text style={styles.sectionSubHeader}>⚙️ PANEL AKSI & UJI STATUS</Text>
              <View style={styles.statusSimulatorRow}>
                <TouchableOpacity
                  style={[styles.simBtn, { backgroundColor: '#fff' }]}
                  onPress={() => handleChangeStatus('submitted', 'MENUNGGU')}
                  disabled={saving}>
                  <Text style={styles.simBtnText}>Set MENUNGGU</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simBtn, { backgroundColor: '#FFD700' }]}
                  onPress={() => handleChangeStatus('in_progress', 'PROSES')}
                  disabled={saving}>
                  <Text style={styles.simBtnText}>Set PROSES</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simBtn, { backgroundColor: '#32CD32' }]}
                  onPress={() => handleChangeStatus('fixed', 'SELESAI')}
                  disabled={saving}>
                  <Text style={styles.simBtnText}>Set SELESAI</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomActionRow}>
                {!isEditing && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FADCB6', flex: 1 }]}
                    onPress={() => setIsEditing(true)}>
                    <Text style={styles.actionBtnText}>✏️ EDIT LAPORAN</Text>
                  </TouchableOpacity>
                )}

                {!confirmDelete ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FCA5A5', flex: 1 }]}
                    onPress={() => setConfirmDelete(true)}>
                    <Text style={styles.actionBtnText}>🗑️ HAPUS</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FF4D4D', flex: 1 }]}
                    onPress={handleDelete}
                    disabled={saving}>
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                      ⚠️ YAKIN HAPUS?
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: '#F3F4F6',
    borderWidth: 4,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF5E00',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderColor: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  closeBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  bodyScroll: {
    padding: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  loadingText: {
    fontWeight: 'bold',
    color: '#000',
  },
  errorBanner: {
    backgroundColor: '#FCA5A5',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  successBanner: {
    backgroundColor: '#C1FF72',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 12,
  },
  successText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#000',
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  reportImage: {
    width: '100%',
    height: '100%',
  },
  bboxOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FF5E00',
    backgroundColor: 'rgba(255, 94, 0, 0.2)',
  },
  bboxLabelTag: {
    backgroundColor: '#FF5E00',
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  bboxLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  noImageBox: {
    width: '100%',
    height: 100,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  noImageText: {
    fontWeight: '900',
    color: '#666',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#000',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  infoBlock: {
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  metaLine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  descBox: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
  },
  descText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  aiCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  aiHeader: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    marginBottom: 6,
  },
  aiLine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    marginBottom: 3,
  },
  aiClassesBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: '#000',
  },
  aiSubTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    marginBottom: 2,
  },
  aiClassItem: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  historyCard: {
    backgroundColor: '#E5E7EB',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    marginBottom: 16,
  },
  sectionSubHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
  },
  historyRow: {
    borderLeftWidth: 3,
    borderColor: '#FF5E00',
    paddingLeft: 8,
    marginBottom: 8,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  historyNotes: {
    fontSize: 12,
    color: '#111',
  },
  historyDate: {
    fontSize: 11,
    color: '#555',
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
  },
  statusSimulatorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  simBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
  },
  simBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  editSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 14,
    color: '#000',
    marginBottom: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
});

