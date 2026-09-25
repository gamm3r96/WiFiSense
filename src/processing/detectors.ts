/* ------------------------------------------------------------------ */
/* WiFiSense Lab — Baseline Signal Motion Detector (Phase 5).          */
/*                                                                     */
/* A deliberately NON-ML statistical detector. It fuses three          */
/* classical indicators over a moving window:                          */
/*                                                                     */
/*   1. signal variance      — broadband energy of amplitude jitter    */
/*   2. amplitude deviation  — mean shift versus the empty-room        */
/*                             baseline (a person changes the mean     */
/*                             multipath sum)                          */
/*   3. temporal difference  — per-frame |Δamp|, sensitive to fast     */
/*                             motion (walking, waving)                */
/*                                                                     */
/* Outputs: motion (bool, with hysteresis) and motion_score ∈ [0,1].   */
/* Scores are algorithmic estimates, never physical guarantees.        */
/* The ML activity classifier is a separate Phase 8 module — this      */
/* detector must not be described as machine learning.                 */
/* ------------------------------------------------------------------ */

import { clamp01 } from "../utils/format";

export interface DetectorInput {
  t: number;
  amp: number;
  /** Per-frame spectral variance emitted by the CSI pipeline. */
  variance: number;
}

export interface MotionConfig {
  /** Score at which motion activates (0..1). */
  threshold: number;
  /** Moving window length in pipeline frames (ticks). */
  windowTicks: number;
  /** Overall gain applied to the fused score (0.5..2). */
  sensitivity: number;
}

export const DEFAULT_MOTION_CFG: MotionConfig = {
  threshold: 0.4,
  windowTicks: 20,
  sensitivity: 1.2,
};

/** Fusion weights — fixed, documented, tunable only here. */
export const MOTION_WEIGHTS = {
  variance: 0.45,
  amplitudeDev: 0.25,
  temporalDiff: 0.3,
} as const;

/** Component normalization scales (relative units). */
const SCALE = {
  relVariance: 0.02, // relative variance considered "fully active"
  ampDev: 0.15, // 15 % mean shift ≈ saturated
  temporalDiff: 0.04, // 4 % per-frame change ≈ saturated
} as const;

/** Empty-room reference captured by the operator (Phase 5/6 shared). */
export interface MotionBaseline {
  meanAmp: number;
  varAmp: number;
  meanVariance: number;
  ticks: number;
  /** Engine sim-time at capture. */
  capturedAtSim: number;
}

export interface MotionComponents {
  variance: number;
  amplitudeDev: number;
  temporalDiff: number;
}

export interface MotionResult {
  motion: boolean;
  score: number;
  components: MotionComponents;
  /** False when no baseline exists and self-normalization is used. */
  baselineUsed: boolean;
  windowTicks: number;
  /** Rising/falling edge flags (set by the stateful detector). */
  rose?: boolean;
  fell?: boolean;
}

export function estimateBaseline(points: DetectorInput[], capturedAtSim: number): MotionBaseline {
  const n = points.length;
  if (n === 0) return { meanAmp: 1, varAmp: 0, meanVariance: 0, ticks: 0, capturedAtSim };
  let sum = 0;
  let sumSq = 0;
  let vSum = 0;
  for (const p of points) {
    sum += p.amp;
    sumSq += p.amp * p.amp;
    vSum += p.variance;
  }
  const mean = sum / n;
  return {
    meanAmp: mean,
    varAmp: Math.max(1e-9, sumSq / n - mean * mean),
    meanVariance: vSum / n,
    ticks: n,
    capturedAtSim,
  };
}

/** Stateless one-shot evaluation (deterministic; used by the self-tests). */
export function detectMotion(
  points: DetectorInput[],
  cfg: MotionConfig,
  baseline: MotionBaseline | null,
): MotionResult {
  const win = points.slice(-Math.max(3, cfg.windowTicks));
  const n = win.length;
  if (n < 3) {
    return {
      motion: false,
      score: 0,
      components: { variance: 0, amplitudeDev: 0, temporalDiff: 0 },
      baselineUsed: !!baseline,
      windowTicks: n,
    };
  }

  let sum = 0;
  let sumSq = 0;
  let diffSum = 0;
  for (let i = 0; i < n; i++) {
    sum += win[i].amp;
    sumSq += win[i].amp * win[i].amp;
    if (i > 0) diffSum += Math.abs(win[i].amp - win[i - 1].amp);
  }
  const mean = sum / n;
  const varAmp = Math.max(0, sumSq / n - mean * mean);
  const meanAbsDiff = diffSum / (n - 1);

  /* ---- component 1: variance ---- */
  let varComp: number;
  let ampComp: number;
  if (baseline && baseline.ticks > 0) {
    const excess = Math.max(0, varAmp - baseline.varAmp);
    varComp = clamp01(excess / (baseline.varAmp + 1e-6) / 1.5);
    const dev = Math.abs(mean - baseline.meanAmp) / (baseline.meanAmp + 1e-6);
    ampComp = clamp01(dev / SCALE.ampDev);
  } else {
    // Self-normalized fallback: relative variance against the window mean.
    varComp = clamp01(varAmp / (mean * mean) / SCALE.relVariance);
    ampComp = 0; // no reference — deviation is undefined without a baseline
  }

  /* ---- component 3: temporal difference ---- */
  const tdComp = clamp01(meanAbsDiff / (mean + 1e-6) / SCALE.temporalDiff);

  const score = clamp01(
    cfg.sensitivity *
      (MOTION_WEIGHTS.variance * varComp +
        MOTION_WEIGHTS.amplitudeDev * ampComp +
        MOTION_WEIGHTS.temporalDiff * tdComp),
  );

  return {
    motion: score >= cfg.threshold,
    score,
    components: { variance: varComp, amplitudeDev: ampComp, temporalDiff: tdComp },
    baselineUsed: !!baseline,
    windowTicks: n,
  };
}

/**
 * Stateful detector: applies hysteresis so the motion flag does not flap
 * when the score hovers near the threshold.
 *   activate   at  score ≥ threshold
 *   deactivate at  score < threshold × HYSTERESIS
 */
export const HYSTERESIS = 0.85;

export class MotionDetector {
  cfg: MotionConfig;
  baseline: MotionBaseline | null;
  private lastMotion = false;

  constructor(cfg: MotionConfig = DEFAULT_MOTION_CFG, baseline: MotionBaseline | null = null) {
    this.cfg = { ...cfg };
    this.baseline = baseline;
  }

  update(cfg: Partial<MotionConfig>): void {
    this.cfg = { ...this.cfg, ...cfg };
  }

  setBaseline(b: MotionBaseline | null): void {
    this.baseline = b;
  }

  get active(): boolean {
    return this.lastMotion;
  }

  /** Hysteresis state machine over an externally computed score (testable). */
  evaluate(score: number): { motion: boolean; rose: boolean; fell: boolean } {
    const th = this.cfg.threshold;
    let motion = this.lastMotion;
    let rose = false;
    let fell = false;
    if (!motion && score >= th) {
      motion = true;
      rose = true;
    } else if (motion && score < th * HYSTERESIS) {
      motion = false;
      fell = true;
    }
    this.lastMotion = motion;
    return { motion, rose, fell };
  }

  /** Feed the latest buffer; returns result + edge flags. */
  feed(points: DetectorInput[]): MotionResult {
    const r = detectMotion(points, this.cfg, this.baseline);
    const { motion, rose, fell } = this.evaluate(r.score);
    return { ...r, motion, rose, fell };
  }

  reset(): void {
    this.lastMotion = false;
  }
}
