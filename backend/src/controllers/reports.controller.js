import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as reportsService from '../services/reports.service.js';
import {
  analyzeReportSubmission,
  computePriorityAndEffectiveSeverity,
} from '../services/ai.service.js';
import {
  evaluateLocationAndDuplicates,
  reverseGeocodeCoordinates,
} from '../services/locationIntelligence.service.js';
import { uploadImageToSupabase } from '../services/upload.service.js';
import {
  VALID_REPORT_CATEGORIES,
  VALID_REPORT_SEVERITIES,
  VALID_REPORT_STATUSES,
  sanitizeReportImageUrl,
  validateCoordinates,
} from '../validators/report.validator.js';
import { assertValidImageBuffer } from '../validators/upload.validator.js';

const CITIZEN_ALLOWED_INITIAL_STATUSES = new Set(['draft', 'submitted', 'pending_review']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../../road-ai/samples/input');

const resolveInputFile = (req) => {
  if (req.file) {
    return req.file;
  }
  const sampleName = req.body?.sample_image;
  if (sampleName && typeof sampleName === 'string') {
    const safeName = path.basename(sampleName);
    const fullPath = path.join(SAMPLES_DIR, safeName);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(safeName).toLowerCase();
      const mimetype =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return {
        buffer: fs.readFileSync(fullPath),
        originalname: safeName,
        mimetype,
        isSample: true,
        sampleUrl: `/samples/${safeName}`,
      };
    }
  }
  return null;
};

/**
 * POST /api/reports/analyze
 * Menganalisis foto jalan rusak + koordinat GPS menggunakan AI (YOLO + LLM) 
 * dan mengembalikan draf laporan sebelum disimpan permanen oleh warga.
 */
