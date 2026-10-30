# Road Damage AI

AI-powered road damage detection and segmentation system using YOLO instance segmentation.

## Project Overview

This system detects and segments damaged roads from photographs, identifying damage types and producing segmentation masks outlining damage boundaries.

### Target Damage Categories
- **Potholes**
- **Longitudinal cracks**
- **Transverse cracks**
- **Alligator cracking**
- **General surface deterioration**

### Current Status
- ✅ Environment verified (Python 3.13, PyTorch 2.14.1+cu126, RTX 4060)
- ✅ YOLO segmentation test passed
- ✅ Training pipeline created and smoke-tested
- 🔄 Full training on Crack-Seg dataset (single "crack" class)
- ⬜ Multi-class road damage dataset
- ⬜ FastAPI backend
- ⬜ Next.js frontend
- ⬜ Severity assessment
- ⬜ Geographic reporting

## System Requirements

| Component | Specification |
|---|---|
| OS | Windows 10/11 |
| Python | 3.13.0 |
| GPU | NVIDIA RTX 4060 (8 GB VRAM) or equivalent |
| RAM | 16 GB minimum |
| Disk | ~5 GB for datasets + models |

## Installation

### 1. Clone and setup virtual environment

```powershell
cd road-ai
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
pip install ultralytics
```

### 3. Verify GPU access

```powershell
python test_yolo.py
```

## Training

### Smoke test (verify pipeline)

```powershell
python training/train.py --smoke-test
```

### Full training (Crack-Seg dataset)

```powershell
python training/train.py --epochs 50 --batch 4 --imgsz 640 --name crack_seg_v1
```

The Crack-Seg dataset (~91.6 MB, 4,029 images) is automatically downloaded on first run.

### Training parameters

| Parameter | Default | Description |
|---|---|---|
| `--model` | `yolo26n-seg.pt` | Pretrained checkpoint |
| `--data` | `crack-seg.yaml` | Dataset config |
| `--epochs` | `50` | Training epochs |
| `--batch` | `4` | Batch size |
| `--imgsz` | `640` | Image size |
| `--workers` | `2` | Data loader workers |
| `--patience` | `20` | Early stopping patience |
| `--device` | `0` | GPU device (0) or cpu |
| `--resume` | `None` | Resume from checkpoint |

### Resume training

```powershell
python training/train.py --resume training_runs/segment/runs/crack_seg_v1/weights/last.pt
```

## Evaluation

```powershell
# Evaluate the original crack-segmentation experiment
python training/evaluate.py --model models/trained/road_damage_v1_best.pt

# With visual predictions
python training/evaluate.py --model models/trained/road_damage_v1_best.pt --visualize
```

## Prediction

```powershell
# Single image: creates inference_outputs/rusak1/
python predict.py --image samples/input/rusak1.jpeg --model models/trained/road_damage_v1_best.pt

# Directory of images: creates inference_outputs/batch1/<image-name>/
python predict.py --image samples/input/

# Custom confidence threshold
python predict.py --image samples/input/rusak1.jpeg --conf 0.3
```

## Run the detector API with Docker

Install Docker Desktop for Windows first, then confirm that Docker is running:

```powershell
docker --version
docker compose version
```

The API uses the local `models/trained/road_damage_v1_best.pt` file through a
read-only Docker volume; the model does not need to be committed to Git.

Build and start the API from the project root:

```powershell
docker compose up --build
```

Open `http://localhost:8000/docs` to test the API in the browser. In another
PowerShell window, test a prediction with:

```powershell
curl.exe -X POST "http://localhost:8000/predict" `
  -F "file=@samples\input\rusak1.jpeg"
```

Useful endpoints:

```text
GET  /health
GET  /model-info
POST /predict
```

Stop the container with `Ctrl+C`, or use `docker compose down`.

Each image folder contains the annotated visualization, the YOLO label file,
and its own `results.json`. Batch numbers increase automatically so previous
results are not overwritten:

```
inference_outputs/
├── rusak1/
│   ├── rusak1.jpeg
│   ├── rusak1.txt
│   └── results.json
└── batch1/
    ├── road/
    │   ├── road.jpg
    │   ├── road.txt
    │   └── results.json
    └── rusak2/
        ├── rusak2.jpg
        ├── rusak2.txt
        └── results.json
```

Training runs are stored separately in `training_runs/<run-name>/`. After a
run completes, the folder is reduced to `weights/best.pt`, `weights/last.pt`,
`results.csv`, and `results.png` (the training improvement curve).

## Project Structure

```
road-ai/
├── training/
│   ├── train.py          # Training script
│   └── evaluate.py       # Evaluation script
├── datasets/
│   ├── road_damage/      # Converted road-damage detection dataset
│   ├── raw/              # Downloaded/source datasets
│   ├── crack_seg.yaml
│   └── road_damage/road_damage.yaml
├── models/
│   ├── base/             # Pretrained/external checkpoints
│   └── trained/          # Project-trained checkpoints
├── backend/              # FastAPI backend (planned)
├── frontend/             # Next.js frontend (planned)
├── samples/input/        # Local test images
├── inference_outputs/    # Organized single-photo and batch predictions
├── training_runs/        # Checkpoints, metrics CSV, and training curve
├── predict.py            # Inference script
├── road_segment.py       # Road-mask inference
├── tools/                # Dataset conversion utilities
├── test_yolo.py          # Initial YOLO test
├── .gitignore
└── README.md
```

## Dataset Information

### Crack-Seg (Initial Experiment)
- **Source:** [Ultralytics Crack-Seg](https://docs.ultralytics.com/datasets/segment/crack-seg/)
- **Images:** 4,029 (3,717 train / 200 val / 112 test)
- **Classes:** 1 (crack)
- **License:** AGPL-3.0
- **Limitation:** Includes both road and wall crack images, single class only

### Annotation Format
YOLO segmentation format: one `.txt` file per image with normalized polygon coordinates.
```
<class_id> <x1> <y1> <x2> <y2> ... <xn> <yn>
```

## Known Limitations

1. **Single class only** — the initial model detects "crack" without distinguishing crack types
2. **Includes non-road images** — the Crack-Seg dataset contains wall crack images
3. **No physical measurements** — mask pixel areas are not calibrated to real-world units
4. **Confidence ≠ severity** — detection confidence does not indicate damage severity

## Licenses

- **Ultralytics YOLO:** AGPL-3.0
- **Crack-Seg Dataset:** AGPL-3.0
- **PyTorch:** BSD-3-Clause
