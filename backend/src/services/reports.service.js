import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabaseClient.js';
import {
  readLocalDb,
  writeLocalDb,
  shouldFallbackToLocal,
  setStorageMode,
} from '../config/localStore.js';
import { computePriorityAndEffectiveSeverity } from './ai.service.js';

// Pemetaan tab filter status dari Frontend (riwayat.tsx) ke enum report_status di PostgreSQL
const STATUS_GROUP_MAP = {
  MENUNGGU: ['draft', 'submitted', 'pending_review', 'verified', 'appealed'],
  PROSES: ['routed', 'in_progress'],
  SELESAI: ['fixed', 'closed'],
  DITOLAK: ['rejected'],
};

const filterLocalReports = (reports, { status, category, severity, search, userId } = {}) => {
  return reports.filter((r) => {
    if (userId && r.user_id !== userId) return false;
    if (status && status.toUpperCase() !== 'SEMUA') {
      const upperStatus = status.toUpperCase();
      if (STATUS_GROUP_MAP[upperStatus]) {
        if (!STATUS_GROUP_MAP[upperStatus].includes(r.status)) return false;
      } else if (r.status !== status.toLowerCase()) {
        return false;
      }
    }
    if (category && (r.category || '').toLowerCase() !== category.toLowerCase()) return false;
    if (severity && (r.severity || '').toLowerCase() !== severity.toLowerCase()) return false;
    if (search && search.trim() !== '') {
      const kw = search.trim().toLowerCase();
      const hay = `${r.title || ''} ${r.description || ''} ${r.address || ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
};

/**
 * Menyimpan laporan baru ke tabel public.reports dan mencatat riwayat awal di public.status_history
 */
export const createReport = async ({
  user_id,
  title,
  description,
  category,
  severity,
  latitude,
  longitude,
  address,
  image_url,
  ai_analysis,
  status = 'submitted',
}) => {
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .insert([
      {
        user_id,
        title: title || 'Laporan Kerusakan Jalan',
        description: description || null,
        category: category || 'pothole',
        severity: severity || 'medium',
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || null,
        image_url: image_url || null,
        ai_analysis: ai_analysis || null,
        status,
      },
    ])
    .select('*')
    .single();

  if (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode('local_fallback');
      const db = readLocalDb();
      const now = new Date().toISOString();
      const newReport = {
        id: crypto.randomUUID(),
        user_id,
        title: title || 'Laporan Kerusakan Jalan',
        description: description || null,
        category: category || 'pothole',
        severity: severity || 'medium',
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || null,
        image_url: image_url || null,
        ai_analysis: ai_analysis || null,
        status: status || 'submitted',
        created_at: now,
        updated_at: now,
      };
      db.reports.unshift(newReport);
      db.status_history.push({
        id: crypto.randomUUID(),
        report_id: newReport.id,
        changed_by: user_id,
        previous_status: null,
        new_status: newReport.status,
        notes: 'Laporan baru dikirim oleh warga dan diproses oleh sistem.',
        created_at: now,
      });
      writeLocalDb(db);
      return newReport;
    }
    throw new Error(`Gagal menyimpan laporan: ${error.message}`);
  }

  setStorageMode('supabase');

  // Catat status awal ke tabel status_history (non-blocking terhadap hasil utama jika terjadi kendala)
  const { error: historyError } = await supabaseAdmin.from('status_history').insert([
    {
      report_id: report.id,
      changed_by: user_id,
      previous_status: null,
      new_status: report.status,
      notes: 'Laporan baru dikirim oleh warga dan diproses oleh sistem.',
    },
  ]);

  if (historyError) {
    console.warn('[Reports Service] Gagal mencatat status_history awal:', historyError.message);
  }

  return report;
};

/**
 * Mengambil ringkasan laporan terbaru/aktif untuk keperluan analisis kedekatan koordinat & deteksi duplikat
 */
export const getReportsForSpatialAnalysis = async () => {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('id, title, address, category, severity, status, latitude, longitude, created_at, ai_analysis')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode('local_fallback');
      const db = readLocalDb();
      return db.reports || [];
    }
    console.warn('[Reports Service] Gagal mengambil data spasial laporan:', error.message);
    return [];
  }

  setStorageMode('supabase');
  return data || [];
};

const getReportPriorityScore = (report) =>
  Number(report?.ai_analysis?.priority_score ?? report?.priority_score ?? 0);

/**
 * Mengambil daftar semua laporan dengan dukungan filter, pengurutan (terbaru/prioritas), dan paginasi
 */
export const getAllReports = async ({
  status,
  category,
  severity,
  search,
  sort = 'newest',
  page = 1,
  limit = 10,
} = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;
  const sortByPriority = String(sort || '').toLowerCase() === 'priority';

  let query = supabaseAdmin
    .from('reports')
    .select(
      `
      *,
      reporter:users!reports_user_id_fkey (
        id,
        full_name,
        email,
        role
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (sortByPriority) {
    query = query.range(0, 199);
  } else {
    query = query.range(from, to);
  }

  if (status && status.toUpperCase() !== 'SEMUA') {
    const upperStatus = status.toUpperCase();
    if (STATUS_GROUP_MAP[upperStatus]) {
      query = query.in('status', STATUS_GROUP_MAP[upperStatus]);
    } else {
      query = query.eq('status', status.toLowerCase());
    }
  }

  if (category) {
    query = query.eq('category', category.toLowerCase());
  }

  if (severity) {
    query = query.eq('severity', severity.toLowerCase());
  }

  if (search && search.trim() !== '') {
    const keyword = `%${search.trim()}%`;
    query = query.or(`title.ilike.${keyword},description.ilike.${keyword},address.ilike.${keyword}`);
  }

  const { data, error, count } = await query;

  if (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode('local_fallback');
      const db = readLocalDb();
      const sorted = [...db.reports].sort((a, b) => {
        if (sortByPriority) {
          const diff = getReportPriorityScore(b) - getReportPriorityScore(a);
          if (diff !== 0) return diff;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      const filtered = filterLocalReports(sorted, { status, category, severity, search });
      const total = filtered.length;
      const paged = filtered.slice(from, to + 1).map((r) => {
        const u = db.users.find((usr) => usr.id === r.user_id);
        return {
          ...r,
          reporter: u
            ? { id: u.id, full_name: u.full_name, email: u.email, role: u.role }
            : null,
        };
      });
      return {
        reports: paged,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          total_pages: total ? Math.ceil(total / limitNum) : 0,
        },
      };
    }
    throw new Error(`Gagal mengambil daftar laporan: ${error.message}`);
  }

  setStorageMode('supabase');

  let finalReports = data || [];
  let totalCount = count || 0;
  if (sortByPriority) {
    finalReports = [...finalReports].sort((a, b) => {
      const diff = getReportPriorityScore(b) - getReportPriorityScore(a);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    totalCount = finalReports.length;
    finalReports = finalReports.slice(from, to + 1);
  }

  return {
    reports: finalReports,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      total_pages: totalCount ? Math.ceil(totalCount / limitNum) : 0,
    },
  };
};

/**
 * Mengambil riwayat laporan milik pengguna tertentu (Citizen)
 */
export const getReportsByUser = async (userId, { status, page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  let query = supabaseAdmin
    .from('reports')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status && status.toUpperCase() !== 'SEMUA') {
    const upperStatus = status.toUpperCase();
    if (STATUS_GROUP_MAP[upperStatus]) {
      query = query.in('status', STATUS_GROUP_MAP[upperStatus]);
    } else {
      query = query.eq('status', status.toLowerCase());
    }
  }

  const { data, error, count } = await query;

  if (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode('local_fallback');
      const db = readLocalDb();
      const sorted = [...db.reports].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const filtered = filterLocalReports(sorted, { status, userId });
      const total = filtered.length;
      const paged = filtered.slice(from, to + 1);
      return {
        reports: paged,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          total_pages: total ? Math.ceil(total / limitNum) : 0,
        },
      };
    }
    throw new Error(`Gagal mengambil riwayat laporan pengguna: ${error.message}`);
  }

  setStorageMode('supabase');
  return {
    reports: data || [],
    pagination: {
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      total_pages: count ? Math.ceil(count / limitNum) : 0,
    },
  };
};

/**
 * Mengambil detail lengkap 1 laporan berdasarkan ID beserta riwayat status dan instansi tujuan
 */
export const getReportById = async (reportId) => {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select(
      `
      *,
      reporter:users!reports_user_id_fkey (
        id,
        full_name,
        email,
        phone_number,
        role
      ),
      status_history (
        id,
        previous_status,
        new_status,
        notes,
        changed_by,
        created_at
      ),
      report_routings (
        id,
        routed_at,
        notes,
        authority:authorities (
          id,
          name,
          region,
          contact_email
        )
      )
    `
    )
    .eq('id', reportId)
    .single();

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    const report = db.reports.find((r) => r.id === reportId);
    if (!report) {
      throw new Error('Laporan tidak ditemukan.');
    }
    const u = db.users.find((usr) => usr.id === report.user_id);
    const history = (db.status_history || []).filter((h) => h.report_id === reportId);
    const routings = (db.report_routings || [])
      .filter((rt) => rt.report_id === reportId)
      .map((rt) => ({
        ...rt,
        authority: (db.authorities || []).find((a) => a.id === rt.authority_id) || null,
      }));
    return {
      ...report,
      reporter: u
        ? {
            id: u.id,
            full_name: u.full_name,
            email: u.email,
            phone_number: u.phone_number,
            role: u.role,
          }
        : null,
      status_history: history,
      report_routings: routings,
    };
  }

  if (error || !data) {
    throw new Error('Laporan tidak ditemukan.');
  }

  setStorageMode('supabase');
  return data;
};

/**
 * Memperbarui informasi laporan
 */
export const updateReport = async (reportId, userId, userRole, updatePayload) => {
  const existing = await getReportById(reportId);

  const isOwner = existing.user_id === userId;
  const isAdmin = userRole === 'admin' || userRole === 'officer';

  if (!isOwner && !isAdmin) {
    throw new Error('Anda tidak memiliki akses untuk mengubah laporan ini.');
  }

  const allowedFields = [
    'title',
    'description',
    'category',
    'severity',
    'latitude',
    'longitude',
    'address',
    'image_url',
    'status',
  ];
  const updates = { updated_at: new Date().toISOString() };

  for (const key of allowedFields) {
    if (updatePayload[key] !== undefined) {
      updates[key] =
        key === 'latitude' || key === 'longitude'
          ? Number(updatePayload[key])
          : updatePayload[key];
    }
  }

  const statusChanged =
    updates.status !== undefined && updates.status !== existing.status;

  const { data, error } = await supabaseAdmin
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .select('*')
    .single();

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    const idx = db.reports.findIndex((r) => r.id === reportId);
    if (idx === -1) {
      throw new Error('Laporan tidak ditemukan.');
    }
    const prevStatus = db.reports[idx].status;
    db.reports[idx] = {
      ...db.reports[idx],
      ...updates,
    };
    if (statusChanged) {
      db.status_history.push({
        id: crypto.randomUUID(),
        report_id: reportId,
        changed_by: userId,
        previous_status: prevStatus,
        new_status: updates.status,
        notes: updatePayload.status_notes || `Status laporan diperbarui menjadi ${updates.status}.`,
        created_at: updates.updated_at,
      });
    }
    writeLocalDb(db);
    return db.reports[idx];
  }

  if (error) {
    throw new Error(`Gagal memperbarui laporan: ${error.message}`);
  }

  if (statusChanged) {
    await supabaseAdmin.from('status_history').insert([
      {
        report_id: reportId,
        changed_by: userId,
        previous_status: existing.status,
        new_status: updates.status,
        notes: updatePayload.status_notes || `Status laporan diperbarui menjadi ${updates.status}.`,
      },
    ]);
  }

  setStorageMode('supabase');
  return data;
};

/**
 * Mengonfirmasi laporan aktif yang terdeteksi sebagai duplikat:
 * menambah jumlah dukungan warga (+1) dan menghitung ulang skor prioritas laporan induk.
 */
export const confirmDuplicateReport = async (reportId, userId, notes = null) => {
  const existing = await getReportById(reportId);

  if (['fixed', 'closed', 'rejected'].includes(String(existing.status || '').toLowerCase())) {
    throw new Error('Laporan ini sudah selesai atau ditutup sehingga tidak dapat digabungkan.');
  }

  const prevAi = existing.ai_analysis || {};
  const supporterIds = Array.isArray(prevAi.supporter_ids) ? [...prevAi.supporter_ids] : [];

  if (existing.user_id === userId || supporterIds.includes(userId)) {
    throw new Error('Anda sudah melaporkan atau mengonfirmasi titik kerusakan ini.');
  }

  supporterIds.push(userId);
  const newSupportCount = (Number(prevAi.support_count) || 1) + 1;
  const visualSeverity = prevAi.visual_severity || existing.severity || 'medium';

  const recalculated = computePriorityAndEffectiveSeverity({
    category: existing.category,
    visualSeverity,
    locationContext: prevAi.location_context || null,
    supportCount: newSupportCount,
  });

  const nextSeverity =
    existing.severity === 'high' ? 'high' : recalculated.effective_severity;

  const updatedAi = {
    ...prevAi,
    support_count: newSupportCount,
    supporter_ids: supporterIds,
    priority_score: recalculated.priority_score,
    effective_severity: nextSeverity,
    severity_adjusted: prevAi.severity_adjusted || recalculated.severity_adjusted,
    severity_adjustment_reason:
      recalculated.severity_adjustment_reason || prevAi.severity_adjustment_reason || null,
  };

  const now = new Date().toISOString();
  const historyNote =
    notes && String(notes).trim()
      ? String(notes).trim()
      : `Warga lain mengonfirmasi kerusakan yang sama di lokasi ini (total ${newSupportCount} pelapor, skor prioritas ${recalculated.priority_score}/100).`;

  const { data, error } = await supabaseAdmin
    .from('reports')
    .update({
      severity: nextSeverity,
      ai_analysis: updatedAi,
      updated_at: now,
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    const idx = db.reports.findIndex((r) => r.id === reportId);
    if (idx === -1) {
      throw new Error('Laporan tidak ditemukan.');
    }
    db.reports[idx] = {
      ...db.reports[idx],
      severity: nextSeverity,
      ai_analysis: updatedAi,
      updated_at: now,
    };
    db.status_history.push({
      id: crypto.randomUUID(),
      report_id: reportId,
      changed_by: userId,
      previous_status: existing.status,
      new_status: existing.status,
      notes: historyNote,
      created_at: now,
    });
    writeLocalDb(db);
    return db.reports[idx];
  }

  if (error) {
    throw new Error(`Gagal mengonfirmasi duplikat laporan: ${error.message}`);
  }

  await supabaseAdmin.from('status_history').insert([
    {
      report_id: reportId,
      changed_by: userId,
      previous_status: existing.status,
      new_status: existing.status,
      notes: historyNote,
    },
  ]);

  setStorageMode('supabase');
  return data;
};

/**
 * Menghapus laporan berdasarkan ID
 */
export const deleteReport = async (reportId, userId, userRole) => {
  const existing = await getReportById(reportId);

  const isOwner = existing.user_id === userId;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error('Anda tidak memiliki akses untuk menghapus laporan ini.');
  }

  const { error } = await supabaseAdmin.from('reports').delete().eq('id', reportId);

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    db.reports = db.reports.filter((r) => r.id !== reportId);
    db.status_history = (db.status_history || []).filter((h) => h.report_id !== reportId);
    db.report_routings = (db.report_routings || []).filter((rt) => rt.report_id !== reportId);
    writeLocalDb(db);
    return { id: reportId };
  }

  if (error) {
    throw new Error(`Gagal menghapus laporan: ${error.message}`);
  }

  setStorageMode('supabase');
  return { id: reportId };
};


