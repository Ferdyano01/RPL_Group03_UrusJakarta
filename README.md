# UrusJakarta Installation & Running Guide

This guide covers step-by-step instructions to install and run the entire **UrusJakarta** ecosystem (**Road-AI FastAPI**, **Backend Express API**, and **Frontend Expo Web**) on both **Windows** and **Linux / macOS / WSL** environments.

---

## System Prerequisites

Ensure the following software tools are installed on your machine before getting started:

* **Git**
* **Node.js** (LTS version recommended) & **npm**
* **Python 3.9+** & `venv`
* **Visual Studio Code** (optional, recommended)

---

## Version 1: Windows Environment (PowerShell)

### 1. Clone Repository & Initial Setup (One-Time Setup)

Open a terminal (**PowerShell** or **VS Code Integrated Terminal**) in the directory where you want to store the project, then run the following commands sequentially:

1. **Clone the repository and navigate into the project folder:**
   ```powershell
   git clone https://github.com/Ferdyano01/RPL_Group03_UrusJakarta.git
   cd RPL_Group03_UrusJakarta
   ```

2. **Install Road-AI dependencies (Python):**
   ```powershell
   cd road-ai
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   deactivate
   cd ..
   ```

3. **Install Backend dependencies (Node.js):**
   ```powershell
   cd backend
   npm install
   cd ..
   ```

4. **Install Frontend dependencies (Expo):**
   ```powershell
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

:::info
**Note:** If there is an `.env.example` file inside the `backend`, `frontend`, or `road-ai` directories, duplicate and rename it to `.env`, then adjust the environment variables according to your local configuration.
:::

### 2. Create Automated Windows Startup Script (`start-win.ps1`)

Create a new file named **`start-win.ps1`** in the root directory (`RPL_Group03_UrusJakarta`), and paste the following PowerShell script into it:

```powershell
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Running UrusJakarta Ecosystem (AI + Backend + Frontend)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Start Road-AI in a new PowerShell window
Write-Host "[1/3] Starting Road-AI server (Port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\road-ai'; `$env:MODEL_PATH='models/trained/road_damage_v1_best.pt'; .\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000"

# 2. Start Backend Express in a new PowerShell window
Write-Host "[2/3] Starting Backend API server (Port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node src/server.js"

# Wait 2 seconds to ensure backend initialization
Start-Sleep -Seconds 2

# 3. Start Frontend Expo in the main VS Code terminal
Write-Host "[3/3] Starting Frontend Expo (Port 8081)..." -ForegroundColor Green
Set-Location "$PSScriptRoot\frontend"
npx expo start --web
```

### 3. Run the Application on Windows

Whenever you want to launch the application, open a terminal in the root directory (`RPL_Group03_UrusJakarta`) and execute this single command:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-win.ps1
```

* **Expected Result:** Two new PowerShell windows will automatically open to run **Road-AI** (`http://localhost:8000`) and **Backend** (`http://localhost:5000`), while the main terminal starts **Frontend** (`http://localhost:8081`) and opens your web browser automatically.
* **Stopping the Application:** Press `Ctrl + C` in the main VS Code terminal, then close the two secondary PowerShell windows.

---

## Version 2: Linux / macOS / WSL Environment (Bash)

### 1. Clone Repository & Initial Setup (One-Time Setup)

Open a Bash terminal in your workspace directory and run the following commands:

1. **Clone the repository and navigate into the project folder:**
   ```bash
   git clone https://github.com/Ferdyano01/RPL_Group03_UrusJakarta.git
   cd RPL_Group03_UrusJakarta
   ```

2. **Install Road-AI dependencies (Python):**
   ```bash
   cd road-ai
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   deactivate
   cd ..
   ```

3. **Install Backend dependencies (Node.js):**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Install Frontend dependencies (Expo):**
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

5. **Grant execution permissions to the default startup script (`start-all.sh`):**
   ```bash
   chmod +x start-all.sh
   ```

:::warning
**Line-Ending Check:** If `start-all.sh` was previously edited or cloned on Windows, ensure its line endings use **LF** instead of **CRLF** by running:
```bash
sed -i 's/\r$//' start-all.sh
```
:::

### 2. Run the Application on Linux / macOS / WSL

To launch all services simultaneously within a single terminal session, run the default start command from the root directory (`RPL_Group03_UrusJakarta`):

```bash
npm start
```
*(Alternatively, you can run `./start-all.sh`)*

* **Expected Result:** **Road-AI** (`http://localhost:8000`), **Backend** (`http://localhost:5000`), and **Frontend** (`http://localhost:8081`) will run concurrently in the background within a single terminal session. If the browser does not open automatically, press **`w`** in the terminal.
* **Stopping the Application:** Press **`Ctrl + C`** once in the terminal; the built-in `cleanup()` trap inside `start-all.sh` will automatically terminate all background processes.

---

## Service Ports Summary

| Service | Technology Stack | Local URL |
| :--- | :--- | :--- |
| **Road-AI Service** | Python / FastAPI (YOLO) | `http://localhost:8000` |
| **Backend API** | Node.js / Express | `http://localhost:5000` |
| **Frontend Web** | React Native / Expo Web | `http://localhost:8081` |
