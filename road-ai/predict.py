"""
Road Damage AI — Prediction Script
=====================================
Run segmentation inference on road photographs using a trained model.

Usage examples:
    # Single image
    python predict.py --image path/to/road_photo.jpg

    # Directory of images
    python predict.py --image path/to/images/

    # Custom model and confidence threshold
    python predict.py --image samples/input/rusak1.jpeg --model models/trained/road_damage_v1_best.pt --conf 0.3

    # Save output to specific directory
    python predict.py --image photo.jpg --output-dir results/
"""

import argparse
import sys
import json
import os
import shutil
import re
from pathlib import Path
from datetime import datetime


def parse_args():
    parser = argparse.ArgumentParser(
        description="Road damage segmentation inference",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--image",
        type=str,
        required=True,
        help="Path to image file or directory of images",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to trained model checkpoint. Auto-detects best.pt if not specified.",
    )
    parser.add_argument("--conf", type=float, default=0.15, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.6, help="IoU threshold for NMS")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument("--device", type=str, default="0", help="Device (0=GPU, cpu=CPU)")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="inference_outputs",
        help="Root directory for organized inference results",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save annotated images (print results only)",
    )
    parser.add_argument(
        "--max-det",
        type=int,
        default=50,
        help="Maximum detections per image",
    )
    return parser.parse_args()


def find_best_model():
    """Auto-detect the best trained model checkpoint."""
    candidates = [
        Path("models/trained/road_damage_v1_best.pt"),
        Path("models/trained/road_segmentation_best.pt"),
        Path("training_runs/segment/crack_seg_v1/weights/best.pt"),
        Path("training_runs/segment/train/weights/best.pt"),
    ]
    # Also search for any best.pt under the current training output root.
    runs_dir = Path("training_runs")
    if runs_dir.exists():
        for best_pt in runs_dir.rglob("best.pt"):
            if best_pt not in candidates:
                candidates.append(best_pt)

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def format_detection(det_idx, cls_name, conf, bbox, mask_area_px, img_w, img_h):
    """Format a single detection result."""
    total_px = img_w * img_h
    relative_area = (mask_area_px / total_px * 100) if total_px > 0 else 0

    return {
        "detection_id": det_idx,
        "class": cls_name,
        "confidence": round(float(conf), 4),
        "bounding_box": {
            "x1": round(float(bbox[0]), 1),
            "y1": round(float(bbox[1]), 1),
            "x2": round(float(bbox[2]), 1),
            "y2": round(float(bbox[3]), 1),
            "width": round(float(bbox[2] - bbox[0]), 1),
            "height": round(float(bbox[3] - bbox[1]), 1),
        },
        "mask": {
            "area_pixels": int(mask_area_px),
            "relative_area_percent": round(relative_area, 3),
            "note": "Pixel area in original image coordinates. Not a physical measurement.",
        },
    }


def process_results(results, model_names, output_dir, save_images):
    """Process and format prediction results."""
    all_results = []

    for r in results:
        img_path = Path(r.path)
        img_h, img_w = r.orig_shape

        image_result = {
            "image": str(img_path.name),
            "image_path": str(img_path.resolve()),
            "dimensions": {"width": img_w, "height": img_h},
            "detections": [],
            "summary": {},
        }

        if r.boxes is not None and len(r.boxes) > 0:
            for i in range(len(r.boxes)):
                cls_id = int(r.boxes.cls[i])
                cls_name = model_names.get(cls_id, f"class_{cls_id}")
                conf = float(r.boxes.conf[i])
                bbox = r.boxes.xyxy[i].cpu().numpy()

                # Calculate mask area in original image coordinates
                mask_area_px = 0
                if r.masks is not None and i < len(r.masks):
                    mask = r.masks.data[i].cpu().numpy()
                    # Scale mask area to original image dimensions
                    mask_h, mask_w = mask.shape
                    scale_x = img_w / mask_w if mask_w > 0 else 1
                    scale_y = img_h / mask_h if mask_h > 0 else 1
                    mask_area_px = int(mask.sum() * scale_x * scale_y)

                det = format_detection(i, cls_name, conf, bbox, mask_area_px, img_w, img_h)
                image_result["detections"].append(det)

            # Summary by class
            class_counts = {}
            for det in image_result["detections"]:
                cls = det["class"]
                if cls not in class_counts:
                    class_counts[cls] = {"count": 0, "max_confidence": 0}
                class_counts[cls]["count"] += 1
                class_counts[cls]["max_confidence"] = max(
                    class_counts[cls]["max_confidence"], det["confidence"]
                )
            image_result["summary"] = {
                "total_detections": len(image_result["detections"]),
                "classes_detected": class_counts,
            }
        else:
            image_result["summary"] = {
                "total_detections": 0,
                "classes_detected": {},
                "note": "No damage detected in this image.",
            }

        all_results.append(image_result)

        # Print per-image summary
        n_dets = len(image_result["detections"])
        print(f"\n  {img_path.name}: {n_dets} detection(s)")
        for det in image_result["detections"]:
            print(
                f"    [{det['detection_id']}] {det['class']} "
                f"(conf: {det['confidence']:.3f}, "
                f"mask: {det['mask']['area_pixels']}px / "
                f"{det['mask']['relative_area_percent']:.2f}%)"
            )

    return all_results


