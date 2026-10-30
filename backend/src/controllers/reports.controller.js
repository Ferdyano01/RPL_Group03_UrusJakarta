import * as reportsService from '../services/reports.service.js';
import { analyzeReportSubmission } from '../services/ai.service.js';
import { uploadImageToSupabase } from '../services/upload.service.js';

/**
 * POST /api/reports/analyze
 * Menganalisis foto jalan rusak + koordinat GPS menggunakan AI (YOLO + LLM) 
 * dan mengembalikan draf laporan sebelum disimpan permanen oleh warga.
 */
export const analyzeDraft = async (req, res) => {
  try {
    const { description, latitude, longitude, address, upload_image } = req.body;

    if (!req.file && !description) {
      return res.status(400).json({
        status: 'error',
        message: 'Harap lampirkan foto kerusakan jalan (field "image") atau deskripsi laporan.',
      });
    }

    const lat = latitude !== undefined && latitude !== '' ? Number(latitude) : -6.2088;
    const lng = longitude !== undefined && longitude !== '' ? Number(longitude) : 106.8456;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        status: 'error',
        message: 'Koordinat latitude dan longitude harus berupa angka yang valid.',
      });
    }

    // Jalankan analisis AI (YOLO Vision + Generator Draf Naratif LLM/Template)
    const analysisResult = await analyzeReportSubmission({
      fileBuffer: req.file?.buffer,
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      userDescription: description || '',
      latitude: lat,
      longitude: lng,
      address: address || '',
    });

    // Opsional: Unggah gambar ke Supabase Storage kecuali upload_image bernilai 'false'
    let imageUrl = req.body.image_url || null;
    let uploadWarning = null;

    if (req.file && upload_image !== 'false') {
      try {
        imageUrl = await uploadImageToSupabase(req.file);
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

    if (latitude === undefined || longitude === undefined || latitude === '' || longitude === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Koordinat lokasi (latitude dan longitude) wajib diisi.',
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        status: 'error',
        message: 'Koordinat latitude (-90 s/d 90) atau longitude (-180 s/d 180) tidak valid.',
      });
    }

    // Jika ai_analysis dikirim sebagai string JSON pada multipart/form-data, parse terlebih dahulu
    if (typeof ai_analysis === 'string' && ai_analysis.trim() !== '') {
      try {
        ai_analysis = JSON.parse(ai_analysis);
      } catch {
        ai_analysis = { raw_notes: ai_analysis };
      }
    }

    // Jika pengguna mengirim file gambar langsung ke POST /api/reports
    if (req.file) {
      if (!image_url) {
        image_url = await uploadImageToSupabase(req.file);
      }

      // Jalankan analisis AI secara otomatis apabila belum ada hasil ai_analysis dari tahap draf
      if (!ai_analysis) {
        const autoAnalysis = await analyzeReportSubmission({
          fileBuffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          userDescription: description || '',
          latitude: lat,
          longitude: lng,
          address: address || '',
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
      });

      title = title || textAnalysis.title;
      description = description || textAnalysis.description;
      category = category || textAnalysis.category;
      severity = severity || textAnalysis.severity;
      status = status || textAnalysis.suggested_status;
      ai_analysis = textAnalysis.ai_analysis;
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
      status: status || 'submitted',
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
    const { status, category, severity, search, page, limit } = req.query;
    const result = await reportsService.getAllReports({
      status,
      category,
      severity,
      search,
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
 * GET /api/reports/:id
 * Mengambil detail satu laporan berdasarkan ID
 */
export const getById = async (req, res) => {
  try {
    const report = await reportsService.getReportById(req.params.id);

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

