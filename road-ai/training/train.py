"""
Road Damage AI — Training Script
=================================
Trains a YOLO segmentation model on crack/road-damage datasets.

Usage examples:
    # Smoke test (2 epochs, verify pipeline works)
    python training/train.py --smoke-test

    # Full training with defaults
    python training/train.py

    # Custom training
    python training/train.py --epochs 100 --batch 8 --imgsz 640 --model yolo26n-seg.pt

    # Resume from checkpoint
    python training/train.py --resume training_runs/segment/train/weights/last.pt
"""

import argparse
import sys
import os
import shutil
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def check_gpu():
    """Verify GPU availability and print device info."""
    import torch

    print("=" * 60)
    print("GPU / Environment Check")
    print("=" * 60)
    print(f"  PyTorch:        {torch.__version__}")
    print(f"  CUDA available: {torch.cuda.is_available()}")

    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        vram_gb = round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)
        print(f"  GPU:            {device_name}")
        print(f"  VRAM:           {vram_gb} GB")
        print(f"  CUDA version:   {torch.version.cuda}")
        return True
    else:
        print("  WARNING: No CUDA GPU detected. Training will use CPU (very slow).")
        return False


def validate_dataset(data_yaml: str):
    """Check that the dataset YAML is accessible and valid."""
    from ultralytics.data.utils import check_det_dataset

    print(f"\n  Dataset config: {data_yaml}")

    # If it's a built-in dataset name (like 'crack-seg.yaml'), Ultralytics handles it
    if not os.path.isabs(data_yaml) and not os.path.exists(data_yaml):
        print(f"  Using Ultralytics built-in dataset: {data_yaml}")
        print("  The dataset will be auto-downloaded on first use if not present.")
        return True

    # Check custom dataset path
    data_path = Path(data_yaml)
    if not data_path.exists():
        print(f"  ERROR: Dataset config not found: {data_yaml}")
        return False

    print(f"  Dataset config found: {data_path.resolve()}")
    return True


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train YOLO segmentation model for road damage detection",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # Model
    parser.add_argument(
        "--model",
        type=str,
        default="yolo26n-seg.pt",
        help="Pretrained model checkpoint (e.g. yolo26n-seg.pt, yolo11n-seg.pt)",
    )

    # Dataset
    parser.add_argument(
        "--data",
        type=str,
        default="crack-seg.yaml",
        help="Dataset YAML config path or built-in name",
    )

    # Training parameters
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=4, help="Batch size (reduce if OOM)")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument("--workers", type=int, default=2, help="Data loader workers")
    parser.add_argument("--lr0", type=float, default=0.01, help="Initial learning rate")
    parser.add_argument("--device", type=str, default="0", help="Device: 0 for GPU, cpu for CPU")
    parser.add_argument(
        "--project",
        type=str,
        default="training_runs",
        help="Project directory for saving training artifacts",
    )
    parser.add_argument("--name", type=str, default="train", help="Run name")
    parser.add_argument(
        "--patience",
        type=int,
        default=20,
        help="Early stopping patience (0 to disable)",
    )

    # Mode flags
    parser.add_argument(
        "--smoke-test",
        action="store_true",
        help="Quick 2-epoch run to verify the pipeline works",
    )
    parser.add_argument(
        "--resume",
        type=str,
        default=None,
        help="Resume training from a checkpoint path",
    )

    # Memory optimization
    parser.add_argument(
        "--cache",
        type=str,
        default="False",
        help="Cache images: True, ram, disk, or False",
    )
    parser.add_argument(
        "--amp",
        action="store_true",
        default=True,
        help="Use Automatic Mixed Precision (default: enabled)",
    )
    parser.add_argument(
        "--no-amp",
        action="store_true",
        help="Disable Automatic Mixed Precision",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    print("\n" + "=" * 60)
    print("Road Damage AI — YOLO Segmentation Training")
    print("=" * 60)

    # --- GPU Check ---
    has_gpu = check_gpu()
    if not has_gpu and args.device != "cpu":
        print("\n  No GPU found. Falling back to CPU.")
        args.device = "cpu"

    # --- Smoke test overrides ---
    if args.smoke_test:
        print("\n  >>> SMOKE TEST MODE: 2 epochs, quick validation <<<")
        args.epochs = 2
        args.name = "smoke_test"
        args.patience = 0  # No early stopping for smoke test

    # --- AMP handling ---
    use_amp = args.amp and not args.no_amp

    # --- Resume handling ---
    if args.resume:
        resume_path = Path(args.resume)
        if not resume_path.exists():
            print(f"\n  ERROR: Resume checkpoint not found: {args.resume}")
            sys.exit(1)
        print(f"\n  Resuming from: {resume_path.resolve()}")

    # --- Print configuration ---
    print("\n  Training Configuration:")
    print(f"    Model:      {args.model}")
    print(f"    Dataset:    {args.data}")
    print(f"    Epochs:     {args.epochs}")
    print(f"    Batch size: {args.batch}")
    print(f"    Image size: {args.imgsz}")
    print(f"    Workers:    {args.workers}")
    print(f"    Device:     {args.device}")
    print(f"    AMP:        {use_amp}")
    print(f"    Cache:      {args.cache}")
    print(f"    Patience:   {args.patience}")
    print(f"    Project:    {args.project}")
    print(f"    Run name:   {args.name}")
    print()

    # --- Load model ---
    from ultralytics import YOLO

    if args.resume:
        model = YOLO(args.resume)
        print(f"  Loaded checkpoint for resume: {args.resume}")
    else:
        model = YOLO(args.model)
        print(f"  Loaded pretrained model: {args.model}")

    # --- Parse cache value ---
    cache_val = args.cache
    if cache_val.lower() == "false":
        cache_val = False
    elif cache_val.lower() == "true":
        cache_val = True

    # --- Train ---
    try:
        train_kwargs = dict(
            data=args.data,
            epochs=args.epochs,
            batch=args.batch,
            imgsz=args.imgsz,
            workers=args.workers,
            device=args.device,
            project=args.project,
            name=args.name,
            exist_ok=True,
            pretrained=True,
            amp=use_amp,
            cache=cache_val,
            patience=args.patience,
            lr0=args.lr0,
            verbose=True,
            save=True,
            plots=True,
        )

        # Add resume flag if resuming
        if args.resume:
            train_kwargs["resume"] = True

        results = model.train(**train_kwargs)

        print("\n" + "=" * 60)
        print("Training Complete!")
        print("=" * 60)

        # Print results location
        save_dir = Path(args.project) / args.name
        weights_dir = save_dir / "weights"
        keep_files = {"results.csv", "results.png"}
        for artifact in save_dir.iterdir():
            if artifact.name in keep_files or artifact.name == "weights":
                continue
            if artifact.is_dir():
                shutil.rmtree(artifact)
            else:
                artifact.unlink()
        if weights_dir.exists():
            print(f"  Weights saved to:  {weights_dir.resolve()}")
            best_pt = weights_dir / "best.pt"
            last_pt = weights_dir / "last.pt"
            if best_pt.exists():
                print(f"  Best checkpoint:   {best_pt.resolve()}")
            if last_pt.exists():
                print(f"  Last checkpoint:   {last_pt.resolve()}")

        return results

    except Exception as e:
        print(f"\n  ERROR during training: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
