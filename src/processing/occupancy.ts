/* ------------------------------------------------------------------ */
/* WiFiSense Lab — Presence / Occupancy Engine (Phase 6).              */
/*                                                                     */
/* Baseline-deviation occupancy model. The operator captures an        */
/* "empty room baseline" (per-subcarrier amplitude statistics of an    */
/* unoccupied room); live frames are then scored by how far they       */
/* deviate from that reference. A human body changes the multipath     */
/* sum — the spectrum shifts and its variance rises.                   */
/*                                                                     */
/* States: EMPTY · OCCUPIED · MOTION · STATIONARY · UNKNOWN            */
/*                                                                     */
/* Every output is an ALGORITHMIC ESTIMATE. Wi-Fi sensing cannot       */
/* guarantee physical ground truth; confidence values quantify how     */
/* strongly the signal evidence supports the state, not certainty.     */
/* Pure and deterministic — stepped by the store once per engine tick. */
/* ------------------------------------------------------------------ */

import { clamp01 } from "../utils/format";

export type OccupancyState = "EMPTY" | "OCCUPIED" | "MOTION" | "STATIONARY" | "UNKNOWN";

export const PRESENCE_STATES: OccupancyState[] = ["OCCUPIED", "MOTION", "STATIONARY"];

/** Per-sensor amplitude statistics captured from an empty room. */
export interface SensorBaselineStats {
  mean: number[];
  sd: number[];
  frames: number;
}

export interface RoomBaseline {
  roomId: string;
  roomName: string;
  /** Wall-clock capture time. */
  capturedAt: number;
  /** Engine sim-time at capture. */
  simTime: number;
  sensors: Record<string, SensorBaselineStats>;
  rssiMean: number;
  rssiSd: number;
  /** Mean motion score at capture — high values warn of a biased baseline. */
  motionFloor: number;
}

export const OCC_THRESHOLDS = {
  /** Blended deviation above which presence is inferred. */
  occupied: 0.16,
  /** Blended deviation below which the room is declared empty. */
  empty: 0.08,
  /** Motion score above which presence is labeled MOTION vs STATIONARY. */
  motion: 0.4,
  /** Ticks a candidate state must persist before switching (100 ms ticks). */
  occupyConfirm: 3,
  emptyConfirm: 25,
  stationaryConfirm: 12,
} as const;

export interface OccupancyAssessment {
  state: OccupancyState;
  /** Blended deviation 0..1 (spectral + RSSI evidence). */
  deviation: number;
  /** Robust spectral z-deviation 0..1. */
  spectral: number;
  /** Highest motion score across the room's sensors. */
  motionScore: number;
  /** Algorithmic estimate, 0..100. NOT guaranteed physical truth. */
  confidence: number;
  reason: string;
  ticksInState: number;
  /** Candidate state accumulating confirmation ticks. */
  pending: OccupancyState | null;
  pendingTicks: number;
  /** Baseline available for this assessment. */
  hasBaseline: boolean;
  /** Deviation history for the live chart (newest last). */
  history: { t: number; v: number }[];
}

export function emptyAssessment(): OccupancyAssessment {
  return {
    state: "UNKNOWN",
    deviation: 0,
    spectral: 0,
    motionScore: 0,
    confidence: 0,
    reason: "awaiting first assessment",
    ticksInState: 0,
    pending: null,
    pendingTicks: 0,
    hasBaseline: false,
    history: [],
  };
}

/** Robust per-subcarrier deviation of a live frame against a baseline. */
export function spectralDeviation(spectrum: ArrayLike<number>, stats: SensorBaselineStats): number {
  const n = Math.min(spectrum.length, stats.mean.length, stats.sd.length);
  if (n === 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const z = Math.abs(spectrum[i] - stats.mean[i]) / (stats.sd[i] + 0.02);
    acc += Math.min(z, 8) / 8;
  }
  return clamp01(acc / n);
}

/** Per-sensor mean/sd statistics used by "Capture Empty Room Baseline". */
export function computeSensorStats(frames: Float64Array[], subcarriers: number): SensorBaselineStats {
  const n = frames.length;
  const mean = new Array<number>(subcarriers).fill(0);
  const sd = new Array<number>(subcarriers).fill(0);
  if (n === 0) return { mean, sd, frames: 0 };
  for (const f of frames) {
    for (let i = 0; i < subcarriers; i++) mean[i] += f[i] ?? 0;
  }
  for (let i = 0; i < subcarriers; i++) mean[i] /= n;
  for (const f of frames) {
    for (let i = 0; i < subcarriers; i++) {
      const d = (f[i] ?? 0) - mean[i];
      sd[i] += d * d;
    }
  }
  for (let i = 0; i < subcarriers; i++) sd[i] = Math.sqrt(sd[i] / n);
  return { mean, sd, frames: n };
}