export const analyzeDraft = async (req, res) => {
  try {
    const { description, latitude, longitude, address, upload_image } = req.body;
    const inputFile = resolveInputFile(req);

    if (!inputFile && !description) {
      return res.status(400).json({
        status: 'error',
        message: 'Harap lampirkan foto kerusakan jalan (field "image" atau "sample_image") atau deskripsi laporan.',
      });
    }

    if (req.file) {
      try {
        assertValidImageBuffer(req.file);
      } catch (imgErr) {
        return res.status(400).json({
          status: 'error',
          message: imgErr.message,
        });
      }
    }

    let coords;
    try {
      coords = validateCoordinates(latitude, longitude, { required: false });
    } catch (coordErr) {
      return res.status(400).json({
        status: 'error',
        message: coordErr.message,
      });
    }
    const { latitude: lat, longitude: lng } = coords;

    const existingReports = await reportsService.getReportsForSpatialAnalysis();

    // Jalankan analisis AI (YOLO Vision + Lokasi Strategis + Deteksi Duplikat + LLM/Template)
    const analysisResult = await analyzeReportSubmission({
      fileBuffer: inputFile?.buffer,
      originalname: inputFile?.originalname,
      mimetype: inputFile?.mimetype,
      userDescription: description || '',
      latitude: lat,
      longitude: lng,
      address: address || '',
      existingReports,
    });

    // Opsional: Unggah gambar ke Supabase Storage kecuali upload_image bernilai 'false'
    let imageUrl = req.body.image_url || inputFile?.sampleUrl || null;
    let uploadWarning = null;

    if (inputFile && !inputFile.isSample && upload_image !== 'false') {
      try {
        imageUrl = await uploadImageToSupabase(inputFile);
      } catch (uploadErr) {
        uploadWarning = uploadErr.message;
        console.warn('[Reports Controller] Peringatan unggah gambar saat analisis draf:', uploadErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Analisis AI berhasil menghasilkan draf laporan.',
      data: {
        draft: {
          title: analysisResult.title,
          description: analysisResult.description,
          category: analysisResult.category,
          severity: analysisResult.severity,
          visual_severity: analysisResult.visual_severity,
          severity_adjusted: analysisResult.severity_adjusted,
          severity_adjustment_reason: analysisResult.severity_adjustment_reason,
          strategic_score: analysisResult.strategic_score,
          priority_score: analysisResult.priority_score,
          location_context: analysisResult.location_context,
          possible_duplicates: analysisResult.possible_duplicates,
          latitude: lat,
          longitude: lng,
          address: address || null,
          image_url: imageUrl,
          suggested_status: analysisResult.suggested_status,
          needs_manual_review: analysisResult.needs_manual_review,
        },
        ai_analysis: analysisResult.ai_analysis,
        ...(uploadWarning ? { upload_warning: uploadWarning } : {}),
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * POST /api/reports
 * Membuat laporan kerusakan jalan baru (mendukung kiriman dari draf maupun kiriman langsung beserta file gambar).
 */
export const create = async (req, res) => {
  try {
    let {
      title,
      description,
      category,
      severity,
      latitude,
      longitude,
      address,
      image_url,
      ai_analysis,
      status,
    } = req.body;

    const { latitude: lat, longitude: lng } = validateCoordinates(latitude, longitude, {
      required: true,
    });

    // Jika ai_analysis dikirim sebagai string JSON pada multipart/form-data, parse terlebih dahulu
    if (typeof ai_analysis === 'string' && ai_analysis.trim() !== '') {
      try {
        ai_analysis = JSON.parse(ai_analysis);
      } catch {
        ai_analysis = { raw_notes: ai_analysis };
      }
    }

    const inputFile = resolveInputFile(req);
    if (req.file) {
      assertValidImageBuffer(req.file);
    }

    if (category !== undefined && category !== '') {
      const normalizedCat = String(category).trim().toLowerCase();
      if (!VALID_REPORT_CATEGORIES.includes(normalizedCat)) {
        return res.status(400).json({
          status: 'error',
          message: `Kategori kerusakan tidak valid: ${category}.`,
        });
      }
      category = normalizedCat;
    }

    if (severity !== undefined && severity !== '') {
      const normalizedSev = String(severity).trim().toLowerCase();
      if (!VALID_REPORT_SEVERITIES.includes(normalizedSev)) {
        return res.status(400).json({
          status: 'error',
          message: `Tingkat keparahan tidak valid: ${severity}.`,
        });
      }
      severity = normalizedSev;
    }

    if (image_url !== undefined) {
      image_url = sanitizeReportImageUrl(image_url);
    }

    const existingReports = await reportsService.getReportsForSpatialAnalysis();

    // Jika pengguna mengirim file gambar langsung ke POST /api/reports
    if (inputFile) {
      if (!image_url) {
        if (inputFile.isSample) {
          image_url = inputFile.sampleUrl;
        } else {
          image_url = await uploadImageToSupabase(inputFile);
        }
      }

      // Jalankan analisis AI secara otomatis apabila belum ada hasil ai_analysis dari tahap draf
      if (!ai_analysis) {
        const autoAnalysis = await analyzeReportSubmission({
          fileBuffer: inputFile.buffer,
          originalname: inputFile.originalname,
          mimetype: inputFile.mimetype,
          userDescription: description || '',
          latitude: lat,
          longitude: lng,
          address: address || '',
          existingReports,
        });

        title = title || autoAnalysis.title;
        description = description || autoAnalysis.description;
        category = category || autoAnalysis.category;
        severity = severity || autoAnalysis.severity;
        status = status || autoAnalysis.suggested_status;
        ai_analysis = autoAnalysis.ai_analysis;
      }
    } else if (!ai_analysis) {
      // Jika tanpa file gambar dan belum ada ai_analysis, tetap susun metadata dasar dari deskripsi teks
      const textAnalysis = await analyzeReportSubmission({
        fileBuffer: null,
        userDescription: description || '',
        latitude: lat,
        longitude: lng,
        address: address || '',
        existingReports,
      });

      title = title || textAnalysis.title;
      description = description || textAnalysis.description;
      category = category || textAnalysis.category;
      severity = severity || textAnalysis.severity;
      status = status || textAnalysis.suggested_status;
      ai_analysis = textAnalysis.ai_analysis;
    }

    // Selalu hitung ulang skor strategis & skor prioritas di server agar klien tidak bisa memalsukan priority_score/support_count
    if (ai_analysis && typeof ai_analysis === 'object') {
      const locEval = await evaluateLocationAndDuplicates({
        latitude: lat,
        longitude: lng,
        address: address || '',
        userDescription: description || '',
        category: category || 'pothole',
        existingReports,
      });
      const visualSeverity = ['low', 'medium', 'high'].includes(ai_analysis.visual_severity)
        ? ai_analysis.visual_severity
        : severity || 'medium';
      const priorityInfo = computePriorityAndEffectiveSeverity({
        category: category || 'pothole',
        visualSeverity,
        locationContext: locEval.location_context,
        supportCount: 1,
      });
      severity = severity || priorityInfo.effective_severity;
      ai_analysis = {
        ...ai_analysis,
        ...priorityInfo,
        location_context: locEval.location_context,
        possible_duplicates: locEval.possible_duplicates,
        support_count: 1,
      };
    }

    if (req.body.duplicate_of && ai_analysis && typeof ai_analysis === 'object') {
      ai_analysis = {
        ...ai_analysis,
        duplicate_of: req.body.duplicate_of,
      };
    }

    const isStaff = req.user?.role === 'admin' || req.user?.role === 'officer';
    let finalStatus = (status || 'submitted').toLowerCase();
    if (!VALID_REPORT_STATUSES.includes(finalStatus)) {
      finalStatus = 'submitted';
    }
    if (!isStaff && !CITIZEN_ALLOWED_INITIAL_STATUSES.has(finalStatus)) {
      finalStatus = 'submitted';
    }

    const newReport = await reportsService.createReport({
      user_id: req.user.id,
      title,
      description,
      category,
      severity,
      latitude: lat,
      longitude: lng,
      address,
      image_url,
      ai_analysis,
      status: finalStatus,
    });

    return res.status(201).json({
      status: 'success',
      message: 'Laporan kerusakan jalan berhasil dibuat!',
      data: newReport,
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * GET /api/reports
 * Mengambil daftar seluruh laporan dengan opsi filter dan paginasi
 */
export const getAll = async (req, res) => {
  try {
    const { status, category, severity, search, sort, page, limit } = req.query;
    const result = await reportsService.getAllReports({
      status,
      category,
      severity,
      search,
      sort,
      page,
      limit,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Daftar laporan berhasil diambil.',
      data: result.reports,
      pagination: result.pagination,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * GET /api/reports/my-reports
 * Mengambil daftar riwayat laporan milik pengguna yang sedang login
 */
export const getMyReports = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const result = await reportsService.getReportsByUser(req.user.id, {
      status,
      page,
      limit,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Riwayat laporan pengguna berhasil diambil.',
      data: result.reports,
      pagination: result.pagination,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * GET /api/reports/reverse-geocode?lat=...&lng=...
 * Mengonversi koordinat GPS menjadi nama jalan dan wilayah secara otomatis
 */
export const reverseGeocode = async (req, res) => {
  try {
    const rawLat = req.query.lat ?? req.query.latitude;
    const rawLng = req.query.lng ?? req.query.longitude;

    if (rawLat === undefined || rawLng === undefined || rawLat === '' || rawLng === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter koordinat lat dan lng wajib diisi.',
      });
    }

    const result = await reverseGeocodeCoordinates(rawLat, rawLng);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * GET /api/reports/:id
 * Mengambil detail satu laporan berdasarkan ID
 */
export const getById = async (req, res) => {
  try {
    const report = await reportsService.getReportById(req.params.id, req.user || null);

    return res.status(200).json({
      status: 'success',
      message: 'Detail laporan berhasil diambil.',
      data: report,
    });
  } catch (err) {
    return res.status(404).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * PUT / PATCH /api/reports/:id
 * Memperbarui data laporan
 */
export const update = async (req, res) => {
  try {
    const updatedReport = await reportsService.updateReport(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body
    );

    return res.status(200).json({
      status: 'success',
      message: 'Laporan berhasil diperbarui.',
      data: updatedReport,
    });
  } catch (err) {
    const statusCode = err.message.includes('tidak memiliki akses') ? 403 : 400;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * POST /api/reports/:id/confirm-duplicate
 * Mengonfirmasi laporan aktif yang sudah ada sebagai duplikat lokasi yang sama (+1 dukungan & naikkan prioritas)
 */
export const confirmDuplicate = async (req, res) => {
  try {
    const updatedReport = await reportsService.confirmDuplicateReport(
      req.params.id,
      req.user.id,
      req.body?.notes
    );

    return res.status(200).json({
      status: 'success',
      message: 'Konfirmasi laporan serupa berhasil dicatat. Skor prioritas diperbarui.',
      data: updatedReport,
    });
  } catch (err) {
    const statusCode = err.message.includes('tidak ditemukan') ? 404 : 400;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * GET /api/reports/authorities
 * Mengambil daftar instansi/dinas tujuan penanganan laporan.
 */
export const getAuthorities = async (req, res) => {
  try {
    const authorities = await reportsService.getAuthorities();
    return res.status(200).json({
      status: 'success',
      data: authorities,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * POST /api/reports/:id/route
 * Meneruskan laporan ke instansi/dinas terkait (khusus officer/admin).
 */
export const routeReport = async (req, res) => {
  try {
    const updatedReport = await reportsService.routeReportToAuthority(
      req.params.id,
      req.user.id,
      {
        authority_id: req.body?.authority_id || null,
        notes: req.body?.notes || null,
      }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Laporan berhasil diteruskan ke instansi terkait.',
      data: updatedReport,
    });
  } catch (err) {
    const statusCode = err.message.includes('tidak ditemukan') ? 404 : 400;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * DELETE /api/reports/:id
 * Menghapus laporan
 */
export const remove = async (req, res) => {
  try {
    const result = await reportsService.deleteReport(
      req.params.id,
      req.user.id,
      req.user.role
    );

    return res.status(200).json({
      status: 'success',
      message: 'Laporan berhasil dihapus.',
      data: result,
    });
  } catch (err) {
    const statusCode = err.message.includes('tidak memiliki akses') ? 403 : 400;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
  }
};

