import { supabaseAdmin } from '../config/supabaseClient.js';

// Pemetaan tab filter status dari Frontend (riwayat.tsx) ke enum report_status di PostgreSQL
const STATUS_GROUP_MAP = {
  MENUNGGU: ['draft', 'submitted', 'pending_review', 'verified', 'appealed'],
  PROSES: ['routed', 'in_progress'],
  SELESAI: ['fixed', 'closed'],
  DITOLAK: ['rejected'],
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
    throw new Error(`Gagal menyimpan laporan: ${error.message}`);
  }

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
 * Mengambil daftar semua laporan dengan dukungan filter dan paginasi
 */
export const getAllReports = async ({
  status,
  category,
  severity,
  search,
  page = 1,
  limit = 10,
} = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

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
    throw new Error(`Gagal mengambil daftar laporan: ${error.message}`);
  }

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
    throw new Error(`Gagal mengambil riwayat laporan pengguna: ${error.message}`);
  }

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

  if (error || !data) {
    throw new Error('Laporan tidak ditemukan.');
  }

  return data;
};

/**
 * Memperbarui informasi laporan (hanya diizinkan bagi pemilik laporan saat status draft/submitted atau oleh admin)
 */
export const updateReport = async (reportId, userId, userRole, updatePayload) => {
  const existing = await getReportById(reportId);

  const isOwner = existing.user_id === userId;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error('Anda tidak memiliki akses untuk mengubah laporan ini.');
  }

  if (isOwner && !isAdmin && !['draft', 'submitted', 'pending_review'].includes(existing.status)) {
    throw new Error('Laporan yang sedang diproses atau sudah diverifikasi tidak dapat diubah lagi oleh pelapor.');
  }

  const allowedFields = ['title', 'description', 'category', 'severity', 'latitude', 'longitude', 'address', 'image_url'];
  const updates = { updated_at: new Date().toISOString() };

  for (const key of allowedFields) {
    if (updatePayload[key] !== undefined) {
      updates[key] =
        key === 'latitude' || key === 'longitude' ? Number(updatePayload[key]) : updatePayload[key];
    }
  }

  const { data, error } = await supabaseAdmin
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Gagal memperbarui laporan: ${error.message}`);
  }

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

  if (isOwner && !isAdmin && !['draft', 'submitted', 'rejected'].includes(existing.status)) {
    throw new Error('Laporan yang sedang ditangani tidak dapat dihapus.');
  }

  const { error } = await supabaseAdmin.from('reports').delete().eq('id', reportId);

  if (error) {
    throw new Error(`Gagal menghapus laporan: ${error.message}`);
  }

  return { id: reportId };
};

