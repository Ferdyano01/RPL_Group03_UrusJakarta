import { Router } from 'express';
import multer from 'multer';
import * as reportsController from '../controllers/reports.controller.js';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();
const analyzeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  message: 'Terlalu banyak permintaan analisis AI. Silakan coba lagi beberapa menit lagi.',
});

// Konfigurasi multer untuk menerima unggahan foto kerusakan jalan (maksimal 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPEG, PNG, WebP) yang diperbolehkan!'), false);
    }
  },
});

// Endpoint Publik / Umum: Daftar seluruh laporan (tanpa PII pelapor)
router.get('/', optionalAuth, reportsController.getAll);

// Endpoint Terproteksi: Riwayat laporan milik pengguna yang sedang login (harus di atas /:id)
router.get('/my-reports', requireAuth, reportsController.getMyReports);

// Endpoint Publik / Umum: Daftar instansi tujuan routing laporan (harus di atas /:id)
router.get('/authorities', reportsController.getAuthorities);

// Endpoint Publik / Umum: Konversi koordinat GPS menjadi nama jalan (harus di atas /:id)
router.get('/reverse-geocode', reportsController.reverseGeocode);

// Endpoint Publik / Umum: Detail 1 laporan berdasarkan UUID (PII hanya untuk pemilik/petugas)
router.get('/:id', optionalAuth, reportsController.getById);

// Endpoint Terproteksi: Analisis AI (YOLO + LLM) untuk menyusun draf laporan sebelum dikirim
router.post('/analyze', requireAuth, analyzeRateLimiter, upload.single('image'), reportsController.analyzeDraft);

// Endpoint Terproteksi: Membuat laporan baru (mendukung JSON maupun multipart/form-data dengan field 'image')
router.post('/', requireAuth, upload.single('image'), reportsController.create);

// Endpoint Terproteksi: Konfirmasi laporan aktif terdekat sebagai duplikat lokasi yang sama (+1 dukungan)
router.post('/:id/confirm-duplicate', requireAuth, reportsController.confirmDuplicate);

// Endpoint Terproteksi (Petugas / Admin): Teruskan laporan ke instansi tujuan
router.post(
  '/:id/route',
  requireAuth,
  requireRole(['officer', 'admin']),
  reportsController.routeReport
);

// Endpoint Terproteksi: Memperbarui laporan (oleh pelapor saat masih draft/submitted atau oleh admin)
router.put('/:id', requireAuth, reportsController.update);
router.patch('/:id', requireAuth, reportsController.update);

// Endpoint Terproteksi: Menghapus laporan
router.delete('/:id', requireAuth, reportsController.remove);

export default router;

