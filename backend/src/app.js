import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import { checkRoadAiHealth } from './services/ai.service.js';
import { getStorageMode } from './config/localStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files untuk gambar unggahan lokal dan sampel citra Road-AI
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
app.use('/samples', express.static(path.resolve(__dirname, '../../road-ai/samples/input')));

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

// Global Error Handler (termasuk untuk error Multer / ukuran file)
app.use((err, req, res, next) => {
  return res.status(400).json({
    status: 'error',
    message: err.message || 'Terjadi kesalahan pada server.',
  });
});

export default app;
