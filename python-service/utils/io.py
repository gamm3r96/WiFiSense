"""I/O helpers — dataset loaders and sanitization for the processor."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


def sanitize_label(label: str) -> str:
    """Upper-case activity label, stripped to a safe charset."""
    return re.sub(r"[^A-Z_]", "", label.upper())[:24] or "OTHER"


def sanitize_filename(name: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "_", name.lower()).strip("_")[:64] or "export"


def load_dataset_csv(path: str | Path) -> list[dict[str, float]]:
    """Load a WiFiSense CSV export into row dicts."""
    rows: list[dict[str, float]] = []
    with open(path, newline="") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            try:
                rows.append({k: float(v) for k, v in r.items() if k and not k.startswith("#")})
            except ValueError:
                continue
    return rows


def load_dataset_json(path: str | Path) -> dict:
    with open(path) as fh:
        return json.load(fh)


def save_dataset_json(path: str | Path, payload: dict) -> None:
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=2)
