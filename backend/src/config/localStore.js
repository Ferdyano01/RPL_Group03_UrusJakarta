import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'local-db.json');

let lastStorageMode = 'supabase';

export const getStorageMode = () => lastStorageMode;
export const setStorageMode = (mode) => {
  lastStorageMode = mode;
};

/**
 * Mengecek apakah error dari Supabase disebabkan oleh kendala jaringan/offline/konfigurasi tabel
 * sehingga perlu dialihkan secara transparan ke Local Store Fallback.
 */
export const shouldFallbackToLocal = (error) => {
  if (!error) return false;
  const msg = String(error.message || error.details || error || '').toLowerCase();
  const code = String(error.code || '').toUpperCase();

  // Jangan fallback jika error bisnis murni seperti email duplikat (23505)
  if (code === '23505') return false;

  return (
    msg.includes('fetch failed') ||
    msg.includes('eai_again') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('invalid api key') ||
    msg.includes('jwt') ||
    msg.includes('schema cache') ||
    code.startsWith('PGRST') ||
    code === '42P01'
  );
};

const createInitialSeed = () => {
  const demoUserId = '11111111-1111-4111-8111-111111111111';
  const adminUserId = '22222222-2222-4222-8222-222222222222';
  // Hash untuk "Password123!"
  const defaultHash = bcrypt.hashSync('Password123!', 10);

  const authorityId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const report1Id = 'r1111111-1111-4111-8111-111111111111';
  const report2Id = 'r2222222-2222-4222-8222-222222222222';
  const report3Id = 'r3333333-3333-4333-8333-333333333333';

  return {
    users: [
      {
        id: demoUserId,
        email: 'warga@jakarta.id',
        password_hash: defaultHash,
        full_name: 'Budi Warga Jakarta',
        role: 'citizen',
        phone_number: '081234567890',
        created_at: '2026-10-10T08:00:00.000Z',
        updated_at: '2026-10-10T08:00:00.000Z',
      },
      {
        id: adminUserId,
        email: 'admin@jakarta.id',
        password_hash: defaultHash,
        full_name: 'Petugas Dinas Bina Marga',
        role: 'admin',
        phone_number: '0213844444',
        created_at: '2026-10-01T08:00:00.000Z',
        updated_at: '2026-10-01T08:00:00.000Z',
      },
    ],
    authorities: [
      {
        id: authorityId,
        name: 'Dinas Bina Marga DKI Jakarta',
        region: 'DKI Jakarta',
        contact_email: 'binamarga@jakarta.go.id',
        created_at: '2026-10-01T08:00:00.000Z',
      },
    ],
    reports: [
      {
        id: report1Id,
        user_id: demoUserId,
        title: 'Laporan Lubang Jalan (Pothole) - Jl. D.I. Panjaitan No. 18',
        description:
          'Berdasarkan analisis citra visual AI, terdeteksi 4 titik Lubang Jalan (Pothole) (akurasi maks 75.5%) pada lokasi Jl. D.I. Panjaitan No. 18, Jatinegara, Jakarta Timur (-6.2255, 106.871). Tingkat keparahan kerusakan diklasifikasikan sebagai parah / prioritas tinggi (high). Keterangan pelapor: "Banyak kubangan lubang aspal dalam dan tergenang air di lajur kiri".',
        category: 'pothole',
        severity: 'high',
        latitude: -6.2255,
        longitude: 106.871,
        address: 'Jl. D.I. Panjaitan No. 18, Jatinegara, Jakarta Timur',
        image_url: '/samples/rusak3.jpg',
        ai_analysis: {
          analyzed_at: '2026-10-10T09:15:00.000Z',
          vision_service_available: true,
          total_detections: 4,
          classes_detected: {
            lubang: { count: 4, max_confidence: 0.7554 },
          },
          detections: [
            {
              detection_id: 0,
              class_id: 0,
              class: 'lubang',
              confidence: 0.7554,
              bounding_box: { x1: 27.6, y1: 141.7, x2: 194.2, y2: 205.5 },
            },
            {
              detection_id: 1,
              class_id: 0,
              class: 'lubang',
              confidence: 0.7412,
              bounding_box: { x1: 112.4, y1: 86.1, x2: 218.8, y2: 145.0 },
            },
          ],
          image_dimensions: { width: 275, height: 183 },
          max_confidence: 0.7554,
          primary_damage_label: 'Lubang Jalan (Pothole)',
          needs_manual_review: false,
          narrative_generator: 'template_orchestrator',
          original_user_description: 'Banyak kubangan lubang aspal dalam dan tergenang air di lajur kiri',
          visual_severity: 'high',
          effective_severity: 'high',
          severity_adjusted: false,
          severity_adjustment_reason: null,
          strategic_score: 62,
          priority_score: 76,
          support_count: 1,
          location_context: {
            strategic_score: 62,
            strategic_tier: 'medium',
            road_class: 'arterial',
            road_class_label: 'Jalan Arteri / Protokol',
            population_density_tier: 'medium',
            detected_region: 'Jakarta Timur',
            nearby_vital_facilities: [],
            nearby_report_count: 0,
            duplicate_count: 0,
            data_source: 'local_heuristic',
          },
        },
        status: 'in_progress',
        created_at: '2026-10-10T09:15:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
      {
        id: report2Id,
        user_id: demoUserId,
        title: 'Laporan Lubang Jalan (Pothole) - Jl. Gajah Mada No. 12',
        description:
          'Berdasarkan analisis citra visual AI, terdeteksi 2 titik Lubang Jalan (Pothole) serta 1 titik Retak Kulit Buaya pada lokasi Jl. Gajah Mada No. 12, Gambir, Jakarta Pusat (-6.1628, 106.8195). Tingkat keparahan kerusakan diklasifikasikan sebagai sedang (medium).',
        category: 'pothole',
        severity: 'medium',
        latitude: -6.1628,
        longitude: 106.8195,
        address: 'Jl. Gajah Mada No. 12, Gambir, Jakarta Pusat',
        image_url: '/samples/rusak1.jpeg',
        ai_analysis: {
          analyzed_at: '2026-10-11T14:20:00.000Z',
          vision_service_available: true,
          total_detections: 3,
          classes_detected: {
            lubang: { count: 2, max_confidence: 0.621 },
            retak_kulit_buaya: { count: 1, max_confidence: 0.512 },
          },
          detections: [],
          image_dimensions: { width: 640, height: 480 },
          max_confidence: 0.621,
          primary_damage_label: 'Lubang Jalan (Pothole)',
          needs_manual_review: false,
          narrative_generator: 'template_orchestrator',
          original_user_description: 'Lubang cukup mengganggu pengendara motor dekat halte TransJakarta',
          visual_severity: 'medium',
          effective_severity: 'high',
          severity_adjusted: true,
          severity_adjustment_reason: 'Dinaikkan dari Sedang ke Parah karena lokasi strategis tinggi (skor 70/100).',
          strategic_score: 70,
          priority_score: 61,
          support_count: 1,
          location_context: {
            strategic_score: 70,
            strategic_tier: 'high',
            road_class: 'arterial',
            road_class_label: 'Jalan Arteri / Protokol',
            population_density_tier: 'high',
            detected_region: 'Jakarta Pusat',
            nearby_vital_facilities: ['Halte / Stasiun Transit'],
            nearby_report_count: 0,
            duplicate_count: 0,
            data_source: 'local_heuristic',
          },
        },
        status: 'submitted',
        created_at: '2026-10-11T14:20:00.000Z',
        updated_at: '2026-10-11T14:20:00.000Z',
      },
      {
        id: report3Id,
        user_id: demoUserId,
        title: 'Laporan Pengelupasan Permukaan Aspal - Jl. Gatot Subroto Kav. 32',
        description:
          'Berdasarkan analisis citra visual AI, terdeteksi 2 titik Pengelupasan Lapisan Permukaan Aspal pada lokasi Jl. Gatot Subroto Kav. 32, Kuningan, Jakarta Selatan (-6.2349, 106.8236). Perbaikan tambal sulam telah diselesaikan oleh Satgas Bina Marga.',
        category: 'surface_damage',
        severity: 'medium',
        latitude: -6.2349,
        longitude: 106.8236,
        address: 'Jl. Gatot Subroto Kav. 32, Kuningan, Jakarta Selatan',
        image_url: '/samples/rusak2.jpg',
        ai_analysis: {
          analyzed_at: '2026-10-08T11:00:00.000Z',
          vision_service_available: true,
          total_detections: 2,
          classes_detected: {
            pengelupasan_lapisan_permukaan: { count: 2, max_confidence: 0.684 },
          },
          detections: [],
          image_dimensions: { width: 640, height: 480 },
          max_confidence: 0.684,
          primary_damage_label: 'Pengelupasan Lapisan Permukaan Aspal',
          needs_manual_review: false,
          narrative_generator: 'template_orchestrator',
          original_user_description: 'Lapisan aspal mengelupas pasca hujan deras',
          visual_severity: 'medium',
          effective_severity: 'medium',
          severity_adjusted: false,
          severity_adjustment_reason: null,
          strategic_score: 52,
          priority_score: 54,
          support_count: 1,
          location_context: {
            strategic_score: 52,
            strategic_tier: 'medium',
            road_class: 'arterial',
            road_class_label: 'Jalan Arteri / Protokol',
            population_density_tier: 'medium',
            detected_region: 'Jakarta Selatan',
            nearby_vital_facilities: [],
            nearby_report_count: 0,
            duplicate_count: 0,
            data_source: 'local_heuristic',
          },
        },
        status: 'fixed',
        created_at: '2026-10-08T11:00:00.000Z',
        updated_at: '2026-10-12T16:30:00.000Z',
      },
    ],
    status_history: [
      {
        id: crypto.randomUUID(),
        report_id: report1Id,
        changed_by: demoUserId,
        previous_status: null,
        new_status: 'submitted',
        notes: 'Laporan baru dikirim oleh warga dan diproses oleh sistem AI.',
        created_at: '2026-10-10T09:15:00.000Z',
      },
      {
        id: crypto.randomUUID(),
        report_id: report1Id,
        changed_by: adminUserId,
        previous_status: 'submitted',
        new_status: 'in_progress',
        notes: 'Diteruskan ke Satgas Dinas Bina Marga Jakarta Timur untuk penanganan lapangan.',
        created_at: '2026-10-11T10:00:00.000Z',
      },
      {
        id: crypto.randomUUID(),
        report_id: report2Id,
        changed_by: demoUserId,
        previous_status: null,
        new_status: 'submitted',
        notes: 'Laporan baru dikirim oleh warga dan diproses oleh sistem AI.',
        created_at: '2026-10-11T14:20:00.000Z',
      },
      {
        id: crypto.randomUUID(),
        report_id: report3Id,
        changed_by: demoUserId,
        previous_status: null,
        new_status: 'submitted',
        notes: 'Laporan baru dikirim oleh warga dan diproses oleh sistem AI.',
        created_at: '2026-10-08T11:00:00.000Z',
      },
      {
        id: crypto.randomUUID(),
        report_id: report3Id,
        changed_by: adminUserId,
        previous_status: 'submitted',
        new_status: 'fixed',
        notes: 'Pengaspalan ulang telah selesai dikerjakan oleh tim lapangan.',
        created_at: '2026-10-12T16:30:00.000Z',
      },
    ],
    report_routings: [
      {
        id: crypto.randomUUID(),
        report_id: report1Id,
        authority_id: authorityId,
        routed_at: '2026-10-11T10:00:00.000Z',
        notes: 'Prioritas tinggi - penanganan lubang jalan arteri Jakarta Timur.',
      },
    ],
  };
};

export const readLocalDb = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const seed = createInitialSeed();
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[LocalStore] Gagal membaca local-db.json, membuat ulang seed:', err.message);
    return createInitialSeed();
  }
};

export const writeLocalDb = (dbData) => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
};

