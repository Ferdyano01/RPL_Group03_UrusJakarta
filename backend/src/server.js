import app from './app.js';
import dotenv from 'dotenv';
import { getJwtSecret } from './config/jwt.js';

dotenv.config();

// Validasi konfigurasi keamanan lebih awal saat startup (fail-fast pada mode production)
getJwtSecret();

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server backend berjalan di: http://${HOST}:${PORT}`);
});