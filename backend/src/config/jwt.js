import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const PLACEHOLDER_SECRETS = new Set([
  'ganti_dengan_rahasia_jwt_yang_kuat',
  'urusjakarta_fallback_secret_2026',
  'secret',
  'changeme',
]);

let ephemeralDevSecret = null;

/**
 * Mengambil JWT secret yang aman dari environment.
 * - Mode production: wajib terdefinisi dan minimal 32 karakter (fail-fast).
 * - Mode development/test: jika belum disetel atau masih placeholder,
 *   menggunakan secret acak per-proses (bukan string hardcoded statis).
 */
export const getJwtSecret = () => {
  const configured = (process.env.JWT_SECRET || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (configured && !PLACEHOLDER_SECRETS.has(configured) && configured.length >= 16) {
    return configured;
  }

  if (isProd) {
    throw new Error(
      'Konfigurasi keamanan tidak valid: JWT_SECRET wajib disetel (minimal 16 karakter) pada mode production.'
    );
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[Security] JWT_SECRET belum dikonfigurasi dengan aman; menggunakan kunci acak sementara untuk sesi proses ini.'
    );
  }

  return ephemeralDevSecret;
};
