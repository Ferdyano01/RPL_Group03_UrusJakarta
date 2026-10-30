"""
Road Damage AI — Evaluation Script
====================================
Evaluates a trained YOLO segmentation model on a test/validation set.

Usage examples:
    # Evaluate best checkpoint on test set
    python training/evaluate.py --model models/trained/road_damage_v1_best.pt

    # Evaluate on validation set
    python training/evaluate.py --model models/trained/road_damage_v1_best.pt --split val

    # Generate visual predictions on test images
    python training/evaluate.py --model models/trained/road_damage_v1_best.pt --visualize
"""

import argparse
import sys
import json
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate YOLO segmentation model for road damage detection",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        help="Path to trained model checkpoint (.pt)",
    )
    parser.add_argument(
        "--data",
        type=str,
        default="crack-seg.yaml",
        help="Dataset YAML config",
    )
    parser.add_argument(
        "--split",
        type=str,
        default="test",
        choices=["test", "val", "train"],
        help="Dataset split to evaluate on",
    )
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--batch", type=int, default=4, help="Batch size")
    parser.add_argument("--device", type=str, default="0", help="Device")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument(
        "--iou",
        type=float,
        default=0.6,
        help="IoU threshold for NMS",
    )
    parser.add_argument(
        "--visualize",
        action="store_true",
        help="Generate segmentation overlays on test images",
    )
    parser.add_argument(
        "--max-vis",
        type=int,
        default=20,
        help="Max images to visualize",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="inference_outputs/evaluation",
        help="Directory to save evaluation results",
    )
    return parser.parse_args()


def evaluate_model(args):
    """Run formal evaluation using model.val()."""
    from ultralytics import YOLO

    print("\n" + "=" * 60)
    print("Road Damage AI — Model Evaluation")
    print("=" * 60)

    # Load model
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"  ERROR: Model not found: {model_path}")
        sys.exit(1)

    print(f"  Model:   {model_path.resolve()}")
    print(f"  Dataset: {args.data}")
    print(f"  Split:   {args.split}")
    print(f"  ImgSize: {args.imgsz}")
    print(f"  Conf:    {args.conf}")
    print(f"  IoU:     {args.iou}")

    model = YOLO(str(model_path))

    # Run validation/evaluation
    print(f"\n  Running evaluation on '{args.split}' split...")
    metrics = model.val(
        data=args.data,
        split=args.split,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        conf=args.conf,
        iou=args.iou,
        plots=True,
        save_json=False,
        verbose=True,
    )

    # Extract and display metrics
    print("\n" + "=" * 60)
    print("Evaluation Results")
    print("=" * 60)

    results_dict = {}

    # Segmentation metrics (primary for this task)
    try:
        seg_map50 = metrics.seg.map50
        seg_map50_95 = metrics.seg.map
        seg_mp = metrics.seg.mp
        seg_mr = metrics.seg.mr

        print("\n  Segmentation Metrics (Mask):")
        print(f"    mAP@50:      {seg_map50:.4f}")
        print(f"    mAP@50-95:   {seg_map50_95:.4f}")
        print(f"    Precision:   {seg_mp:.4f}")
        print(f"    Recall:      {seg_mr:.4f}")

        results_dict["segmentation"] = {
            "mAP50": round(float(seg_map50), 4),
            "mAP50_95": round(float(seg_map50_95), 4),
            "precision": round(float(seg_mp), 4),
            "recall": round(float(seg_mr), 4),
        }
    except AttributeError as e:
        print(f"  Could not extract segmentation metrics: {e}")

    # Box metrics
    try:
        box_map50 = metrics.box.map50
        box_map50_95 = metrics.box.map
        box_mp = metrics.box.mp
        box_mr = metrics.box.mr

        print("\n  Detection Metrics (Box):")
        print(f"    mAP@50:      {box_map50:.4f}")
        print(f"    mAP@50-95:   {box_map50_95:.4f}")
        print(f"    Precision:   {box_mp:.4f}")
        print(f"    Recall:      {box_mr:.4f}")

        results_dict["detection"] = {
            "mAP50": round(float(box_map50), 4),
            "mAP50_95": round(float(box_map50_95), 4),
            "precision": round(float(box_mp), 4),
            "recall": round(float(box_mr), 4),
        }
    except AttributeError as e:
        print(f"  Could not extract box metrics: {e}")

    # Per-class metrics
    try:
        class_names = model.names
        if hasattr(metrics.seg, "ap50") and metrics.seg.ap50 is not None:
            print("\n  Per-Class Segmentation AP@50:")
            per_class = {}
            for i, ap in enumerate(metrics.seg.ap50):
                name = class_names.get(i, f"class_{i}")
                print(f"    {name}: {ap:.4f}")
                per_class[name] = round(float(ap), 4)
            results_dict["per_class_seg_ap50"] = per_class
    except (AttributeError, TypeError) as e:
        print(f"  Could not extract per-class metrics: {e}")

    # Save results to JSON
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    results_dict["metadata"] = {
        "model": str(model_path.resolve()),
        "dataset": args.data,
        "split": args.split,
        "imgsz": args.imgsz,
        "conf_threshold": args.conf,
        "iou_threshold": args.iou,
        "timestamp": datetime.now().isoformat(),
    }

    results_file = output_dir / "eval_results.json"
    with open(results_file, "w") as f:
        json.dump(results_dict, f, indent=2)
    print(f"\n  Results saved to: {results_file.resolve()}")

    return metrics, model


def visualize_predictions(model, args):
    """Generate segmentation overlays on test images for visual inspection."""
    print("\n" + "=" * 60)
    print("Generating Visual Predictions")
    print("=" * 60)

    output_dir = Path(args.output_dir) / "visualizations"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Run prediction on the split
    results = model.predict(
        source=args.data,
        imgsz=args.imgsz,
        conf=args.conf,
        iou=args.iou,
        device=args.device,
        save=True,
        save_txt=True,
        project=str(output_dir),
        name="predictions",
        exist_ok=True,
        max_det=50,
    )

    print(f"\n  Predictions saved to: {output_dir.resolve()}")
    print(f"  Total images processed: {len(results)}")

    # Summary of detections
    total_detections = 0
    images_with_detections = 0
    images_without_detections = 0

    for r in results:
        n_dets = len(r.boxes) if r.boxes is not None else 0
        total_detections += n_dets
        if n_dets > 0:
            images_with_detections += 1
        else:
            images_without_detections += 1

    print(f"\n  Detection Summary:")
    print(f"    Total detections:          {total_detections}")
    print(f"    Images with detections:    {images_with_detections}")
    print(f"    Images without detections: {images_without_detections}")

    return results


def main():
    args = parse_args()
    metrics, model = evaluate_model(args)

    if args.visualize:
        visualize_predictions(model, args)

    print("\n" + "=" * 60)
    print("Evaluation Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
