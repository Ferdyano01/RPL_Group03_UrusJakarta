/**
 * Memeriksa magic bytes biner gambar agar tidak hanya mengandalkan header MIME atau ekstensi nama file.
 */
export const detectImageSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // WebP: "RIFF" (0..3) + "WEBP" (8..11)
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
};

/**
 * Memvalidasi buffer file gambar yang diunggah dan mengembalikan tipe biner terverifikasi.
 */
export const assertValidImageBuffer = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('File gambar tidak valid.');
  }
  const detected = detectImageSignature(file.buffer);
  if (!detected) {
    throw new Error(
      'Isi berkas bukan gambar JPEG, PNG, atau WebP yang valid (signature biner ditolak).'
    );
  }
  return detected;
};
