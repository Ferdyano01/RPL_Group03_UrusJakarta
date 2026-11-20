# UrusJakarta — Installation & Quick Start Guide

Welcome to the **UrusJakarta** repository! This documentation provides complete instructions for developers, contributors, and evaluators to set up and run the entire **UrusJakarta** ecosystem (**Road-AI FastAPI**, **Backend Express API**, and **Frontend Expo Web**) locally on **Windows** or **Linux / macOS / WSL**.

---

## System Prerequisites

Before cloning and running the project, ensure the following tools are installed on your system:

* **Git** — [Download Git](https://git-scm.com/)
* **Node.js (LTS recommended) & npm** — [Download Node.js](https://nodejs.org/)
* **Python 3.9+ & `venv`** — [Download Python](https://www.python.org/)
* **Code Editor** (e.g., [Visual Studio Code](https://code.visualstudio.com/), optional)

---

## Step 1: Clone the Repository

Open your terminal (PowerShell on Windows, or Bash/Zsh on Linux/macOS) and clone the project repository:

```bash
git clone https://github.com/Ferdyano01/RPL_Group03_UrusJakarta.git
cd RPL_Group03_UrusJakarta
```

:::info
**Environment Variables:** Check the `backend/`, `frontend/`, and `road-ai/` directories for any `.env.example` template files. If present, duplicate them as `.env` and fill in the required local credentials or API keys before starting the servers.
:::

---

## Option A: Windows Environment (PowerShell)

### 1. Install Dependencies (One-Time Setup)

Run the following commands in **PowerShell** from the project root directory (`RPL_Group03_UrusJakarta`) to install dependencies for all three services:

1. **Road-AI Service (Python):**
   ```powershell
   cd road-ai
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   deactivate
   cd ..
   ```

2. **Backend API (Node.js):**
   ```powershell
   cd backend
   npm install
   cd ..
   ```

3. **Frontend Web App (Expo):**
   ```powershell
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

### 2. Configure the Windows Startup Script

The default `start-all.sh` script is designed for Unix-based shells. To launch all services with a single command on Windows, create a file named **`start-win.ps1`** in the root directory (`RPL_Group03_UrusJakarta`) with the following content:

```powershell
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Starting UrusJakarta Ecosystem (AI + Backend + Frontend)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Start Road-AI in a new PowerShell window
Write-Host "[1/3] Launching Road-AI server (Port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\road-ai'; `$env:MODEL_PATH='models/trained/road_damage_v1_best.pt'; .\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000"

# 2. Start Backend Express in a new PowerShell window
Write-Host "[2/3] Launching Backend API server (Port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node src/server.js"

# Wait 2 seconds to allow backend initialization
Start-Sleep -Seconds 2

# 3. Start Frontend Expo in the current terminal
Write-Host "[3/3] Launching Frontend Expo Web (Port 8081)..." -ForegroundColor Green
Set-Location "$PSScriptRoot\frontend"
npx expo start --web
```

### 3. Run the Application

From the root directory (`RPL_Group03_UrusJakarta`), execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-win.ps1
```

* **What Happens Next:** Two separate PowerShell windows will open for **Road-AI** (`http://localhost:8000`) and **Backend** (`http://localhost:5000`), while your primary terminal compiles **Frontend** (`http://localhost:8081`) and opens it in your default browser.
* **To Stop:** Press `Ctrl + C` in the primary terminal, then close the two secondary PowerShell windows.

---

## Option B: Linux / macOS / WSL Environment (Bash)

### 1. Install Dependencies (One-Time Setup)

Run the following commands in your **Bash/Zsh** terminal from the project root directory (`RPL_Group03_UrusJakarta`):

1. **Road-AI Service (Python):**
   ```bash
   cd road-ai
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   deactivate
   cd ..
   ```

2. **Backend API (Node.js):**
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Frontend Web App (Expo):**
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

4. **Make the startup script executable:**
   ```bash
   chmod +x start-all.sh
   ```

:::warning
**Troubleshooting Line Endings:** If you cloned or edited the repository on a Windows filesystem (e.g., via WSL), convert `start-all.sh` line endings from CRLF to LF before running:
```bash
sed -i 's/\r$//' start-all.sh
```
:::

### 2. Run the Application

Start all three services concurrently in a single terminal session from the project root (`RPL_Group03_UrusJakarta`):

```bash
npm start
```
*(Alternatively, execute `./start-all.sh` directly).*

* **What Happens Next:** **Road-AI** (`http://localhost:8000`), **Backend** (`http://localhost:5000`), and **Frontend** (`http://localhost:8081`) will launch in parallel. If the web browser does not open automatically, press **`w`** in the terminal.
* **To Stop:** Press **`Ctrl + C`** once in the terminal; the built-in cleanup handler will automatically terminate all background services.

---

## Architecture & Local Endpoints

Once all services are running, you can verify each component using the endpoints below:

| Service | Tech Stack | Local Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Road-AI Service** | Python, FastAPI, YOLO | `http://localhost:8000` | Road damage detection inference API (`/health`, `/docs`) |
| **Backend API** | Node.js, Express | `http://localhost:5000` | Core REST API and business logic |
| **Frontend Web** | React Native, Expo Web | `http://localhost:8081` | User interface accessible via web browser |
