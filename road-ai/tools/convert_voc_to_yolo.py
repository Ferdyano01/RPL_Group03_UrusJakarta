"""Convert Pascal VOC XML annotations to YOLO detection labels."""

import argparse
import shutil
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path


IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".webp")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert a VOC dataset with train/valid/test folders to YOLO detection format."
    )
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def find_image(split_dir, annotation_path):
    annotation = ET.parse(annotation_path).getroot()
    filename = annotation.findtext("filename")
    if filename:
        candidate = split_dir / Path(filename).name
        if candidate.exists():
            return candidate

    for extension in IMAGE_EXTENSIONS:
        candidate = split_dir / f"{annotation.stem}{extension}"
        if candidate.exists():
            return candidate
    return None


def read_annotation(xml_path):
    root = ET.parse(xml_path).getroot()
    size = root.find("size")
    if size is None:
        raise ValueError("missing <size>")
    width = float(size.findtext("width", "0"))
    height = float(size.findtext("height", "0"))
    if width <= 0 or height <= 0:
        raise ValueError("invalid image dimensions")

    objects = []
    for item in root.findall("object"):
        name = item.findtext("name")
        box = item.find("bndbox")
        if not name or box is None:
            continue
        xmin = float(box.findtext("xmin", "0"))
        ymin = float(box.findtext("ymin", "0"))
        xmax = float(box.findtext("xmax", "0"))
        ymax = float(box.findtext("ymax", "0"))
        xmin, xmax = sorted((max(0.0, xmin), min(width, xmax)))
        ymin, ymax = sorted((max(0.0, ymin), min(height, ymax)))
        if xmax <= xmin or ymax <= ymin:
            continue
        objects.append((name, xmin, ymin, xmax, ymax))
    return width, height, objects


def main():
    args = parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    class_names = set()
    counts = Counter()
    converted = 0
    skipped = 0

    for split in ("train", "valid", "test"):
        split_source = source / split
        if not split_source.exists():
            raise FileNotFoundError(f"Missing split directory: {split_source}")
        image_dir = output / "images" / ("val" if split == "valid" else split)
        label_dir = output / "labels" / ("val" if split == "valid" else split)
        image_dir.mkdir(parents=True, exist_ok=True)
        label_dir.mkdir(parents=True, exist_ok=True)

        for xml_path in sorted(split_source.glob("*.xml")):
            try:
                width, height, objects = read_annotation(xml_path)
            except (ET.ParseError, ValueError) as error:
                print(f"WARNING: skipping {xml_path}: {error}")
                skipped += 1
                continue

            image_path = find_image(split_source, xml_path)
            if image_path is None:
                print(f"WARNING: image not found for {xml_path.name}")
                skipped += 1
                continue

            class_names.update(item[0] for item in objects)
            for item in objects:
                counts[item[0]] += 1
            shutil.copy2(image_path, image_dir / image_path.name)

            labels = []
            for name, xmin, ymin, xmax, ymax in objects:
                center_x = ((xmin + xmax) / 2) / width
                center_y = ((ymin + ymax) / 2) / height
                box_width = (xmax - xmin) / width
                box_height = (ymax - ymin) / height
                labels.append((name, center_x, center_y, box_width, box_height))

            (label_dir / f"{image_path.stem}.txt").write_text(
                "\n".join(
                    f"{name} {center_x:.6f} {center_y:.6f} {box_width:.6f} {box_height:.6f}"
                    for name, center_x, center_y, box_width, box_height in labels
                )
                + ("\n" if labels else ""),
                encoding="utf-8",
            )
            converted += 1

    ordered_classes = sorted(class_names)
    class_ids = {name: index for index, name in enumerate(ordered_classes)}
    for label_path in (output / "labels").rglob("*.txt"):
        lines = label_path.read_text(encoding="utf-8").splitlines()
        rewritten = []
        for line in lines:
            name, *values = line.split()
            rewritten.append(f"{class_ids[name]} {' '.join(values)}")
        label_path.write_text(
            "\n".join(rewritten) + ("\n" if rewritten else ""), encoding="utf-8"
        )

    yaml_lines = [
        "# YOLO detection dataset converted from Pascal VOC XML",
        f"path: {output.as_posix()}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "",
        "names:",
    ]
    yaml_lines.extend(f"  {index}: {name}" for index, name in enumerate(ordered_classes))
    (output / "road_damage.yaml").write_text(
        "\n".join(yaml_lines) + "\n", encoding="utf-8"
    )

    print(f"Converted images: {converted}")
    print(f"Skipped annotations: {skipped}")
    print("Classes:")
    for name in ordered_classes:
        print(f"  {class_ids[name]}: {name} ({counts[name]} boxes)")
    print(f"Dataset YAML: {output / 'road_damage.yaml'}")


if __name__ == "__main__":
    main()
