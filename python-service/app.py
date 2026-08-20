"""WiFiSense Lab — Python CSI processing & ML service (Phase 9).

FastAPI service that the web platform delegates heavy work to:

    GET  /health    → liveness + model inventory
    POST /process   → denoise / filter a CSI amplitude series
    POST /features  → sliding feature windows over samples
    POST /fit       → train scikit-learn classifiers on labeled windows
    POST /predict   → classify one feature window

Run:  uvicorn app:app --host 0.0.0.0 --port 8000

The web app never assumes this service is running — when it is offline
the console falls back to clearly-labelled local processing.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from models.classifier import ModelHub
from processors.csi import CsiProcessor
from utils.io import sanitize_label

app = FastAPI(title="WiFiSense Lab Processor", version="0.9.0")

# The web console runs on the Vite dev port / static host — restrict to it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

processor = CsiProcessor()
models = ModelHub()


class SeriesIn(BaseModel):
    values: list[float]
    fs_hz: float = Field(default=10.0, gt=0, le=1000)
    filter_kind: str = "moving_average"
    window: int = Field(default=5, ge=1, le=255)
    alpha: float = Field(default=0.2, gt=0, le=1)


class SamplesIn(BaseModel):
    amps: list[float]
    rssis: list[float] = []
    scores: list[float] = []
    win_len: int = Field(default=30, ge=5, le=600)
    hop: int = Field(default=15, ge=1, le=600)


class LabeledWindowIn(BaseModel):
    label: str
    features: list[float]


class FitIn(BaseModel):
    windows: list[LabeledWindowIn]
    model: str = "random_forest"  # random_forest | svm | logistic


class PredictIn(BaseModel):
    sensor_id: str = "unknown"
    features: list[float]


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "wifisense-python",
        "version": app.version,
        "models_fitted": models.fitted,
        "classes": models.classes,
        "time": time.time(),
    }


@app.post("/process")
def process(body: SeriesIn) -> dict[str, Any]:
    out = processor.filter(body.values, body.filter_kind, body.window, body.alpha)
    return {"ok": True, "values": out, "n": len(out)}


@app.post("/features")
def features(body: SamplesIn) -> dict[str, Any]:
    windows = processor.windows(body.amps, body.rssis, body.scores, body.win_len, body.hop)
    return {"ok": True, "windows": windows, "feature_names": processor.FEATURE_NAMES}


@app.post("/fit")
def fit(body: FitIn) -> dict[str, Any]:
    labels = [sanitize_label(w.label) for w in body.windows]
    feats = [w.features for w in body.windows]
    note, per_class = models.fit(labels, feats, body.model)
    return {"ok": models.fitted, "note": note, "per_class": per_class, "models": models.available_models()}


@app.post("/predict")
def predict(body: PredictIn) -> dict[str, Any]:
    if not models.fitted:
        return {"prediction": "UNKNOWN", "confidence": 0.0, "error": "no model fitted — call /fit first"}
    pred, conf, dist = models.predict(body.features)
    return {"prediction": pred, "confidence": conf, "distribution": dist}
