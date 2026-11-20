import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.OSM_OVERPASS_ENABLED = 'false';
process.env.OSM_NOMINATIM_ENABLED = 'false';
process.env.QWEN_API_URL = '';
process.env.GEMINI_API_KEY = '';

import {
  calculateDistanceMeters,
  findNearbyReportsAndDuplicates,
  evaluateStrategicLocation,
  evaluateLocationAndDuplicates,
  formatNominatimAddress,
  reverseGeocodeCoordinates,
} from '../src/services/locationIntelligence.service.js';
import {
  computePriorityAndEffectiveSeverity,
  evaluateDamageMetrics,
} from '../src/services/ai.service.js';
import app from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local-db.json');

describe('Location Intelligence & Duplicate Detection', () => {
  it('calculates Haversine distance accurately in meters', () => {
    assert.equal(calculateDistanceMeters(-6.1754, 106.8272, -6.1754, 106.8272), 0);

    // ~15 meters offset
    const shortDist = calculateDistanceMeters(-6.1628, 106.8195, -6.16292, 106.81955);
    assert.ok(shortDist > 10 && shortDist < 25, `Expected ~14m, got ${shortDist}`);

    // ~200+ meters offset
    const farDist = calculateDistanceMeters(-6.1628, 106.8195, -6.1648, 106.8195);
    assert.ok(farDist > 180 && farDist < 260, `Expected ~222m, got ${farDist}`);
  });

  it('detects active duplicates within 35m and ignores fixed/closed/out-of-range reports', () => {
    const nowIso = new Date().toISOString();
    const oldIso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

    const existingReports = [
      {
        id: 'rep-near-active',
        title: 'Lubang Dekat Halte',
        category: 'pothole',
        severity: 'medium',
        status: 'submitted',
        latitude: -6.16285,
        longitude: 106.81952,
        created_at: nowIso,
        ai_analysis: { support_count: 2 },
      },
      {
        id: 'rep-near-fixed',
        title: 'Lubang Sudah Diperbaiki',
        category: 'pothole',
        severity: 'medium',
        status: 'fixed',
        latitude: -6.16281,
        longitude: 106.81951,
        created_at: nowIso,
      },
      {
        id: 'rep-near-old',
        title: 'Lubang Lama 45 Hari',
        category: 'pothole',
        severity: 'low',
        status: 'submitted',
        latitude: -6.16282,
        longitude: 106.8195,
        created_at: oldIso,
      },
      {
        id: 'rep-far',
        title: 'Lubang 100m Jauhnya',
        category: 'pothole',
        severity: 'medium',
        status: 'submitted',
        latitude: -6.1637,
        longitude: 106.8195,
        created_at: nowIso,
      },
    ];

    const res = findNearbyReportsAndDuplicates({
      latitude: -6.1628,
      longitude: 106.8195,
      category: 'pothole',
      existingReports,
    });

    assert.equal(res.nearby_report_count, 4);
    assert.equal(res.possible_duplicates.length, 1);
    assert.equal(res.possible_duplicates[0].id, 'rep-near-active');
    assert.equal(res.possible_duplicates[0].support_count, 2);
  });

  it('scores strategic arterial locations with vital facilities higher than local residential roads', () => {
    const strategicLoc = evaluateStrategicLocation({
      latitude: -6.1628,
      longitude: 106.8195,
      address: 'Jl. Gajah Mada No. 12, Gambir, Jakarta Pusat',
      userDescription: 'Lubang tepat di depan halte TransJakarta dan dekat RSUD',
      nearbyReportCount: 3,
      duplicateCount: 1,
    });

    assert.equal(strategicLoc.road_class, 'arterial');
    assert.equal(strategicLoc.detected_region, 'Jakarta Pusat');
    assert.ok(strategicLoc.strategic_score >= 70, `Expected >=70, got ${strategicLoc.strategic_score}`);
    assert.equal(strategicLoc.strategic_tier, 'high');

    const localLoc = evaluateStrategicLocation({
      latitude: -6.34,
      longitude: 106.82,
      address: 'Gg. Melati No. 4, Jagakarsa',
      userDescription: 'Retak kecil di ujung gang',
      nearbyReportCount: 0,
      duplicateCount: 0,
    });

    assert.equal(localLoc.road_class, 'local');
    assert.ok(localLoc.strategic_score < 40, `Expected <40, got ${localLoc.strategic_score}`);
    assert.equal(localLoc.strategic_tier, 'low');
  });

  it('escalates medium visual severity to high on high strategic score and preserves undamaged low priority', () => {
    const escalated = computePriorityAndEffectiveSeverity({
      category: 'pothole',
      visualSeverity: 'medium',
      locationContext: { strategic_score: 75, duplicate_count: 1 },
      supportCount: 1,
    });

    assert.equal(escalated.visual_severity, 'medium');
    assert.equal(escalated.effective_severity, 'high');
    assert.equal(escalated.severity_adjusted, true);
    assert.equal(escalated.priority_score, 63);

    const undamaged = evaluateDamageMetrics(
      { available: true, detections: [], summary: { total_detections: 0, classes_detected: {} } },
      'Kondisi jalan mulus dan rapi',
      { strategic_score: 80, duplicate_count: 0 }
    );

    assert.equal(undamaged.category, 'undamaged');
    assert.equal(undamaged.severity, 'low');
    assert.equal(undamaged.severity_adjusted, false);
    assert.ok(undamaged.priority_score <= 25);
  });

  it('evaluates location and duplicates together asynchronously without OSM network', async () => {
    const res = await evaluateLocationAndDuplicates({
      latitude: -6.2255,
      longitude: 106.871,
      address: 'Jl. D.I. Panjaitan No. 18, Jatinegara, Jakarta Timur',
      userDescription: 'Lubang besar depan halte busway dan sekolah',
      category: 'pothole',
      existingReports: [],
    });

    assert.equal(res.location_context.road_class, 'arterial');
    assert.equal(res.location_context.data_source, 'local_heuristic');
    assert.ok(res.location_context.nearby_vital_facilities.length >= 2);
    assert.deepEqual(res.possible_duplicates, []);
  });

  it('formats Nominatim reverse geocoding payload and handles disabled fallback cleanly', async () => {
    const formatted = formatNominatimAddress({
      address: {
        road: 'Jalan M.H. Thamrin',
        house_number: '1',
        suburb: 'Menteng',
        city_district: 'Menteng',
        city: 'Jakarta Pusat',
      },
    });
    assert.equal(formatted, 'Jalan M.H. Thamrin No. 1, Menteng, Jakarta Pusat');

    const fallbackDisplay = formatNominatimAddress({
      display_name: 'Jalan Jenderal Sudirman, Senayan, Kebayoran Baru, Jakarta Selatan, DKI Jakarta',
    });
    assert.equal(
      fallbackDisplay,
      'Jalan Jenderal Sudirman, Senayan, Kebayoran Baru, Jakarta Selatan'
    );

    assert.equal(formatNominatimAddress(null), null);

    const disabledRes = await reverseGeocodeCoordinates(-6.1931, 106.823);
    assert.equal(disabledRes.available, false);
    assert.equal(disabledRes.address, null);
    assert.equal(disabledRes.source, 'disabled');
  });
});

