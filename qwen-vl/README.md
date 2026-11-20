# Qwen-VL API

This FastAPI service exposes the local Ollama `qwen3-vl:4b-instruct` model through HTTP.
It can be used locally or from another device connected to the same Tailscale tailnet.

## Requirements

- Windows
- Ollama
- Python 3.13
- Tailscale, if accessing the API from another device

## Setup

From this folder, create the virtual environment and install dependencies:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" -m venv .venv
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
```

Make sure the Ollama model is available:

```powershell
ollama list
ollama run qwen3-vl:4b-instruct
```

Stop the interactive Ollama prompt with `/bye`.

## Run the API

Start the server:

```powershell
& ".\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Or use the setup script:

```powershell
.\start.ps1
```

Keep the terminal open while the API is running.

The API is available at:

- Local Swagger docs: `http://127.0.0.1:8000/docs`
- Local health check: `http://127.0.0.1:8000/health`

## Run through Tailscale

Get this computer's IPv4 address on the tailnet:

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" ip -4
```

Replace `<tailscale-ip>` with that address. The API will be available at:

- API docs: `http://<tailscale-ip>:8000/docs`
- Health: `http://<tailscale-ip>:8000/health`
- Chat endpoint: `http://<tailscale-ip>:8000/chat`

Verify the health endpoint:

```powershell
curl.exe "http://<tailscale-ip>:8000/health"
```

The result should contain:

```json
{"status":"ok","model":"qwen3-vl:4b-instruct"}
```

## Text example

```powershell
curl.exe -X POST "http://127.0.0.1:8000/chat" `
  -F "prompt=Reply with exactly: Tailscale OK"
```

## Image and text example

```powershell
curl.exe -X POST "http://127.0.0.1:8000/chat" `
  -F "prompt=Describe this image" `
  -F "image=@C:\path\to\photo.jpg"
```

contoh penggunaan:
```powershell
  -F "prompt=Analize the output accuracy of this yolo inference in shortg"
```"imge=@C:\Users\Jonathan Christopher\Documents\RPL\RPL_Group03_UrusJakarta\road-ai\inference_outputs\rusak3\rusak3.jpg"