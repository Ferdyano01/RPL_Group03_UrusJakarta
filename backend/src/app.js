import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/auth.routes.js';
import reportsRoutes from './routes/reports.routes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'UrusJakarta Backend API berjalan normal.' });
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