def main():
    args = parse_args()

    print("\n" + "=" * 60)
    print("Road Damage AI — Image Prediction")
    print("=" * 60)

    # Validate input
    image_path = Path(args.image)
    if not image_path.exists():
        print(f"  ERROR: Image path not found: {image_path}")
        sys.exit(1)

    # Find model
    if args.model:
        model_path = Path(args.model)
    else:
        model_path = find_best_model()
        if model_path is None:
            print("  ERROR: No trained model found. Specify --model path/to/best.pt")
            print("  Train a model first with: python training/train.py")
            sys.exit(1)

    if not model_path.exists():
        print(f"  ERROR: Model not found: {model_path}")
        sys.exit(1)

    print(f"  Input:  {image_path.resolve()}")
    print(f"  Model:  {model_path.resolve()}")
    print(f"  Conf:   {args.conf}")
    print(f"  Device: {args.device}")

    # Load model
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    print(f"  Classes: {model.names}")

    # Use a temporary staging directory; final outputs are organized per image below.
    # Ultralytics resolves relative `project` values under its default
    # `runs/<task>` directory. Resolve this path first so inference artifacts
    # always stay under the requested project output root.
    output_root = Path(args.output_dir).resolve()
    save_images = not args.no_save
    if save_images:
        output_root.mkdir(parents=True, exist_ok=True)
    staging_dir = output_root / ".inference_tmp"

    # Run prediction
    print(f"\n  Running inference...")
    results = model.predict(
        source=str(image_path),
        imgsz=args.imgsz,
        conf=args.conf,
        iou=args.iou,
        device=args.device,
        save=save_images,
        save_txt=save_images,
        project=str(output_root),
        name=".inference_tmp",
        exist_ok=True,
        max_det=args.max_det,
        retina_masks=True,  # Higher quality masks
    )
    run_dir = staging_dir

    # Process and display results
    all_results = process_results(results, model.names, output_root, save_images)

    # Organize each image into its own folder.
    if save_images:
        if image_path.is_file():
            batch_dir = output_root
        else:
            batch_numbers = [
                int(match.group(1))
                for item in output_root.iterdir()
                if (match := re.fullmatch(r"batch(\d+)", item.name))
            ]
            batch_dir = output_root / f"batch{max(batch_numbers, default=0) + 1}"
        image_dirs = []
        used_names = set()
        for result in results:
            image_stem = Path(result.path).stem
            folder_name = image_stem
            suffix = 2
            while folder_name in used_names:
                folder_name = f"{image_stem}_{suffix}"
                suffix += 1
            used_names.add(folder_name)
            image_dirs.append(batch_dir / folder_name)

        labels_dir = run_dir / "labels"
        for result, image_result, image_dir in zip(results, all_results, image_dirs):
            image_dir.mkdir(parents=True, exist_ok=True)
            result_stem = Path(result.path).stem
            visualization = next(
                (
                    item
                    for item in run_dir.iterdir()
                    if item.is_file() and item.stem == result_stem
                ),
                None,
            )
            if visualization is not None:
                shutil.move(str(visualization), str(image_dir / visualization.name))

            source_label = labels_dir / f"{result_stem}.txt"
            target_label = image_dir / f"{result_stem}.txt"
            if source_label.exists():
                shutil.move(str(source_label), str(target_label))
            else:
                target_label.touch()

            image_result["model"] = str(model_path.resolve())
            image_result["confidence_threshold"] = args.conf
            image_result["iou_threshold"] = args.iou
            image_result["timestamp"] = datetime.now().isoformat()
            with open(image_dir / "results.json", "w", encoding="utf-8") as file:
                json.dump(image_result, file, indent=2)

        if labels_dir.exists():
            labels_dir.rmdir()
        run_dir.rmdir()

    # Print summary
    total_images = len(all_results)
    total_dets = sum(len(r["detections"]) for r in all_results)
    images_with_dets = sum(1 for r in all_results if r["detections"])

    print(f"\n" + "=" * 60)
    print(f"  Prediction Summary")
    print(f"  Images processed:         {total_images}")
    print(f"  Images with detections:   {images_with_dets}")
    print(f"  Total detections:         {total_dets}")
    if save_images:
        print(f"  Output directory:         {output_root.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
