import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

process.env.OSM_OVERPASS_ENABLED = 'false';
process.env.OSM_NOMINATIM_ENABLED = 'false';
process.env.QWEN_API_URL = '';
process.env.GEMINI_API_KEY = '';

import app from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local-db.json');
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

describe('Auth, Upload, RBAC & Authority Routing (Local Fallback Mode)', () => {
  let server;
  let baseUrl;
  let originalDbSnapshot = null;
  let uploadedFilesBefore = new Set();

  before(async () => {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      originalDbSnapshot = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    }
    if (fs.existsSync(UPLOADS_DIR)) {
      uploadedFilesBefore = new Set(fs.readdirSync(UPLOADS_DIR));
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
    if (fs.existsSync(UPLOADS_DIR)) {
      for (const file of fs.readdirSync(UPLOADS_DIR)) {
        if (!uploadedFilesBefore.has(file)) {
          fs.unlinkSync(path.join(UPLOADS_DIR, file));
        }
      }
    }
  });

  it('validates registration, login, /me, and profile update', async () => {
    const shortPwdRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'short@jakarta.id',
        password: '123',
        full_name: 'Short Pwd',
      }),
    });
    assert.equal(shortPwdRes.status, 400);

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'WargaBaru@Jakarta.id',
        password: 'PasswordAman123!',
        full_name: 'Siti Penguji',
        phone_number: '081234567890',
      }),
    });
    const regJson = await regRes.json();
    assert.equal(regRes.status, 201);
    assert.equal(regJson.data.email, 'wargabaru@jakarta.id');
    assert.equal(regJson.data.password_hash, undefined);

    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wargabaru@jakarta.id',
        password: 'PasswordAman123!',
        full_name: 'Duplikat',
      }),
    });
    assert.equal(dupRes.status, 400);

    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wargabaru@jakarta.id', password: 'WrongPassword!' }),
    });
    assert.equal(badLoginRes.status, 401);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wargabaru@jakarta.id', password: 'PasswordAman123!' }),
    });
    const loginJson = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.ok(loginJson.data.token);
    const token = loginJson.data.token;

    const noAuthMe = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(noAuthMe.status, 401);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meJson = await meRes.json();
    assert.equal(meRes.status, 200);
    assert.equal(meJson.data.email, 'wargabaru@jakarta.id');
    assert.equal(meJson.data.password_hash, undefined);

    const updateProfRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ full_name: 'Siti Updated', phone_number: '081299990000' }),
    });
    const updateProfJson = await updateProfRes.json();
    assert.equal(updateProfRes.status, 200);
    assert.equal(updateProfJson.data.full_name, 'Siti Updated');
  });

  it('rejects non-image uploads and supports local fallback image upload', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'warga@jakarta.id', password: 'Password123!' }),
    });
    const { data: { token } } = await loginRes.json();

    const emptyRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(emptyRes.status, 400);

    const badForm = new FormData();
    badForm.append('image', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    const badRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: badForm,
    });
    assert.equal(badRes.status, 400);

    const imgBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const okForm = new FormData();
    okForm.append('image', new Blob([imgBytes], { type: 'image/jpeg' }), 'test.jpg');
    const okRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: okForm,
    });
    const okJson = await okRes.json();
    assert.equal(okRes.status, 200);
    assert.ok(okJson.data.url.includes('/uploads/'));
  });

  it('enforces RBAC on status changes, ownership, authority routing, and deletion', async () => {
    const citizenLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'warga@jakarta.id', password: 'Password123!' }),
    });
    const citizenToken = (await citizenLogin.json()).data.token;

    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jakarta.id', password: 'Password123!' }),
    });
    const adminToken = (await adminLogin.json()).data.token;

    // Citizen trying to create with status="fixed" is sanitized to "submitted"
    const createRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        title: 'Laporan Uji RBAC',
        description: 'Retak jalan dekat sekolah',
        latitude: -6.2,
        longitude: 106.82,
        address: 'Jl. Kebon Sirih No. 5, Jakarta Pusat',
        status: 'fixed',
      }),
    });
    const created = (await createRes.json()).data;
    assert.equal(createRes.status, 201);
    assert.equal(created.status, 'submitted');

    // Citizen can edit their own title/description
    const editRes = await fetch(`${baseUrl}/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ title: 'Laporan Uji RBAC (Revisi)' }),
    });
    assert.equal(editRes.status, 200);

    // Citizen CANNOT change report status -> 403
    const citizenStatusRes = await fetch(`${baseUrl}/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ status: 'fixed' }),
    });
    assert.equal(citizenStatusRes.status, 403);

    // Citizen CANNOT route report -> 403
    const citizenRouteRes = await fetch(`${baseUrl}/api/reports/${created.id}/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(citizenRouteRes.status, 403);

    // GET /api/reports/authorities returns seeded authority
    const authListRes = await fetch(`${baseUrl}/api/reports/authorities`);
    const authListJson = await authListRes.json();
    assert.equal(authListRes.status, 200);
    assert.ok(authListJson.data.length >= 1);

    // Admin CAN route report to authority -> status becomes "routed" + report_routings populated
    const adminRouteRes = await fetch(`${baseUrl}/api/reports/${created.id}/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ notes: 'Diteruskan ke Satgas Jakarta Pusat' }),
    });
    const routedJson = await adminRouteRes.json();
    assert.equal(adminRouteRes.status, 200);
    assert.equal(routedJson.data.status, 'routed');
    assert.ok(routedJson.data.report_routings.length >= 1);

    // Admin CAN update status to fixed
    const adminStatusRes = await fetch(`${baseUrl}/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'fixed', status_notes: 'Selesai ditambal' }),
    });
    assert.equal(adminStatusRes.status, 200);

    // Path traversal test on sample_image
    const traversalForm = new FormData();
    traversalForm.append('sample_image', '../../backend/.env');
    traversalForm.append('latitude', '-6.2');
    traversalForm.append('longitude', '106.82');
    const traversalRes = await fetch(`${baseUrl}/api/reports/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: traversalForm,
    });
    assert.equal(traversalRes.status, 400);

    // Delete report and verify 404
    const delRes = await fetch(`${baseUrl}/api/reports/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(delRes.status, 200);

    const getDeletedRes = await fetch(`${baseUrl}/api/reports/${created.id}`);
    assert.equal(getDeletedRes.status, 404);
  });

  it('protects against PII leakage, spoofed image magic bytes, forged priority/image_url, and exposes security headers', async () => {
    const citizenLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'warga@jakarta.id', password: 'Password123!' }),
    });
    const citizenToken = (await citizenLogin.json()).data.token;

    // 1. Security headers & no X-Powered-By
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(healthRes.headers.get('x-powered-by'), null);

    // 2. Public GET /api/reports & GET /api/reports/:id omit reporter email & phone_number
    const publicListRes = await fetch(`${baseUrl}/api/reports?limit=5`);
    const publicListJson = await publicListRes.json();
    assert.equal(publicListRes.status, 200);
    const firstReport = publicListJson.data[0];
    assert.equal(firstReport.reporter?.email, undefined);
    assert.equal(firstReport.reporter?.phone_number, undefined);

    const publicDetailRes = await fetch(`${baseUrl}/api/reports/${firstReport.id}`);
    const publicDetailJson = await publicDetailRes.json();
    assert.equal(publicDetailRes.status, 200);
    assert.equal(publicDetailJson.data.reporter?.email, undefined);
    assert.equal(publicDetailJson.data.reporter?.phone_number, undefined);

    // Owner CAN see their own email/phone on detail endpoint
    const ownerDetailRes = await fetch(`${baseUrl}/api/reports/${firstReport.id}`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const ownerDetailJson = await ownerDetailRes.json();
    assert.equal(ownerDetailRes.status, 200);
    assert.equal(ownerDetailJson.data.reporter?.email, 'warga@jakarta.id');

    // 3. Spoofed MIME type (claims image/jpeg, actually plain text) is rejected by magic-byte check
    const spoofedForm = new FormData();
    spoofedForm.append('image', new Blob(['not-a-real-jpeg-binary'], { type: 'image/jpeg' }), 'fake.jpg');
    const spoofedUploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: spoofedForm,
    });
    assert.equal(spoofedUploadRes.status, 400);

    // 4. External untrusted image_url is rejected
    const badImgUrlRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        title: 'Test Bad URL',
        latitude: -6.2,
        longitude: 106.82,
        image_url: 'https://untrusted.example.com/payload.png',
      }),
    });
    assert.equal(badImgUrlRes.status, 400);

    // 5. Forged priority_score / support_count in JSON body are recomputed server-side
    const forgedRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        title: 'Test Recompute Priority',
        description: 'Retak kecil di gang',
        category: 'crack',
        severity: 'low',
        latitude: -6.34,
        longitude: 106.82,
        address: 'Gg. Melati No. 4, Jagakarsa',
        ai_analysis: {
          priority_score: 100,
          support_count: 99,
        },
      }),
    });
    const forgedJson = await forgedRes.json();
    assert.equal(forgedRes.status, 201);
    assert.equal(forgedJson.data.ai_analysis.support_count, 1);
    assert.ok(forgedJson.data.ai_analysis.priority_score < 100);

    // 6. Search query with PostgREST delimiter characters works cleanly
    const searchRes = await fetch(`${baseUrl}/api/reports?search=${encodeURIComponent('Panjaitan,id.eq.1()')}`);
    assert.equal(searchRes.status, 200);
  });
});
