import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const ROAD_AI_DIR = path.resolve(__dirname, '../../../road-ai');
const LOCAL_VENV_PYTHON = path.join(ROAD_AI_DIR, '.venv', 'bin', 'python');
const LOCAL_YOLO_MODEL = path.join(ROAD_AI_DIR, 'models', 'trained', 'road_damage_v1_best.pt');

const ROAD_AI_URL = process.env.ROAD_AI_URL || 'http://localhost:8000';

// 1. Primary LLM: Qwen pada IP Tailscale (Ollama / OpenAI-compatible endpoint)
const QWEN_API_URL = process.env.QWEN_API_URL || process.env.LLM_API_URL || '';
const QWEN_API_KEY = process.env.QWEN_API_KEY || process.env.LLM_API_KEY || '';
const QWEN_MODEL = process.env.QWEN_MODEL || process.env.LLM_MODEL || 'qwen2.5:7b';
const QWEN_CONNECT_TIMEOUT_MS = Number(process.env.QWEN_CONNECT_TIMEOUT_MS) || 1500;
const QWEN_TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS) || 5000;

// 2. Secondary LLM (Fallback): Google Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_BACKUP_MODEL = process.env.GEMINI_BACKUP_MODEL || 'gemini-flash-lite-latest';
const GEMINI_API_URL = process.env.GEMINI_API_URL || '';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 12000;

// Pemetaan nama kelas dari model YOLO (road_damage.yaml) ke kategori standar laporan
const YOLO_CLASS_TO_CATEGORY = {
  lubang: 'pothole',
  pengelupasan_lapisan_permukaan: 'surface_damage',
  retak_blok: 'crack',
  retak_kulit_buaya: 'crack',
  retak_memanjang: 'crack',
  retak_pinggir: 'crack',
};

const YOLO_CLASS_LABELS_ID = {
  lubang: 'Lubang Jalan (Pothole)',
  pengelupasan_lapisan_permukaan: 'Pengelupasan Lapisan Permukaan Aspal',
  retak_blok: 'Retak Blok',
  retak_kulit_buaya: 'Retak Kulit Buaya (Alligator Cracking)',
  retak_memanjang: 'Retak Memanjang',
  retak_pinggir: 'Retak Pinggir Jalan',
};

/**
 * Fallback inferensi YOLO langsung menggunakan Python .venv lokal jika server FastAPI belum dinyalakan
 */
