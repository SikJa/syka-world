#!/usr/bin/env python3
"""Normalize the approved Cafe NPC sheet into a strict runtime atlas.

The generated source deliberately remains untouched. This script extracts the
five characters from four authored pose bands, trims transparent padding and
places every pose on the same bottom-centred pivot using nearest-neighbour
resampling so Phaser can register a deterministic 5x4 atlas.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


NPC_COLUMNS = 5
POSE_ROWS = 4
CELL_SIZE = (128, 160)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def proportional_bound(total: int, fraction: float) -> int:
    return max(0, min(total, round(total * fraction)))


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.point(lambda value: 255 if value > 24 else 0).getbbox()


def normalize_pose(source: Image.Image, bounds: tuple[int, int, int, int]) -> Image.Image:
    pose = source.crop(bounds)
    bbox = alpha_bbox(pose)
    if bbox is None:
        raise ValueError(f"No visible character pixels in source bounds {bounds}.")
    pose = pose.crop(bbox)
    cell_width, cell_height = CELL_SIZE
    maximum_width = cell_width - 12
    maximum_height = cell_height - 8
    scale = min(maximum_width / pose.width, maximum_height / pose.height)
    draw_width = max(1, round(pose.width * scale))
    draw_height = max(1, round(pose.height * scale))
    pose = pose.resize((draw_width, draw_height), Image.Resampling.NEAREST)
    cell = Image.new("RGBA", CELL_SIZE, (0, 0, 0, 0))
    x = (cell_width - draw_width) // 2
    y = cell_height - draw_height - 4
    cell.alpha_composite(pose, (x, y))
    return cell


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    width, height = source.size

    # The model produced clean visual rows but not mathematically equal bands.
    # These stable separators fall in the transparent gaps between each row.
    row_fractions = (0.0, 0.286, 0.507, 0.724, 1.0)
    row_bounds = [proportional_bound(height, value) for value in row_fractions]
    column_bounds = [round(width * column / NPC_COLUMNS) for column in range(NPC_COLUMNS + 1)]

    atlas = Image.new(
        "RGBA",
        (CELL_SIZE[0] * NPC_COLUMNS, CELL_SIZE[1] * POSE_ROWS),
        (0, 0, 0, 0),
    )
    for row in range(POSE_ROWS):
        for column in range(NPC_COLUMNS):
            bounds = (
                column_bounds[column],
                row_bounds[row],
                column_bounds[column + 1],
                row_bounds[row + 1],
            )
            pose = normalize_pose(source, bounds)
            atlas.alpha_composite(pose, (column * CELL_SIZE[0], row * CELL_SIZE[1]))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.output, format="PNG", optimize=True)
    print(f"Wrote {args.output} ({atlas.width}x{atlas.height}, {NPC_COLUMNS}x{POSE_ROWS}).")


if __name__ == "__main__":
    main()
