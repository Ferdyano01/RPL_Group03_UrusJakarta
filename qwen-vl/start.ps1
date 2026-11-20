$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" -m venv .venv
}

$venvPython = if (Test-Path ".venv\Scripts\python.exe") {
    ".venv\Scripts\python.exe"
} else {
    ".venv\bin\python.exe"
}

& $venvPython -m pip install -q -r requirements.txt
& $venvPython -m uvicorn main:app --host 0.0.0.0 --port 8000
