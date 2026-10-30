import dotenv from 'dotenv';

dotenv.config();

const ROAD_AI_URL = process.env.ROAD_AI_URL || 'http://localhost:8000';
const LLM_API_URL = process.env.LLM_API_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:7b';

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
    console.warn(`[AI Service] Gagal menghubungi Road-AI di ${ROAD_AI_URL}/predict:`, error.message);
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
 * Menyusun draf judul dan deskripsi laporan secara otomatis menggunakan LLM (jika terkonfigurasi)
 * atau menggunakan generator naratif terstruktur Bahasa Indonesia sebagai fallback.
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

  // Jika endpoint LLM eksternal (OpenAI-compatible / Ollama / Qwen) dikonfigurasi di .env
  if (LLM_API_URL) {
    try {
      const prompt = `Kamu adalah asisten AI sistem pelaporan jalan rusak UrusJakarta.
Susun draf laporan resmi dalam format JSON dengan key "title" dan "description" (Bahasa Indonesia formal dan ringkas) berdasarkan data berikut:
- Lokasi: ${locationText}
- Hasil Deteksi Visual YOLO: ${detectedItemsList.length > 0 ? detectedItemsList.join(', ') : 'Belum terdeteksi secara visual'}
- Kategori Utama: ${metrics.primary_damage_label}
- Tingkat Keparahan: ${severityLabel} (${metrics.severity})
- Catatan Warga: ${userDescription || 'Tidak ada catatan tambahan'}
Kembalikan HANYA objek JSON valid: {"title": "...", "description": "..."}`;

      const headers = { 'Content-Type': 'application/json' };
      if (LLM_API_KEY) {
        headers.Authorization = `Bearer ${LLM_API_KEY}`;
      }

      const response = await fetch(LLM_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        const llmData = await response.json();
        const rawContent = llmData?.choices?.[0]?.message?.content || llmData?.response || '';
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.title && parsed.description) {
            return {
              title: parsed.title,
              description: parsed.description,
              generator: `llm:${LLM_MODEL}`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[AI Service] LLM eksternal tidak dapat dihubungi, menggunakan template naratif standar:', err.message);
    }
  }

  // Fallback: Generator Naratif Terstruktur Otomatis
  const locationShort = address ? address.split(',')[0].trim() : `Titik (${ Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)})`;
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

