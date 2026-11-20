import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import { checkRoadAiHealth } from './services/ai.service.js';
import { getStorageMode } from './config/localStore.js';
import { createRateLimiter } from './middlewares/rateLimit.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
// Percayai reverse proxy (Nginx/Caddy/Cloudflare) agar req.ip akurat untuk rate limiting
app.set('trust proxy', process.env.TRUST_PROXY === 'false' ? false : 1);

// Security headers standar (pengganti ringan helmet tanpa dependensi tambahan)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

// Konfigurasi CORS aman: izinkan origin terdaftar, atau localhost/LAN pada mode development
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Aplikasi native mobile (Expo Go), curl, & test suite
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
};

// Middlewares
app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Origin tidak diizinkan oleh kebijakan CORS.'));
      }
    },
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiter umum pada seluruh endpoint /api
app.use(
  '/api',
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 300,
  })
);

const staticAssetOptions = {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  },
};

// Static files untuk gambar unggahan lokal dan sampel citra Road-AI
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), staticAssetOptions));
app.use('/samples', express.static(path.resolve(__dirname, '../../road-ai/samples/input'), staticAssetOptions));

// Health check endpoint (termasuk status integrasi Road-AI)
app.get('/api/health', async (req, res) => {
  const aiStatus = await checkRoadAiHealth();
  res.status(200).json({
    status: 'success',
    message: 'UrusJakarta Backend API berjalan normal.',
    storage_mode: getStorageMode(),
    ai_service: aiStatus,
  });
});

// Daftar sampel foto jalan rusak & normal dari road-ai untuk kemudahan pengujian
app.get('/api/samples', (req, res) => {
  const samples = [
    {
      id: 'rusak3.jpg',
      filename: 'rusak3.jpg',
      label: 'Lubang Jalan Parah & Genangan',
      image_url: '/samples/rusak3.jpg',
      address: 'Jl. D.I. Panjaitan No. 18, Jatinegara, Jakarta Timur',
      latitude: -6.2255,
      longitude: 106.871,
      description: 'Banyak kubangan lubang aspal dalam dan tergenang air di lajur kiri',
    },
    {
      id: 'rusak1.jpeg',
      filename: 'rusak1.jpeg',
      label: 'Lubang & Retak Permukaan',
      image_url: '/samples/rusak1.jpeg',
      address: 'Jl. Gajah Mada No. 12, Gambir, Jakarta Pusat',
      latitude: -6.1628,
      longitude: 106.8195,
      description: 'Lubang jalan cukup dalam dekat halte busway membahayakan pengendara motor',
    },
    {
      id: 'rusak2.jpg',
      filename: 'rusak2.jpg',
      label: 'Kerusakan & Pengelupasan Aspal',
      image_url: '/samples/rusak2.jpg',
      address: 'Jl. Gatot Subroto Kav. 32, Kuningan, Jakarta Selatan',
      latitude: -6.2349,
      longitude: 106.8236,
      description: 'Permukaan aspal mengelupas dan berlubang pasca hujan deras',
    },
    {
      id: 'road.jpg',
      filename: 'road.jpg',
      label: 'Jalan Mulus / Normal (Uji 0 Deteksi)',
      image_url: '/samples/road.jpg',
      address: 'Jl. M.H. Thamrin No. 1, Menteng, Jakarta Pusat',
      latitude: -6.1931,
      longitude: 106.823,
      description: 'Kondisi aspal mulus dan marka jalan terlihat rapi',
    },
  ];
  res.status(200).json({
    status: 'success',
    data: samples,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportsRoutes);

// Global Error Handler (termasuk untuk error Multer / ukuran file / CORS)
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isClientError =
    err.name === 'MulterError' ||
    err.type === 'entity.parse.failed' ||
    err.message?.includes('CORS') ||
    err.message?.includes('Hanya file gambar') ||
    err.message?.includes('signature biner');

  const statusCode = isClientError ? 400 : err.statusCode || 400;
  const message =
    isProd && !isClientError
      ? 'Terjadi kesalahan pada server.'
      : err.message || 'Terjadi kesalahan pada server.';

  return res.status(statusCode).json({
    status: 'error',
    message,
  });
});

export default app;
