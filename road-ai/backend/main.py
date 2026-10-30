import io
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO


MODEL_PATH = Path(
    os.getenv("MODEL_PATH", "/app/models/trained/road_damage_v1_best.pt")
)
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(title="Road Damage AI API", version="1.0.0")
model: YOLO | None = None


@app.on_event("startup")
def load_model() -> None:
    global model
    if not MODEL_PATH.is_file():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")
    model = YOLO(str(MODEL_PATH))


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": model is not None,
    }


@app.get("/model-info")
def model_info() -> dict:
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    return {
        "model": MODEL_PATH.name,
        "classes": model.names,
    }


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    conf: float = Query(0.15, ge=0.0, le=1.0),
    iou: float = Query(0.6, ge=0.0, le=1.0),
) -> dict:
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, and WebP images are supported",
        )

    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB limit")

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image") from error

    result = model.predict(source=image, conf=conf, iou=iou, device="cpu", verbose=False)[0]
    detections = []
    if result.boxes is not None:
        for index in range(len(result.boxes)):
            box = result.boxes.xyxy[index].tolist()
            class_id = int(result.boxes.cls[index])
            detections.append(
                {
                    "detection_id": index,
                    "class_id": class_id,
                    "class": model.names[class_id],
                    "confidence": round(float(result.boxes.conf[index]), 4),
                    "bounding_box": {
                        "x1": round(box[0], 1),
                        "y1": round(box[1], 1),
                        "x2": round(box[2], 1),
                        "y2": round(box[3], 1),
                    },
                }
            )

    class_counts: dict[str, dict[str, float | int]] = {}
    for detection in detections:
        class_name = detection["class"]
        current = class_counts.setdefault(
            class_name, {"count": 0, "max_confidence": 0.0}
        )
        current["count"] = int(current["count"]) + 1
        current["max_confidence"] = max(
            float(current["max_confidence"]), float(detection["confidence"])
        )

    return {
        "image": file.filename,
        "dimensions": {"width": image.width, "height": image.height},
        "detections": detections,
        "summary": {
            "total_detections": len(detections),
            "classes_detected": class_counts,
        },
    }
