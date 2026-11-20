#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo " 🚀 Menjalankan Ekosistem UrusJakarta (AI + Backend + Frontend)"
echo "============================================================"

cleanup() {
  echo ""
  echo "🛑 Menghentikan service yang dijalankan oleh skrip ini..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Jalankan Road-AI Service (Port 8000) jika belum aktif
echo "🤖 [1/3] Memeriksa Road-AI (FastAPI YOLO) di http://localhost:8000 ..."
if curl -s http://localhost:8000/health | grep -q '"status":"ok"'; then
  echo "   ✅ Road-AI sudah berjalan dan siap di http://localhost:8000"
else
  # Bersihkan port 8000 jika ada proses lama yang menggantung
  fuser -k 8000/tcp >/dev/null 2>&1 || true
  sleep 1
  echo "   ▶️ Menyalakan server Road-AI di http://localhost:8000 ..."
  (
    cd "$ROOT_DIR/road-ai"
    MODEL_PATH="models/trained/road_damage_v1_best.pt" ./.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
  ) &
fi

# 2. Jalankan Backend Express API (Port 5000)
echo "⚙️  [2/3] Menjalankan Backend API (Express) di http://localhost:5000 ..."
fuser -k 5000/tcp >/dev/null 2>&1 || true
sleep 1
(
  cd "$ROOT_DIR/backend"
  node src/server.js
) &

sleep 2

# 3. Jalankan Frontend Expo (Port 8081)
echo "📱 [3/3] Menjalankan Frontend (Expo) di http://localhost:8081 ..."
echo "   Tekan 'w' untuk membuka versi Web di browser, atau buka http://localhost:8081"
cd "$ROOT_DIR/frontend"
npx expo start --web
