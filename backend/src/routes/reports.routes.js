import { Router } from 'express';
import multer from 'multer';
import * as reportsController from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Konfigurasi multer untuk menerima unggahan foto kerusakan jalan (maksimal 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPEG, PNG, WebP) yang diperbolehkan!'), false);
    }
  },
});

// Endpoint Publik / Umum: Daftar seluruh laporan
router.get('/', reportsController.getAll);

// Endpoint Terproteksi: Riwayat laporan milik pengguna yang sedang login (harus di atas /:id)
router.get('/my-reports', requireAuth, reportsController.getMyReports);

// Endpoint Publik / Umum: Detail 1 laporan berdasarkan UUID
router.get('/:id', reportsController.getById);

// Endpoint Terproteksi: Analisis AI (YOLO + LLM) untuk menyusun draf laporan sebelum dikirim
router.post('/analyze', requireAuth, upload.single('image'), reportsController.analyzeDraft);

// Endpoint Terproteksi: Membuat laporan baru (mendukung JSON maupun multipart/form-data dengan field 'image')
router.post('/', requireAuth, upload.single('image'), reportsController.create);

// Endpoint Terproteksi: Memperbarui laporan (oleh pelapor saat masih draft/submitted atau oleh admin)
router.put('/:id', requireAuth, reportsController.update);
router.patch('/:id', requireAuth, reportsController.update);

// Endpoint Terproteksi: Menghapus laporan
router.delete('/:id', requireAuth, reportsController.remove);

export default router;

