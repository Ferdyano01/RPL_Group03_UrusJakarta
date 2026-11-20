import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { assertValidImageBuffer } from '../validators/upload.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export const uploadImageToSupabase = async (file) => {
  // Validasi magic bytes biner gambar & tentukan ekstensi/MIME yang terverifikasi
  const { ext: fileExt, mime: verifiedMime } = assertValidImageBuffer(file);

  // Buat nama file yang unik agar tidak bentrok
  const fileName = `report-${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
  const filePath = `uploads/${fileName}`; // Path folder di dalam bucket

  try {
    // Upload buffer file ke Supabase Storage menggunakan supabaseAdmin
    const { error } = await supabaseAdmin.storage
      .from('reports')
      .upload(filePath, file.buffer, {
        contentType: verifiedMime,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    // Dapatkan Public URL dari file yang baru diunggah
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('reports')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    // Fallback otomatis ke penyimpanan lokal (backend/uploads/) jika Supabase Storage offline atau bucket belum dibuat
    console.warn(`[Upload Service] Menyimpan gambar ke penyimpanan lokal karena Supabase Storage tidak tersedia (${err.message}).`);
    if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
      fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
    }
    const localFilePath = path.join(LOCAL_UPLOADS_DIR, fileName);
    fs.writeFileSync(localFilePath, file.buffer);

    const baseUrl = (
      process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`
    ).replace(/\/+$/, '');
    return `${baseUrl}/uploads/${fileName}`;
  }
};