export interface StepInput {
  t: number; // sim time
  sensorsOnline: boolean;
  hasBaseline: boolean;
  /** Pre-computed spectral deviation (mean over sensors with baselines). */
  spectral: number;
  /** RSSI deviation evidence 0..1. */
  rssiScore: number;
  motionScore: number;
  motionThresh: number;
  /** Baseline frame count (quality factor). */
  baselineFrames: number;
  /** Fraction of online sensors that have a baseline, 0..1. */
  coverage: number;
}

/** One deterministic state-machine step. Hysteresis via pending counters. */
export function stepOccupancy(prev: OccupancyAssessment | null, input: StepInput): OccupancyAssessment {
  const a = prev ? { ...prev, history: prev.history } : emptyAssessment();
  a.hasBaseline = input.hasBaseline;
  a.spectral = input.spectral;
  a.motionScore = input.motionScore;
  a.deviation = clamp01(0.82 * input.spectral + 0.18 * input.rssiScore);

  const push = (v: number) => {
    a.history.push({ t: input.t, v });
    if (a.history.length > 300) a.history.shift();
  };

  /* ---------- gate conditions ---------- */
  if (!input.sensorsOnline) {
    a.state = "UNKNOWN";
    a.reason = "no online sensors in room";
    a.confidence = 0;
    a.pending = null;
    a.pendingTicks = 0;
    a.ticksInState++;
    push(a.deviation);
    return a;
  }
  if (!input.hasBaseline) {
    a.state = "UNKNOWN";
    a.reason = "no empty-room baseline captured";
    a.confidence = 0;
    a.pending = null;
    a.pendingTicks = 0;
    a.ticksInState++;
    push(a.deviation);
    return a;
  }

  /* ---------- target state ---------- */
  const th = OCC_THRESHOLDS;
  const moving = input.motionScore >= input.motionThresh;
  let target: OccupancyState;
  if (a.deviation >= th.occupied) {
    target = moving ? "MOTION" : "OCCUPIED";
  } else if (a.deviation <= th.empty) {
    target = "EMPTY";
  } else {
    target = a.state === "UNKNOWN" ? "UNKNOWN" : a.state; // hysteresis band — hold
  }

  /* ---------- confirm with persistence ---------- */
  if (target === a.state) {
    a.pending = null;
    a.pendingTicks = 0;
    a.ticksInState++;
  } else {
    if (a.pending === target) a.pendingTicks++;
    else {
      a.pending = target;
      a.pendingTicks = 1;
    }
    const need =
      target === "EMPTY" ? th.emptyConfirm : target === "STATIONARY" ? th.stationaryConfirm : th.occupyConfirm;
    if (a.pendingTicks >= need) {
      a.state = target;
      a.pending = null;
      a.pendingTicks = 0;
      a.ticksInState = 0;
    } else {
      a.ticksInState++;
    }
  }

  /* STATIONARY refines OCCUPIED once stillness persists (reuses ticksInState
     so it is not clobbered by the main confirmation block). */
  if (a.state === "OCCUPIED" && !moving && a.deviation >= th.occupied && a.ticksInState >= th.stationaryConfirm) {
    a.state = "STATIONARY";
    a.pending = null;
    a.pendingTicks = 0;
    a.ticksInState = 0;
  }

  /* ---------- confidence (algorithmic estimate) ---------- */
  const quality = clamp01(Math.min(1, input.baselineFrames / 80)) * input.coverage;
  let evidence: number;
  if (a.state === "EMPTY") evidence = clamp01((th.empty - a.deviation) / th.empty + 0.3);
  else if (PRESENCE_STATES.includes(a.state)) evidence = clamp01(a.deviation / 0.4);
  else evidence = 0;
  a.confidence = Math.round(clamp01(quality * (0.45 + 0.55 * evidence)) * 96);

  /* ---------- reason ---------- */
  if (a.state === "EMPTY") a.reason = "deviation within empty-room envelope";
  else if (a.state === "MOTION") a.reason = "spectral shift + high motion score";
  else if (a.state === "STATIONARY") a.reason = "spectral shift, motion settled";
  else if (a.state === "OCCUPIED") a.reason = "spectral deviation above baseline";
  else a.reason = "deviation inside hysteresis band";

  push(a.deviation);
  return a;
}

export function isPresence(s: OccupancyState): boolean {
  return PRESENCE_STATES.includes(s);
}
