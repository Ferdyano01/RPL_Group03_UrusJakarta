# UrusJakarta — Open Civil Damaged Road Automatic Reporting System

*Group 03 — Software Engineering (RPL), Faculty of Engineering, Universitas Indonesia*

UrusJakarta is an AI-powered civic reporting platform (Web & Android) for documenting, analyzing, prioritizing, and routing public road damage reports to relevant government authorities (such as **Dinas Bina Marga DKI Jakarta**).

---

## System Architecture

UrusJakarta connects three services plus cloud/local fallback layers:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│               1. FRONTEND (React Native + Expo SDK 57)                  │
│             Web Static Export (Nginx) & Android Native APK              │
│  • Neobrutalist UI: Home Feed, 3-Step AI Report Wizard, History, Auth   │
│  • Interactive YOLO Bounding-Box Viewer, Web Camera, GPS Reverse Geo    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST API (JSON / FormData)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    2. BACKEND API (Node.js + Express 5)                 │
│  • JWT Authentication, Role-Based Access Control (citizen/officer/admin)│
│  • Location Intelligence (Road Class, Vital POIs, 35m Duplicate Check)  │
│  • Multi-Tier Narrative AI Orchestrator (Qwen -> Gemini -> Template)    │
│  • Dual Storage: Supabase PostgreSQL/Storage <-> Local JSON Fallback    │
└──────────────────┬───────────────────────────────────┬──────────────────┘
                   │                                   │ HTTP /predict
                   ▼                                   ▼
┌────────────────────────────────────┐   ┌────────────────────────────────┐
│      Supabase / Local Fallback     │   │  3. ROAD-AI (FastAPI + YOLO)   │
│  • PostgreSQL + 'reports' Bucket   │   │  • road_damage_v1_best.pt      │
│  • Offline fallback: local-db.json │   │  • 6 road damage classes       │
└────────────────────────────────────┘   └────────────────────────────────┘
```

### Key Features
- **AI Road Damage Detection (`road-ai`)**: FastAPI microservice running Ultralytics YOLO (`road_damage_v1_best.pt`) across 6 road damage classes (`lubang`, `pengelupasan_lapisan_permukaan`, `retak_blok`, `retak_kulit_buaya`, `retak_memanjang`, `retak_pinggir`) with interactive bounding-box inspection (`YoloDetectionViewer`).
- **Location Intelligence & Priority Scoring (`backend`)**: Enriches GPS coordinates using OpenStreetMap Overpass/Nominatim (road class, nearby vital facilities, regional density), evaluates active duplicates within **35 meters** (`+1 support` confirmation), and computes server-enforced `strategic_score`, `priority_score`, and `effective_severity`.
- **Multi-Tier Narrative Drafting**: Generates formal Indonesian road damage drafts using **Qwen** (primary LLM) -> **Google Gemini API** (secondary fallback) -> deterministic **Local Template Orchestrator**.
- **Resilient Dual Storage Mode**: Uses Supabase PostgreSQL and `reports` Storage bucket in production, with seamless local JSON (`backend/data/local-db.json`) and local upload (`backend/uploads/`) fallback when offline.
- **Cross-Platform Client (`frontend`)**: Single codebase supporting static Web (`https://urusjakarta.alamsyah.net`) and native Android builds (`.apk` / `.aab`), with client-side Web image compression, Web camera capture, native `XMLHttpRequest` multipart uploads, and automatic expired-session handling (`401`).

---

## Repository Structure

```text
RPL_Group03_UrusJakarta/
├── backend/              # Express 5 REST API, auth/RBAC, AI orchestrator, tests
├── frontend/             # Expo SDK 57 Web & Android app + Gradle optimization plugin
├── road-ai/              # FastAPI + Ultralytics YOLO road damage inference service
├── start-all.sh          # One-command local startup script (Road-AI + Backend + Web)
├── package.json          # Monorepo convenience scripts
├── documentation/        # Software testing, RTM, model evaluation, UAT reports
└── internal/             # Setup, User, API, Postman, and UAT documentation
```

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** `v20+` (or `v22+`) and **npm** `10+`
- **Python** `3.10–3.14` (for `road-ai`)

### Run All Services Together
```bash
# 1. Configure backend environment
cp backend/.env.example backend/.env

# 2. Install backend & frontend dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Setup road-ai Python environment (optional if running full local YOLO)
cd road-ai && python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd ..

# 4. Launch Road-AI (:8000), Backend (:5000), and Expo Web (:8081)
./start-all.sh
```

Or run components individually from the repository root:
- `npm run ai` — Start Road-AI FastAPI (`http://localhost:8000`)
- `npm run backend` — Start Express API (`http://localhost:5000`)
- `npm run frontend:web` — Start Expo Web (`http://localhost:8081`)
- `npm run prebuild:android` — Generate native Android Gradle project (`frontend/android/`)
- `npm run build:android:apk` — Build Android `.apk` via EAS (`preview` profile)

### Default Demo Accounts (Local Fallback / Seed)
- **Citizen (`citizen`)**: `warga@jakarta.id` / `Password123!`
- **Officer / Admin (`admin`)**: `admin@jakarta.id` / `Password123!`

---

## Testing & Verification

```bash
# Backend unit & integration test suite (11 tests across 3 suites)
cd backend && npm test

# Frontend static Web & Android JS/Hermes bundle export checks
cd frontend
npx expo export --platform web
npx expo export --platform android
```

---

## Documentation Index

- [Setup & Architecture Guide](./internal/SETUP_GUIDE.md)
- [User Guide (Web & Android)](./internal/USER_GUIDE.md)
- [API Documentation & Verification Report](./internal/API_DOCUMENTATION.md)
- [Postman Testing Guide](./internal/POSTMAN_TESTING_GUIDE.md)
- [Road-AI Documentation](./road-ai/README.md)
- [Frontend Guide](./frontend/README.md)
- [QA Test Plan & Reports](./documentation/01_Test_Plan.md)
