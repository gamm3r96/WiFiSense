/* ------------------------------------------------------------------ */
/* WiFiSense Lab — Machine Learning service layer (Phase 8).           */
/*                                                                     */
/* Architecture per the platform brief:                                */
/*                                                                     */
/*   UI  →  MLBackend (interface)                                      */
/*            ├─ PythonMLService        — scikit-learn models behind   */
/*            │                           FastAPI: POST /api/ml/predict│
/*            │                           (authoritative, Phase 9)     */
/*            └─ LocalPrototypeClassifier — deterministic nearest-     */
/*                centroid FALLBACK so the console is usable before    */
/*                the Python service exists. Clearly labelled; never   */
/*                presented as a trained RF/SVM model.                 */
/*                                                                     */
/* No gradient training happens in the browser. The fallback only      */
/* stores class prototypes (mean feature vectors).                     */
/* ------------------------------------------------------------------ */

import type { DatasetSample } from "../types";
import { energy, movingAverage, stdDev } from "../processing/dsp";

export const ACTIVITY_CLASSES = ["EMPTY", "STANDING", "WALKING", "SITTING", "LYING", "WAVING"] as const;
export type ActivityClass = (typeof ACTIVITY_CLASSES)[number];

/** Dataset category → classification label mapping. */
export const CATEGORY_TO_LABEL: Record<string, ActivityClass> = {
  empty: "EMPTY",
  standing: "STANDING",
  walking: "WALKING",
  sitting: "SITTING",
  lying: "LYING",
  waving: "WAVING",
  entering: "WALKING",
  leaving: "WALKING",
};

export const FEATURE_NAMES = [
  "meanAmp",
  "stdAmp",
  "energy",
  "mobility",
  "rssiMean",
  "rssiSd",
  "motionMean",
] as const;

export interface FeatureWindow {
  sensorId: string;
  t0: number;
  t1: number;
  features: number[];
}

export interface LabeledWindow {
  label: string;
  window: FeatureWindow;
}

export interface MLPrediction {
  prediction: string;
  /** 0..1 — model confidence, an estimate not a guarantee. */
  confidence: number;
  distribution: Record<string, number>;
  backend: string;
  at: number;
}

export interface MLBackend {
  readonly id: string;
  readonly name: string;
  readonly fitted: boolean;
  available(): boolean;
  predict(w: FeatureWindow): Promise<MLPrediction>;
  fit(windows: LabeledWindow[]): Promise<{ ok: boolean; note: string; perClass: Record<string, number> }>;
}

/* ------------------------- feature extraction ---------------------- */

export function windowFeatures(amps: number[], rssis: number[], scores: number[]): number[] {
  if (amps.length === 0) return FEATURE_NAMES.map(() => 0);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  let diffSum = 0;
  for (let i = 1; i < amps.length; i++) diffSum += Math.abs(amps[i] - amps[i - 1]);
  const mobility = diffSum / Math.max(1, amps.length - 1) / (mean(amps) + 1e-6);
  return [
    mean(amps),
    stdDev(amps),
    energy(amps) / amps.length,
    mobility,
    mean(rssis),
    stdDev(rssis),
    mean(scores),
  ];
}

/** Sliding feature windows over recorded samples (used for fitting/validation). */
export function extractWindows(samples: DatasetSample[], winLen = 30, hop = 15): FeatureWindow[] {
  const out: FeatureWindow[] = [];
  if (samples.length < winLen) return out;
  const sensorId = samples[0].sensorId;
  for (let i = 0; i + winLen <= samples.length; i += hop) {
    const slice = samples.slice(i, i + winLen);
    out.push({
      sensorId,
      t0: slice[0].t,
      t1: slice[slice.length - 1].t,
      features: windowFeatures(
        slice.map((s) => s.amp),
        slice.map((s) => s.rssi),
        slice.map((s) => s.score),
      ),
    });
  }
  return out;
}

/** Build one window from a live telemetry buffer tail. */
export function liveWindow(buf: { t: number; amp: number; rssi: number; score: number }[], sensorId: string, winLen = 30): FeatureWindow | null {
  if (buf.length < winLen) return null;
  const slice = buf.slice(-winLen);
  return {
    sensorId,
    t0: slice[0].t,
    t1: slice[slice.length - 1].t,
    features: windowFeatures(
      slice.map((p) => p.amp),
      slice.map((p) => p.rssi),
      slice.map((p) => p.score),
    ),
  };
}

/* ------------------- local prototype fallback ---------------------- */

export class LocalPrototypeClassifier implements MLBackend {
  readonly id = "local-prototype";
  readonly name = "Local Prototype Classifier (nearest-centroid fallback)";
  fitted = false;
  private centroids = new Map<string, number[]>();
  private scale: number[] = [];
  private counts: Record<string, number> = {};

  available(): boolean {
    return this.fitted;
  }

  get classes(): string[] {
    return [...this.centroids.keys()];
  }

  perClass(): Record<string, number> {
    return { ...this.counts };
  }

  fit(windows: LabeledWindow[]): Promise<{ ok: boolean; note: string; perClass: Record<string, number> }> {
    return Promise.resolve(this.fitSync(windows));
  }