const runLocalPythonYoloFallback = async (fileBuffer, originalname = 'image.jpg') => {
  if (!fs.existsSync(LOCAL_VENV_PYTHON) || !fs.existsSync(LOCAL_YOLO_MODEL)) {
    return null;
  }

  const ext = path.extname(originalname) || '.jpg';
  const tmpFile = path.join(
    os.tmpdir(),
    `urusjakarta-yolo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  );

  try {
    fs.writeFileSync(tmpFile, fileBuffer);
    const pyScript = `
import json, sys
from PIL import Image
from ultralytics import YOLO

model_path, img_path, orig_name = sys.argv[1], sys.argv[2], sys.argv[3]
image = Image.open(img_path).convert("RGB")
model = YOLO(model_path)
result = model.predict(source=image, conf=0.15, iou=0.6, device="cpu", verbose=False)[0]
detections = []
if result.boxes is not None:
    for idx in range(len(result.boxes)):
        box = result.boxes.xyxy[idx].tolist()
        cls_id = int(result.boxes.cls[idx])
        detections.append({
            "detection_id": idx,
            "class_id": cls_id,
            "class": model.names[cls_id],
            "confidence": round(float(result.boxes.conf[idx]), 4),
            "bounding_box": {
                "x1": round(box[0], 1),
                "y1": round(box[1], 1),
                "x2": round(box[2], 1),
                "y2": round(box[3], 1),
            },
        })
class_counts = {}
for det in detections:
    cname = det["class"]
    cur = class_counts.setdefault(cname, {"count": 0, "max_confidence": 0.0})
    cur["count"] += 1
    cur["max_confidence"] = max(cur["max_confidence"], det["confidence"])
out = {
    "image": orig_name,
    "dimensions": {"width": image.width, "height": image.height},
    "detections": detections,
    "summary": {"total_detections": len(detections), "classes_detected": class_counts},
}
print("__YOLO_JSON_START__" + json.dumps(out) + "__YOLO_JSON_END__")
`;
    const { stdout } = await execFileAsync(
      LOCAL_VENV_PYTHON,
      ['-c', pyScript, LOCAL_YOLO_MODEL, tmpFile, originalname],
      { timeout: 25000 }
    );
    const match = stdout.match(/__YOLO_JSON_START__([\s\S]*?)__YOLO_JSON_END__/);
    if (match) {
      return JSON.parse(match[1]);
    }
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // Abaikan
    }
  }
};

/**
 * Memanggil service FastAPI road-ai (POST /predict) untuk mendeteksi kerusakan jalan menggunakan YOLO
 */
export const detectRoadDamageWithYOLO = async (fileBuffer, originalname = 'image.jpg', mimetype = 'image/jpeg') => {
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimetype });
    formData.append('file', blob, originalname);

    const response = await fetch(`${ROAD_AI_URL}/predict?conf=0.15&iou=0.6`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000), // Timeout 15 detik
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Road-AI merespons dengan status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return {
      available: true,
      ...result,
    };
  } catch (error) {
    console.warn(`[AI Service] Gagal menghubungi Road-AI di ${ROAD_AI_URL}/predict (${error.message}), mencoba fallback Python YOLO lokal...`);
    try {
      const localResult = await runLocalPythonYoloFallback(fileBuffer, originalname);
      if (localResult) {
        return {
          available: true,
          ...localResult,
        };
      }
    } catch (localErr) {
      console.warn('[AI Service] Fallback Python YOLO lokal gagal:', localErr.message);
    }

    return {
      available: false,
      error: error.message,
      image: originalname,
      dimensions: null,
      detections: [],
      summary: {
        total_detections: 0,
        classes_detected: {},
      },
    };
  }
};

/**
 * Menentukan kategori utama, tingkat keparahan (severity), dan rekomendasi status berdasarkan hasil deteksi YOLO
 */
export const evaluateDamageMetrics = (visionResult, userDescription = '') => {
  const detections = visionResult?.detections || [];
  const classesDetected = visionResult?.summary?.classes_detected || {};
  const totalDetections = detections.length;

  // Jika tidak ada deteksi dari YOLO (atau service AI sedang offline), analisis dari teks deskripsi pengguna
  if (totalDetections === 0) {
    const lowerDesc = (userDescription || '').toLowerCase();
    const hasDamageKeyword =
      lowerDesc.includes('lubang') ||
      lowerDesc.includes('berlubang') ||
      lowerDesc.includes('retak') ||
      lowerDesc.includes('trotoar') ||
      lowerDesc.includes('kelupas') ||
      lowerDesc.includes('rusak') ||
      lowerDesc.includes('amblas') ||
      lowerDesc.includes('pecah') ||
      lowerDesc.includes('hancur') ||
      lowerDesc.includes('bergelombang');

    const hasNormalKeyword =
      lowerDesc.includes('mulus') ||
      lowerDesc.includes('normal') ||
      lowerDesc.includes('rapi') ||
      lowerDesc.includes('baik') ||
      lowerDesc.includes('tidak rusak') ||
      lowerDesc.includes('tidak ada kerusakan');

    // Jika YOLO berhasil menganalisis gambar tetapi 0 deteksi dan tidak ada indikasi kerusakan di teks
    if (visionResult?.available && (!hasDamageKeyword || hasNormalKeyword)) {
      return {
        category: 'undamaged',
        primary_damage_label: 'Kondisi Jalan Normal (Tidak Terdeteksi Kerusakan)',
        severity: 'low',
        max_confidence: 0,
        needs_manual_review: true,
        suggested_status: 'pending_review',
      };
    }

    let fallbackCategory = 'pothole';
    let fallbackSeverity = 'medium';

    if (lowerDesc.includes('retak')) {
      fallbackCategory = 'crack';
    } else if (lowerDesc.includes('trotoar')) {
      fallbackCategory = 'sidewalk_damage';
    } else if (lowerDesc.includes('kelupas') || lowerDesc.includes('aspal')) {
      fallbackCategory = 'surface_damage';
    }

    if (lowerDesc.includes('parah') || lowerDesc.includes('besar') || lowerDesc.includes('dalam') || lowerDesc.includes('bahaya')) {
      fallbackSeverity = 'high';
    } else if (lowerDesc.includes('kecil') || lowerDesc.includes('ringan')) {
      fallbackSeverity = 'low';
    }

    return {
      category: fallbackCategory,
      primary_damage_label: fallbackCategory === 'pothole' ? 'Lubang Jalan' : 'Kerusakan Permukaan Jalan',
      severity: fallbackSeverity,
      max_confidence: 0,
      needs_manual_review: true,
      suggested_status: 'pending_review',
    };
  }

  // Cari kelas dengan jumlah terbanyak atau confidence tertinggi
  let dominantClass = detections[0].class;
  let maxConfidence = 0;

  for (const det of detections) {
    if (det.confidence > maxConfidence) {
      maxConfidence = det.confidence;
      dominantClass = det.class;
    }
  }

  const category = YOLO_CLASS_TO_CATEGORY[dominantClass] || 'pothole';
  const primaryDamageLabel = YOLO_CLASS_LABELS_ID[dominantClass] || dominantClass;

  // Hitung proporsi luas bounding box terbesar terhadap ukuran gambar
  const imgArea =
    visionResult.dimensions?.width && visionResult.dimensions?.height
      ? visionResult.dimensions.width * visionResult.dimensions.height
      : 0;

  let maxRelativeBoxArea = 0;
  if (imgArea > 0) {
    for (const det of detections) {
      const box = det.bounding_box;
      if (box) {
        const boxArea = Math.max(0, box.x2 - box.x1) * Math.max(0, box.y2 - box.y1);
        maxRelativeBoxArea = Math.max(maxRelativeBoxArea, boxArea / imgArea);
      }
    }
  }

  const potholeCount = classesDetected.lubang?.count || 0;
  const alligatorCrackCount = classesDetected.retak_kulit_buaya?.count || 0;

  // Penentuan tingkat keparahan (low, medium, high)
  let severity = 'low';
  if (
    potholeCount >= 3 ||
    maxRelativeBoxArea >= 0.08 ||
    (potholeCount >= 1 && maxConfidence >= 0.65) ||
    alligatorCrackCount >= 2
  ) {
    severity = 'high';
  } else if (potholeCount >= 1 || totalDetections >= 2 || maxRelativeBoxArea >= 0.03) {
    severity = 'medium';
  }

  // Sesuai State Machine: jika confidence rendah (< 0.45), arahkan ke pending_review untuk verifikasi moderator
  const needsManualReview = maxConfidence < 0.45;
  const suggestedStatus = needsManualReview ? 'pending_review' : 'submitted';

  return {
    category,
    primary_damage_label: primaryDamageLabel,
    severity,
    max_confidence: Number(maxConfidence.toFixed(4)),
    needs_manual_review: needsManualReview,
    suggested_status: suggestedStatus,
  };
};

/**
 * Memparse string respons LLM menjadi objek { title, description } yang tervalidasi
 */
const parseNarrativeJson = (rawContent) => {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Respons teks LLM kosong.');
  }
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Respons LLM tidak mengandung format objek JSON.');
  }
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.title || !parsed.description) {
    throw new Error('JSON dari LLM tidak memiliki key "title" atau "description".');
  }
  return {
    title: String(parsed.title).trim(),
    description: String(parsed.description).trim(),
  };
};

/**
 * 1. Memanggil Primary LLM: Qwen pada IP Tailscale (mendukung endpoint OpenAI /v1/chat/completions maupun Ollama /api/chat & /api/generate)
 */
const callQwenTailscaleLlm = async (prompt) => {
  // Cek cepat konektivitas host Tailscale (maks ~1.5 detik) agar tidak menunggu lama jika PC offline
  const qwenOrigin = new URL(QWEN_API_URL).origin;
  await fetch(qwenOrigin, {
    method: 'GET',
    signal: AbortSignal.timeout(QWEN_CONNECT_TIMEOUT_MS),
  });

  const headers = { 'Content-Type': 'application/json' };
  if (QWEN_API_KEY) {
    headers.Authorization = `Bearer ${QWEN_API_KEY}`;
  }

  const isOllamaGenerate = QWEN_API_URL.endsWith('/api/generate');
  const payload = isOllamaGenerate
    ? {
        model: QWEN_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.3 },
      }
    : {
        model: QWEN_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.3,
      };

  const response = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(QWEN_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const llmData = await response.json();
  const rawContent =
    llmData?.choices?.[0]?.message?.content ||
    llmData?.message?.content ||
    llmData?.response ||
    '';

  const parsed = parseNarrativeJson(rawContent);
  return {
    ...parsed,
    generator: `llm:qwen (${QWEN_MODEL})`,
  };
};

/**
 * 2. Memanggil Secondary LLM Fallback: Google Gemini API (dengan retry ke model lite jika 503/429)
 */
const callSingleGeminiModel = async (modelName, prompt) => {
  const baseUrl =
    GEMINI_API_URL ||
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const separator = baseUrl.includes('?') ? '&' : '?';
  const urlWithKey = `${baseUrl}${separator}key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(urlWithKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const geminiData = await response.json();
  const rawContent =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
    geminiData?.choices?.[0]?.message?.content ||
    '';

  const parsed = parseNarrativeJson(rawContent);
  return {
    ...parsed,
    generator: `llm:gemini (${modelName})`,
  };
};

const callGeminiFallbackLlm = async (prompt) => {
  const modelsToTry = [GEMINI_MODEL, GEMINI_BACKUP_MODEL].filter(
    (m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx
  );

  let lastError = null;
  for (const modelName of modelsToTry) {
    try {
      return await callSingleGeminiModel(modelName, prompt);
    } catch (err) {
      lastError = err;
      console.warn(`[AI Service] Gemini model "${modelName}" gagal: ${err.message}`);
    }
  }
  throw lastError || new Error('Semua model Gemini fallback gagal.');
};

/**
 * Menyusun draf judul dan deskripsi laporan secara otomatis dengan skema Multi-Tier Fallback:
 * [1] Primary LLM: Qwen pada IP Tailscale -> [2] Fallback LLM: Gemini API -> [3] Template Orchestrator Lokal
 */
export const generateReportNarrative = async ({
  visionResult,
  metrics,
  userDescription = '',
  latitude,
  longitude,
  address = '',
}) => {
  const classesDetected = visionResult?.summary?.classes_detected || {};
  const detectedItemsList = Object.entries(classesDetected).map(([cls, info]) => {
    const label = YOLO_CLASS_LABELS_ID[cls] || cls;
    return `${info.count} titik ${label} (akurasi maks ${(info.max_confidence * 100).toFixed(1)}%)`;
  });

  const severityLabelMap = {
    low: 'Ringan',
    medium: 'Sedang',
    high: 'Parah / Prioritas Tinggi',
  };
  const severityLabel = severityLabelMap[metrics.severity] || 'Sedang';
  const locationText = address
    ? `${address} (${latitude}, ${longitude})`
    : `koordinat GPS (${latitude}, ${longitude})`;

  const prompt = `Kamu adalah asisten AI sistem pelaporan jalan rusak UrusJakarta.
Susun draf laporan resmi dalam format JSON dengan key "title" dan "description" (Bahasa Indonesia formal dan ringkas) berdasarkan data berikut:
- Lokasi: ${locationText}
- Hasil Deteksi Visual YOLO: ${detectedItemsList.length > 0 ? detectedItemsList.join(', ') : 'Belum terdeteksi secara visual'}
- Kategori Utama: ${metrics.primary_damage_label}
- Tingkat Keparahan: ${severityLabel} (${metrics.severity})
- Catatan Warga: ${userDescription || 'Tidak ada catatan tambahan'}
Kembalikan HANYA objek JSON valid: {"title": "...", "description": "..."}`;

  // TAHAP 1: Coba Primary LLM (Qwen pada IP Tailscale) terlebih dahulu
  if (QWEN_API_URL) {
    try {
      return await callQwenTailscaleLlm(prompt);
    } catch (qwenErr) {
      console.warn(
        `[AI Service] Primary LLM Qwen (${QWEN_API_URL}) gagal/timeout (${qwenErr.message}). Beralih ke Fallback Gemini API...`
      );
    }
  }

  // TAHAP 2: Fallback ke Secondary LLM (Google Gemini API) jika Qwen tidak aktif / gagal
  if (GEMINI_API_KEY) {
    try {
      return await callGeminiFallbackLlm(prompt);
    } catch (geminiErr) {
      console.warn(
        `[AI Service] Secondary LLM Gemini API (${GEMINI_MODEL}) gagal (${geminiErr.message}). Beralih ke Template Naratif Lokal...`
      );
    }
  }

  // TAHAP 3: Fallback Terakhir -> Generator Naratif Terstruktur Otomatis (Lokal)
  const locationShort = address ? address.split(',')[0].trim() : `Titik (${ Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`;

  if (metrics.category === 'undamaged') {
    const title = `Evaluasi Kondisi Jalan Normal - ${locationShort}`;
    const descParts = [
      `Berdasarkan analisis citra visual AI (YOLO), tidak terdeteksi adanya kerusakan permukaan jalan (0 deteksi) pada lokasi ${locationText}.`,
      `Laporan ini diklasifikasikan sebagai kondisi normal (${metrics.severity}) dan diarahkan ke antrean tinjauan manual moderator.`,
    ];
    if (userDescription && userDescription.trim().length > 0) {
      descParts.push(`Keterangan pelapor: "${userDescription.trim()}".`);
    }
    return {
      title,
      description: descParts.join(' '),
      generator: 'template_orchestrator',
    };
  }

  const title = `Laporan ${metrics.primary_damage_label} - ${locationShort}`;

  let descriptionParts = [];
  if (detectedItemsList.length > 0) {
    descriptionParts.push(
      `Berdasarkan analisis citra visual AI, terdeteksi ${detectedItemsList.join(' serta ')} pada lokasi ${locationText}.`
    );
  } else {
    descriptionParts.push(
      `Dilaporkan adanya ${metrics.primary_damage_label.toLowerCase()} pada lokasi ${locationText}.`
    );
  }

  descriptionParts.push(
    `Tingkat keparahan kerusakan diklasifikasikan sebagai ${severityLabel.toLowerCase()} (${metrics.severity}).`
  );

  if (userDescription && userDescription.trim().length > 0) {
    descriptionParts.push(`Keterangan pelapor: "${userDescription.trim()}".`);
  }

  return {
    title,
    description: descriptionParts.join(' '),
    generator: 'template_orchestrator',
  };
};

/**
 * Mengecek status ketersediaan service FastAPI Road-AI
 */
export const checkRoadAiHealth = async () => {
  try {
    const response = await fetch(`${ROAD_AI_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      return {
        available: data.status === 'ok',
        model_loaded: Boolean(data.model_loaded),
        mode: 'fastapi_service',
        url: ROAD_AI_URL,
      };
    }
  } catch {
    // Cek ketersediaan model lokal
  }

  const hasLocalYolo =
    fs.existsSync(LOCAL_VENV_PYTHON) && fs.existsSync(LOCAL_YOLO_MODEL);
  return {
    available: hasLocalYolo,
    model_loaded: hasLocalYolo,
    mode: hasLocalYolo ? 'local_python_yolo' : 'offline',
    url: ROAD_AI_URL,
  };
};

/**
 * Pipeline utama: Menganalisis gambar & input teks pengguna untuk menghasilkan draf & metadata ai_analysis
 */
export const analyzeReportSubmission = async ({
  fileBuffer,
  originalname,
  mimetype,
  userDescription = '',
  latitude,
  longitude,
  address = '',
}) => {
  let visionResult = {
    available: false,
    detections: [],
    summary: { total_detections: 0, classes_detected: {} },
  };

  if (fileBuffer) {
    visionResult = await detectRoadDamageWithYOLO(fileBuffer, originalname, mimetype);
  }

  const metrics = evaluateDamageMetrics(visionResult, userDescription);

  const narrative = await generateReportNarrative({
    visionResult,
    metrics,
    userDescription,
    latitude,
    longitude,
    address,
  });

  return {
    title: narrative.title,
    description: narrative.description,
    category: metrics.category,
    severity: metrics.severity,
    suggested_status: metrics.suggested_status,
    needs_manual_review: metrics.needs_manual_review,
    ai_analysis: {
      analyzed_at: new Date().toISOString(),
      vision_service_available: visionResult.available,
      total_detections: visionResult.summary?.total_detections || 0,
      classes_detected: visionResult.summary?.classes_detected || {},
      detections: visionResult.detections || [],
      image_dimensions: visionResult.dimensions || null,
      max_confidence: metrics.max_confidence,
      primary_damage_label: metrics.primary_damage_label,
      needs_manual_review: metrics.needs_manual_review,
      narrative_generator: narrative.generator,
      original_user_description: userDescription || null,
    },
  };
};

