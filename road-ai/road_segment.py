"""Road-only segmentation inference with bottom-connected mask selection."""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from ultralytics import YOLO


def parse_args():
    parser = argparse.ArgumentParser(
        description="Segment the road and discard implausible masks such as sky regions."
    )
    parser.add_argument("--image", required=True, help="Image file or directory")
    parser.add_argument(
        "--model",
        default="models/trained/road_segmentation_best.pt",
        help="Road segmentation checkpoint",
    )
    parser.add_argument("--conf", type=float, default=0.15)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument(
        "--output-dir",
        default="inference_outputs/road_segmentation",
        help="Directory for annotated images and masks",
    )
    return parser.parse_args()


def select_road_mask(result):
    """Select the candidate with the strongest support in the lower image."""
    if result.masks is None or result.boxes is None or len(result.masks.data) == 0:
        return None, None

    masks = result.masks.data.cpu().numpy().astype(bool)
    height, width = result.orig_shape
    bottom_start = max(0, int(height * 0.8))
    scores = []

    for index, mask in enumerate(masks):
        resized = np.asarray(
            Image.fromarray(mask.astype(np.uint8)).resize(
                (width, height), resample=Image.Resampling.NEAREST
            ),
            dtype=bool,
        )
        bottom_fraction = float(resized[bottom_start:, :].mean())
        total_fraction = float(resized.mean())
        ys = np.flatnonzero(resized)
        centroid_y = float(ys.mean() / height) if ys.size else 0.0
        score = 4.0 * bottom_fraction + 1.5 * centroid_y + 0.25 * total_fraction
        scores.append((score, index, resized))

    _, selected_index, selected_mask = max(scores, key=lambda item: item[0])
    return selected_index, selected_mask


def main():
    args = parse_args()
    model = YOLO(args.model)
    results = model.predict(
        source=args.image,
        classes=[1],
        conf=args.conf,
        imgsz=args.imgsz,
        retina_masks=True,
        verbose=True,
    )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for result in results:
        selected_index, selected_mask = select_road_mask(result)
        image = Image.open(result.path).convert("RGB")
        image_array = np.asarray(image).copy()

        if selected_mask is not None:
            overlay = np.zeros_like(image_array)
            overlay[:, :, 1] = 200
            overlay[:, :, 2] = 255
            image_array[selected_mask] = (
                0.55 * image_array[selected_mask] + 0.45 * overlay[selected_mask]
            ).astype(np.uint8)
            status = f"selected mask {selected_index}"
        else:
            status = "no road mask selected"

        output_path = output_dir / Path(result.path).name
        Image.fromarray(image_array).save(output_path)
        print(f"{Path(result.path).name}: {status}; saved to {output_path.resolve()}")


if __name__ == "__main__":
    main()
