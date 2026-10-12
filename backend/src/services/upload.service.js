import { supabaseAdmin } from '../config/supabaseClient.js';

export const uploadImageToSupabase = async (file) => {
  // Ambil ekstensi file (misal: jpg, png)
  const fileExt = file.originalname.split('.').pop();
  
  // Buat nama file yang unik agar tidak bentrok
  const fileName = `report-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
  const filePath = `uploads/${fileName}`; // Path folder di dalam bucket

  // Upload buffer file ke Supabase Storage menggunakan supabaseAdmin
  const { data, error } = await supabaseAdmin.storage
    .from('reports')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah gambar: ${error.message}`);
  }

  // Dapatkan Public URL dari file yang baru diunggah (bisa pakai supabaseAdmin juga)
  const { data: publicUrlData } = supabaseAdmin.storage
    .from('reports')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};