import base64
import os

import httpx
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3-vl:4b-instruct")

app = FastAPI(title="Qwen-VL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
        return {"status": "ok", "model": OLLAMA_MODEL}
    except httpx.HTTPError as exc:
        return {"status": "error", "detail": str(exc)}


@app.post("/chat")
async def chat(
    prompt: str = Form(...),
    image: UploadFile | None = File(default=None),
):
    message: dict[str, object] = {
        "role": "user",
        "content": prompt,
    }

    if image is not None:
        image_bytes = await image.read()
        message["images"] = [base64.b64encode(image_bytes).decode("ascii")]

    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [message],
                "stream": False,
            },
        )
        response.raise_for_status()

    data = response.json()
    return {
        "response": data["message"]["content"],
        "model": data.get("model", OLLAMA_MODEL),
    }