describe('Reports API Integration (Local Fallback Mode)', () => {
  let server;
  let baseUrl;
  let originalDbSnapshot = null;

  before(async () => {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      originalDbSnapshot = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    }
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    if (originalDbSnapshot !== null) {
      fs.writeFileSync(LOCAL_DB_PATH, originalDbSnapshot, 'utf-8');
    }
  });

  it('supports priority sorting, duplicate detection on analyze, and duplicate confirmation (+1 support)', async () => {
    // 1. Login as citizen & admin
    const loginCitizenRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'warga@jakarta.id', password: 'Password123!' }),
    });
    const citizenLogin = await loginCitizenRes.json();
    assert.equal(loginCitizenRes.status, 200);
    const citizenToken = citizenLogin.data.token;

    const loginAdminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jakarta.id', password: 'Password123!' }),
    });
    const adminLogin = await loginAdminRes.json();
    assert.equal(loginAdminRes.status, 200);
    const adminToken = adminLogin.data.token;

    // 2. Create a fresh active report on an arterial road with low/medium description
    const createRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        title: 'Uji Lubang Jalan Protokol',
        description: 'Ada lubang sedang dekat halte TransJakarta dan RSUD',
        latitude: -6.1912,
        longitude: 106.8235,
        address: 'Jl. M.H. Thamrin No. 10, Menteng, Jakarta Pusat',
      }),
    });
    const created = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.ok(created.data.ai_analysis.strategic_score >= 70);
    assert.ok(created.data.ai_analysis.priority_score > 0);
    assert.equal(created.data.severity, 'high');

    // 3. Analyze another submission 10 meters away -> should detect the new report as possible duplicate
    const form = new FormData();
    form.append('latitude', '-6.19128');
    form.append('longitude', '106.82352');
    form.append('address', 'Jl. M.H. Thamrin No. 12, Jakarta Pusat');
    form.append('description', 'Lubang aspal di jalur lambat dekat halte');

    const analyzeRes = await fetch(`${baseUrl}/api/reports/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    const analyzed = await analyzeRes.json();
    assert.equal(analyzeRes.status, 200);
    assert.ok(analyzed.data.draft.possible_duplicates.length >= 1);
    assert.equal(analyzed.data.draft.possible_duplicates[0].id, created.data.id);

    // 4. Confirm duplicate as admin -> increments support_count and priority_score
    const confirmRes = await fetch(
      `${baseUrl}/api/reports/${created.data.id}/confirm-duplicate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ notes: 'Konfirmasi lubang sama dari pengguna lain' }),
      }
    );
    const confirmed = await confirmRes.json();
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmed.data.ai_analysis.support_count, 2);
    assert.ok(
      confirmed.data.ai_analysis.priority_score >= created.data.ai_analysis.priority_score
    );

    // 5. GET /api/reports?sort=priority returns sorted descending by priority_score
    const sortedRes = await fetch(`${baseUrl}/api/reports?sort=priority&limit=10`);
    const sortedJson = await sortedRes.json();
    assert.equal(sortedRes.status, 200);
    const scores = sortedJson.data.map((r) => Number(r.ai_analysis?.priority_score ?? 0));
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i - 1] >= scores[i], `Expected descending priority sort: ${scores}`);
    }

    // 6. GET /api/reports/reverse-geocode validates coords and returns graceful response
    const badGeoRes = await fetch(`${baseUrl}/api/reports/reverse-geocode?lat=abc&lng=106.8`);
    assert.equal(badGeoRes.status, 400);

    const okGeoRes = await fetch(`${baseUrl}/api/reports/reverse-geocode?lat=-6.1931&lng=106.823`);
    const okGeoJson = await okGeoRes.json();
    assert.equal(okGeoRes.status, 200);
    assert.equal(okGeoJson.status, 'success');
    assert.equal(okGeoJson.data.available, false);
  });
});
