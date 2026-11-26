import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { YoloDetectionViewer } from '@/components/yolo-detection-viewer';
import { BrutalShadow, Palette } from '@/constants/theme';
import {
  ReportItem,
  deleteReportApi,
  fetchReportDetailApi,
  formatCategoryLabel,
  formatDateID,
  formatSeverityBadge,
  formatStatusBadge,
  getAuthToken,
  getCurrentUser,
  resolveImageUrl,
  routeReportToAuthorityApi,
  updateReportApi,
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
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<ReportItem | null>(initialReport || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const currentUser = getCurrentUser();
  const hasToken = Boolean(getAuthToken());
  const isStaff = Boolean(
    hasToken && currentUser && (currentUser.role === 'admin' || currentUser.role === 'officer')
  );
  const isAdmin = Boolean(hasToken && currentUser && currentUser.role === 'admin');
  const isOwner = Boolean(hasToken && currentUser && report.user_id === currentUser.id);
  const canEditContent = isOwner || isStaff;
  const canDelete = isOwner || isAdmin;

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
      setSuccessMsg('Perubahan laporan telah disimpan.');
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
        status_notes: `Status laporan diperbarui menjadi ${label}.`,
      });
      const refreshed = await fetchReportDetailApi(report.id);
      setReport(refreshed);
      setSuccessMsg(`Status laporan diperbarui menjadi ${label}.`);
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah status laporan.');
    } finally {
      setSaving(false);
    }
  };

  const handleRouteToAuthority = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await routeReportToAuthorityApi(report.id);
      setReport(updated);
      setSuccessMsg('Laporan telah diteruskan ke instansi terkait.');
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal meneruskan laporan ke instansi.');
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.overlay,
            Platform.OS !== 'web' && {
              paddingTop: Math.max(16, insets.top + 8),
              paddingBottom: Math.max(16, insets.bottom + 8),
            },
          ]}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.headerTag}>
                  <Text style={styles.headerTagText}>LAPORAN</Text>
                </View>
                <Text style={styles.headerTitle}>Detail Penanganan</Text>
              </View>
              <TouchableOpacity activeOpacity={0.85} style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Palette.ink} />
                <Text style={styles.loadingText}>Memuat rincian lengkap...</Text>
              </View>
            )}

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.bannerText}>{errorMsg}</Text>
              </View>
            )}

            {successMsg && (
              <View style={styles.successBanner}>
                <Text style={styles.bannerText}>{successMsg}</Text>
              </View>
            )}

            {/* Image + Interactive YOLO Bounding Boxes */}
            {imgUri ? (
              <View style={styles.viewerContainer}>
                <YoloDetectionViewer
                  imageUri={imgUri}
                  detections={detections}
                  imageDimensions={imgDims}
                  visionAvailable={Boolean(ai?.vision_service_available)}
                  analyzed={Boolean(ai)}
                />
              </View>
            ) : (
              <View style={styles.noImageBox}>
                <Text style={styles.noImageText}>Tanpa lampiran foto</Text>
              </View>
            )}

            {/* Badges */}
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[styles.badgeText, { color: statusBadge.text }]}>
                  Status: {statusBadge.label}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: severityBadge.bg }]}>
                <Text style={[styles.badgeText, { color: severityBadge.text }]}>
                  Keparahan: {severityBadge.label}
                </Text>
              </View>
            </View>

            {/* Body vs Edit */}
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
                  style={[styles.textInput, styles.textArea]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Palette.success, flex: 1 }]}
                    onPress={handleSaveEdit}
                    disabled={saving}>
                    <Text style={styles.actionBtnText}>
                      {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Palette.surface, flex: 1 }]}
                    onPress={() => setIsEditing(false)}>
                    <Text style={styles.actionBtnText}>Batal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infoBlock}>
                <Text style={styles.reportTitle}>{report.title}</Text>

                <View style={styles.metaTable}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Tanggal</Text>
                    <Text style={styles.metaVal}>{formatDateID(report.created_at)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Kategori</Text>
                    <Text style={styles.metaVal}>{formatCategoryLabel(report.category)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Lokasi</Text>
                    <Text style={styles.metaVal}>
                      {report.address || 'Koordinat GPS'} ({report.latitude}, {report.longitude})
                    </Text>
                  </View>
                  {report.reporter?.full_name ? (
                    <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.metaKey}>Pelapor</Text>
                      <Text style={styles.metaVal}>
                        {report.reporter.full_name}
                        {report.reporter.email ? ` (${report.reporter.email})` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.descBox}>
                  <Text style={styles.descLabel}>Keterangan Laporan</Text>
                  <Text style={styles.descText}>
                    {report.description || 'Tidak ada keterangan tambahan.'}
                  </Text>
                </View>
              </View>
            )}

            {/* AI Summary */}
            {ai && (
              <View style={styles.aiCard}>
                <Text style={styles.aiHeader}>Ringkasan Analisis Foto</Text>
                <View style={styles.aiGrid}>
                  <View style={styles.aiCell}>
                    <Text style={styles.aiCellLabel}>Deteksi Visual</Text>
                    <Text style={styles.aiCellValue}>
                      {ai.vision_service_available ? 'Aktif' : 'Ringkasan Teks'}
                    </Text>
                  </View>
                  <View style={styles.aiCell}>
                    <Text style={styles.aiCellLabel}>Titik Terdeteksi</Text>
                    <Text style={styles.aiCellValue}>{ai.total_detections} titik</Text>
                  </View>
                  <View style={styles.aiCell}>
                    <Text style={styles.aiCellLabel}>Keyakinan Maks</Text>
                    <Text style={styles.aiCellValue}>
                      {(Number(ai.max_confidence || 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.aiCell}>
                    <Text style={styles.aiCellLabel}>Klasifikasi</Text>
                    <Text style={styles.aiCellValue} numberOfLines={1}>
                      {formatCategoryLabel(ai.primary_damage_label || report.category)}
                    </Text>
                  </View>
                  {ai.priority_score !== undefined && (
                    <View style={styles.aiCell}>
                      <Text style={styles.aiCellLabel}>Skor Prioritas</Text>
                      <Text style={styles.aiCellValue}>{ai.priority_score}/100</Text>
                    </View>
                  )}
                  {ai.location_context && (
                    <View style={styles.aiCell}>
                      <Text style={styles.aiCellLabel}>Lokasi Strategis</Text>
                      <Text style={styles.aiCellValue} numberOfLines={1}>
                        {ai.location_context.strategic_score}/100 ({ai.location_context.road_class_label})
                      </Text>
                    </View>
                  )}
                </View>

                {ai.location_context && (
                  <View style={styles.aiClassesBox}>
                    <Text style={styles.aiSubTitle}>Analisis Strategis Lokasi & Dukungan</Text>
                    <Text style={styles.aiClassItem}>
                      - Wilayah: {ai.location_context.detected_region} (kepadatan{' '}
                      {ai.location_context.population_density_tier})
                    </Text>
                    <Text style={styles.aiClassItem}>
                      - Fasilitas sekitar:{' '}
                      {ai.location_context.nearby_vital_facilities?.length
                        ? ai.location_context.nearby_vital_facilities.join(', ')
                        : 'Tidak terdeteksi dalam radius 300m'}
                    </Text>
                    <Text style={styles.aiClassItem}>
                      - Dukungan pelapor: {ai.support_count ?? 1} warga
                      {ai.severity_adjusted && ai.severity_adjustment_reason
                        ? ` · ${ai.severity_adjustment_reason}`
                        : ''}
                    </Text>
                  </View>
                )}

                {ai.classes_detected && Object.keys(ai.classes_detected).length > 0 && (
                  <View style={styles.aiClassesBox}>
                    <Text style={styles.aiSubTitle}>Rincian Objek Terdeteksi</Text>
                    {Object.entries(ai.classes_detected).map(([cls, info]) => (
                      <Text key={cls} style={styles.aiClassItem}>
                        - {cls}: {info.count} titik (keyakinan{' '}
                        {(info.max_confidence * 100).toFixed(1)}%)
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Routings to Authority */}
            {report.report_routings && report.report_routings.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.sectionSubHeader}>Penerusan ke Instansi</Text>
                {report.report_routings.map((rt) => (
                  <View key={rt.id} style={styles.historyRow}>
                    <Text style={styles.historyStatus}>
                      {rt.authority?.name || 'Dinas Bina Marga DKI Jakarta'}
                      {rt.authority?.region ? ` (${rt.authority.region})` : ''}
                    </Text>
                    <Text style={styles.historyNotes}>{rt.notes || '-'}</Text>
                    <Text style={styles.historyDate}>{formatDateID(rt.routed_at)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Timeline */}
            {report.status_history && report.status_history.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.sectionSubHeader}>Riwayat Penanganan</Text>
                {report.status_history.map((item) => {
                  const nextLabel = formatStatusBadge(item.new_status).label;
                  const prevLabel = item.previous_status
                    ? formatStatusBadge(item.previous_status).label
                    : null;
                  return (
                    <View key={item.id} style={styles.historyRow}>
                      <Text style={styles.historyStatus}>
                        {prevLabel ? `${prevLabel} -> ` : ''}
                        {nextLabel}
                      </Text>
                      <Text style={styles.historyNotes}>{item.notes || '-'}</Text>
                      <Text style={styles.historyDate}>{formatDateID(item.created_at)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Management Controls */}
            {(isStaff || canEditContent || canDelete) && (
              <View style={styles.actionsCard}>
                <Text style={styles.sectionSubHeader}>
                  {isStaff ? 'Panel Petugas & Kelola Laporan' : 'Kelola Laporan Saya'}
                </Text>

                {isStaff && (
                  <>
                    <View style={styles.statusSimulatorRow}>
                      <TouchableOpacity
                        style={[styles.simBtn, { backgroundColor: Palette.pending }]}
                        onPress={() => handleChangeStatus('submitted', 'Menunggu')}
                        disabled={saving}>
                        <Text style={styles.simBtnText}>Menunggu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.simBtn, { backgroundColor: Palette.yellow }]}
                        onPress={() => handleChangeStatus('in_progress', 'Diproses')}
                        disabled={saving}>
                        <Text style={styles.simBtnText}>Diproses</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.simBtn, { backgroundColor: Palette.success }]}
                        onPress={() => handleChangeStatus('fixed', 'Selesai')}
                        disabled={saving}>
                        <Text style={styles.simBtnText}>Selesai</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Palette.highlight }]}
                      onPress={handleRouteToAuthority}
                      disabled={saving}>
                      <Text style={styles.actionBtnText}>Teruskan ke Dinas Bina Marga</Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.bottomActionRow}>
                  {canEditContent && !isEditing && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Palette.canvas, flex: 1 }]}
                      onPress={() => setIsEditing(true)}>
                      <Text style={styles.actionBtnText}>Edit Laporan</Text>
                    </TouchableOpacity>
                  )}

                  {canDelete &&
                    (!confirmDelete ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Palette.danger, flex: 1 }]}
                        onPress={() => setConfirmDelete(true)}>
                        <Text style={styles.actionBtnText}>Hapus</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Palette.dangerSolid, flex: 1 }]}
                        onPress={handleDelete}
                        disabled={saving}>
                        <Text style={[styles.actionBtnText, { color: Palette.surface }]}>
                          Konfirmasi Hapus
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}

            <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '92%',
    backgroundColor: Palette.canvas,
    borderWidth: 2.5,
    borderColor: Palette.ink,
    ...BrutalShadow.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderColor: Palette.ink,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTag: {
    backgroundColor: Palette.accent,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  headerTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: Palette.accentText,
    letterSpacing: 0.7,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Palette.ink,
  },
  closeBtn: {
    backgroundColor: Palette.canvas,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 5,
    ...BrutalShadow.sm,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  bodyScroll: {
    padding: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  errorBanner: {
    backgroundColor: Palette.danger,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: Palette.success,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 10,
    marginBottom: 12,
  },
  bannerText: {
    color: Palette.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  viewerContainer: {
    marginBottom: 14,
  },
  noImageBox: {
    width: '100%',
    height: 92,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  noImageText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.inkMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  infoBlock: {
    marginBottom: 14,
    gap: 10,
  },
  reportTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: Palette.ink,
    lineHeight: 25,
  },
  metaTable: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  metaRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 2,
  },
  metaKey: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  descBox: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 12,
    gap: 4,
  },
  descLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  descText: {
    fontSize: 14,
    color: Palette.ink,
    lineHeight: 21,
  },
  aiCard: {
    backgroundColor: Palette.highlight,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 14,
    marginBottom: 14,
    gap: 10,
    ...BrutalShadow.sm,
  },
  aiHeader: {
    fontSize: 14,
    fontWeight: '900',
    color: Palette.ink,
  },
  aiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiCell: {
    width: '48%',
    backgroundColor: Palette.surface,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    padding: 9,
    gap: 2,
  },
  aiCellLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Palette.inkMuted,
    textTransform: 'uppercase',
  },
  aiCellValue: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.ink,
  },
  aiClassesBox: {
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: Palette.ink,
    gap: 3,
  },
  aiSubTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
  },
  aiClassItem: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  historyCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  sectionSubHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: Palette.ink,
    marginBottom: 2,
  },
  historyRow: {
    borderLeftWidth: 3,
    borderColor: Palette.accent,
    paddingLeft: 10,
    paddingVertical: 2,
    gap: 2,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.ink,
  },
  historyNotes: {
    fontSize: 12,
    color: Palette.ink,
  },
  historyDate: {
    fontSize: 11,
    color: Palette.inkSubtle,
  },
  actionsCard: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 14,
    gap: 10,
  },
  statusSimulatorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  simBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 9,
    alignItems: 'center',
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.ink,
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: Palette.ink,
  },
  editSection: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.ink,
    padding: 14,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.ink,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: Palette.ink,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
