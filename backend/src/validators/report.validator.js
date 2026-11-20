export const VALID_REPORT_STATUSES = [
  'draft',
  'submitted',
  'pending_review',
  'verified',
  'rejected',
  'routed',
  'in_progress',
  'fixed',
  'closed',
  'appealed',
];

export const VALID_REPORT_SEVERITIES = ['low', 'medium', 'high'];

export const VALID_REPORT_CATEGORIES = [
  'pothole',
  'crack',
  'surface_damage',
  'sidewalk_damage',
  'undamaged',
];

/**
 * Memvalidasi dan menormalkan koordinat GPS latitude & longitude.
 */
export const validateCoordinates = (
  rawLat,
  rawLng,
  { required = true, defaultLat = -6.2088, defaultLng = 106.8456 } = {}
) => {
  const isMissingLat = rawLat === undefined || rawLat === null || String(rawLat).trim() === '';
  const isMissingLng = rawLng === undefined || rawLng === null || String(rawLng).trim() === '';

  if (isMissingLat || isMissingLng) {
    if (required) {
      throw new Error('Koordinat lokasi (latitude dan longitude) wajib diisi.');
    }
    return { latitude: defaultLat, longitude: defaultLng };
  }

  const latitude = Number(rawLat);
  const longitude = Number(rawLng);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error('Koordinat latitude dan longitude harus berupa angka yang valid.');
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Koordinat latitude (-90 s/d 90) atau longitude (-180 s/d 180) tidak valid.');
  }

  return { latitude, longitude };
};

/**
 * Memvalidasi field pembaruan laporan (status, severity, category, koordinat).
 */
export const validateReportUpdateFields = (payload = {}) => {
  if (payload.status !== undefined) {
    const normalizedStatus = String(payload.status).trim().toLowerCase();
    if (!VALID_REPORT_STATUSES.includes(normalizedStatus)) {
      throw new Error(
        `Status laporan tidak valid. Pilihan yang tersedia: ${VALID_REPORT_STATUSES.join(', ')}.`
      );
    }
  }

  if (payload.severity !== undefined) {
    const normalizedSeverity = String(payload.severity).trim().toLowerCase();
    if (!VALID_REPORT_SEVERITIES.includes(normalizedSeverity)) {
      throw new Error(
        `Tingkat keparahan tidak valid. Pilihan yang tersedia: ${VALID_REPORT_SEVERITIES.join(', ')}.`
      );
    }
  }

  if (payload.category !== undefined) {
    const normalizedCategory = String(payload.category).trim().toLowerCase();
    if (!VALID_REPORT_CATEGORIES.includes(normalizedCategory)) {
      throw new Error(
        `Kategori kerusakan tidak valid. Pilihan yang tersedia: ${VALID_REPORT_CATEGORIES.join(', ')}.`
      );
    }
  }

  if (payload.latitude !== undefined || payload.longitude !== undefined) {
    if (payload.latitude === undefined || payload.longitude === undefined) {
      throw new Error('Latitude dan longitude harus diperbarui secara bersamaan.');
    }
    validateCoordinates(payload.latitude, payload.longitude, { required: true });
  }
};

/**
 * Membersihkan kata kunci pencarian dari karakter kontrol filter PostgREST (koma, tanda kurung, wildcard).
 */
export const sanitizeSearchKeyword = (rawSearch) => {
  if (!rawSearch || typeof rawSearch !== 'string') {
    return '';
  }
  return rawSearch
    .replace(/[,().%*_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
};

/**
 * Memvalidasi dan menormalkan image_url agar hanya berasal dari path lokal (/uploads, /samples)
 * atau domain backend/Supabase Storage yang sah (mencegah URL javascript:, data:, atau domain eksternal sembarang).
 */
export const sanitizeReportImageUrl = (rawUrl) => {
  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === '') {
    return null;
  }

  const trimmed = String(rawUrl).trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/samples/')) {
    if (trimmed.includes('..')) {
      throw new Error('URL gambar tidak valid.');
    }
    return trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Format image_url tidak valid.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Protokol image_url hanya boleh HTTP atau HTTPS.');
  }

  const allowedHosts = new Set(['localhost', '127.0.0.1']);
  for (const envUrl of [process.env.BACKEND_PUBLIC_URL, process.env.SUPABASE_URL]) {
    if (envUrl) {
      try {
        allowedHosts.add(new URL(envUrl).hostname);
      } catch {
        // Abaikan env URL yang tidak valid
      }
    }
  }

  const isPrivateLan =
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname);

  if (!allowedHosts.has(parsed.hostname) && !isPrivateLan) {
    throw new Error('Sumber image_url tidak diizinkan.');
  }

  return parsed.toString();
};