  /** Synchronous core — used directly by the self-test suite. */
  fitSync(windows: LabeledWindow[]): { ok: boolean; note: string; perClass: Record<string, number> } {
    if (windows.length === 0) return { ok: false, note: "No labeled windows — record datasets first", perClass: {} };
    const sums = new Map<string, number[]>();
    const counts: Record<string, number> = {};
    for (const lw of windows) {
      const c = sums.get(lw.label) ?? lw.window.features.map(() => 0);
      lw.window.features.forEach((v, i) => (c[i] += v));
      sums.set(lw.label, c);
      counts[lw.label] = (counts[lw.label] ?? 0) + 1;
    }
    if (sums.size < 2)
      return { ok: false, note: "Need at least two distinct activity labels to fit", perClass: counts };
    // Pooled per-feature scale for distance normalization.
    const dim = windows[0].window.features.length;
    const scale = new Array(dim).fill(0);
    for (const lw of windows) lw.window.features.forEach((v, i) => (scale[i] += v * v));
    this.scale = scale.map((s) => Math.sqrt(s / windows.length) || 1);
    this.centroids = new Map(
      [...sums.entries()].map(([label, s]) => [label, s.map((v) => v / (counts[label] ?? 1))]),
    );
    this.counts = counts;
    this.fitted = true;
    return {
      ok: true,
      note: `Fitted ${sums.size} class prototypes from ${windows.length} windows (deterministic; fallback only)`,
      perClass: counts,
    };
  }

  predict(w: FeatureWindow): Promise<MLPrediction> {
    return Promise.resolve(this.predictSync(w));
  }

  predictSync(w: FeatureWindow): MLPrediction {
    if (!this.fitted) throw new Error("Prototype classifier not fitted");
    const dists: Array<[string, number]> = [];
    for (const [label, c] of this.centroids) {
      let d = 0;
      c.forEach((cv, i) => {
        const dz = (w.features[i] - cv) / this.scale[i];
        d += dz * dz;
      });
      dists.push([label, d]);
    }
    // Softmax over negative squared distance (temperature 2).
    const neg = dists.map(([, d]) => Math.exp(-d / 2));
    const z = neg.reduce((s, v) => s + v, 0) || 1;
    const distribution: Record<string, number> = {};
    let best = dists[0][0];
    let bestP = 0;
    dists.forEach(([label], i) => {
      const p = neg[i] / z;
      distribution[label] = p;
      if (p > bestP) {
        bestP = p;
        best = label;
      }
    });
    return { prediction: best, confidence: bestP, distribution, backend: this.id, at: Date.now() };
  }
}

/* ----------------------- Python ML service ------------------------- */

function fetchWithTimeout(url: string, init: RequestInit, ms = 1500): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/**
 * Client for the Phase-9 FastAPI service: `POST /predict`, `POST /fit`,
 * `GET /health`. Reports offline honestly until a service answers.
 */
export class PythonMLService implements MLBackend {
  readonly id = "python-sklearn";
  readonly name = "Python ML Service (Random Forest / SVM / LogReg)";
  fitted = false;
  status: "unknown" | "online" | "offline" = "unknown";

  constructor(public baseUrl: string) {}

  available(): boolean {
    return this.status === "online";
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl.replace(/\/$/, "")}/health`, { method: "GET" });
      this.status = res.ok ? "online" : "offline";
    } catch {
      this.status = "offline";
    }
    return this.status === "online";
  }

  async fit(windows: LabeledWindow[]): Promise<{ ok: boolean; note: string; perClass: Record<string, number> }> {
    if (!(await this.health()))
      return { ok: false, note: "Python service unavailable — start it (see Docs) or use the local fallback", perClass: {} };
    const res = await fetchWithTimeout(`${this.baseUrl}/fit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows: windows.map((w) => ({ label: w.label, features: w.window.features })) }),
    });
    const body = (await res.json()) as { ok?: boolean; note?: string; per_class?: Record<string, number>; models?: string[] };
    this.fitted = !!body.ok;
    return { ok: !!body.ok, note: body.note ?? "trained", perClass: body.per_class ?? {} };
  }

  async predict(w: FeatureWindow): Promise<MLPrediction> {
    const res = await fetchWithTimeout(`${this.baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensor_id: w.sensorId, features: w.features }),
    });
    if (!res.ok) throw new Error(`Python service responded ${res.status}`);
    const body = (await res.json()) as { prediction: string; confidence: number; distribution?: Record<string, number> };
    return {
      prediction: body.prediction,
      confidence: body.confidence,
      distribution: body.distribution ?? { [body.prediction]: body.confidence },
      backend: this.id,
      at: Date.now(),
    };
  }
}

/* ------------------------- module singletons ----------------------- */

/** Session-wide fallback classifier (survives page navigation). */
export const localClassifier = new LocalPrototypeClassifier();
/** Session-wide Python client; base URL editable in the ML console. */
export const pythonML = new PythonMLService("http://localhost:8000");

/** Smooth a display trace (used by the Activity console). */
export function smoothTrace(v: number[], win = 5): number[] {
  return movingAverage(v, win);
}
