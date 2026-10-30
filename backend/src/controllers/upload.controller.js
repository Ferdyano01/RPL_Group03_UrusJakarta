import { uploadImageToSupabase } from '../services/upload.service.js';

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada file gambar yang dilampirkan.' });
    }

    // Panggil service upload
    const imageUrl = await uploadImageToSupabase(req.file);

    return res.status(200).json({
      status: 'success',
      message: 'Gambar berhasil diunggah!',
      data: {
        url: imageUrl
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};