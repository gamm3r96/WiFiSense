/* ------------------------------------------------------------------ */
/* WiFiSense Lab — Respiration research module (Phase 15).             */
/*                                                                     */
/* EXPERIMENTAL — NOT A MEDICAL DEVICE. No diagnosis is provided.      */
/*                                                                     */
/* Pipeline:                                                           */
/*   CSI amplitude → motion gating → band-pass (0.08–0.6 Hz) →         */
/*   windowed FFT → dominant low-frequency component → breaths/min     */
/*                                                                     */
/* A quality score (peak prominence over the spectral floor) and a     */
/* motion-contamination metric decide whether the estimate is shown    */
/* at all — an unreliable estimate is reported as such, never faked.   */
/* ------------------------------------------------------------------ */

import type { TelemetryPoint } from "../types";

export interface RespirationResult {
  /** Null when the estimate is not reliable. */
  breathsPerMin: number | null;
  peakHz: number;
  /** Peak prominence over spectral floor (higher = cleaner). */
  quality: number;
  /** Mean motion score inside the analysis window (0..1). */
  motionContamination: number;
  reliable: boolean;
  reason: string;
  /** Band-passed trace for display. */
  traceT: number[];
  traceV: number[];
  spectrumHz: number[];
  spectrumMag: number[];
  samples: number;
}

const F_LOW = 0.08; // Hz — high-pass edge
const F_HIGH = 0.6; // Hz — low-pass edge
const SEARCH_LOW = 0.12; // Hz (~7 bpm)
const SEARCH_HIGH = 0.75; // Hz (~45 bpm)

function alphaFor(fc: number, fs: number): number {
  const w = 2 * Math.PI * fc;
  return w / (w + fs);
}

function highPass(v: number[], alpha: number): number[] {
  const out = new Array<number>(v.length);
  let prevY = 0;
  let prevX = v.length ? v[0] : 0;
  for (let i = 0; i < v.length; i++) {
    prevY = (1 - alpha) * (prevY + v[i] - prevX);
    prevX = v[i];
    out[i] = prevY;
  }
  return out;
}

function lowPass(v: number[], alpha: number): number[] {
  const out = new Array<number>(v.length);
  let prev = v.length ? v[0] : 0;
  for (let i = 0; i < v.length; i++) {
    prev = alpha * v[i] + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

/** In-place iterative radix-2 FFT on interleaved [re, im]. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export function estimateRespiration(buffer: TelemetryPoint[], fs: number): RespirationResult {
  const empty: RespirationResult = {
    breathsPerMin: null,
    peakHz: 0,
    quality: 0,
    motionContamination: 0,
    reliable: false,
    reason: "insufficient data",
    traceT: [],
    traceV: [],
    spectrumHz: [],
    spectrumMag: [],
    samples: buffer.length,
  };
  const minSamples = Math.ceil(fs * 20);
  if (buffer.length < minSamples) {
    empty.reason = `needs ≥${minSamples} samples (20 s at ${fs} Hz) — buffer has ${buffer.length}`;
    return empty;
  }

  const win = buffer.slice(-Math.min(buffer.length, Math.ceil(fs * 90)));
  const n = win.length;
  const amps = win.map((p) => p.amp);
  const motion = win.reduce((s, p) => s + p.score, 0) / n;

  // Normalize around the window mean, then band-pass.
  const mean = amps.reduce((s, v) => s + v, 0) / n;
  const norm = amps.map((v) => v - mean);
  const hp = highPass(norm, alphaFor(F_LOW, fs));
  const bp = lowPass(hp, alphaFor(F_HIGH, fs));

  // Zero-pad to the next power of two ≥ 1024 for finer frequency bins.
  let N = 1024;
  while (N < n) N <<= 1;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = bp[i] * hann;
  }
  fft(re, im);

  const half = N / 2;
  const mags = new Float64Array(half);
  for (let k = 0; k < half; k++) mags[k] = Math.hypot(re[k], im[k]);

  const binHz = fs / N;
  const kLo = Math.max(1, Math.floor(SEARCH_LOW / binHz));
  const kHi = Math.min(half - 1, Math.ceil(SEARCH_HIGH / binHz));
  let kPeak = kLo;
  for (let k = kLo; k <= kHi; k++) if (mags[k] > mags[kPeak]) kPeak = k;
  const peakHz = kPeak * binHz;

  // Quality: peak vs the spectral floor (median magnitude in band).
  const band = Array.from(mags.subarray(kLo, kHi + 1)).sort((a, b) => a - b);
  const floor = band[Math.floor(band.length / 2)] || 1e-9;
  const quality = mags[kPeak] / (floor + 1e-9);

  const spectrumHz: number[] = [];
  const spectrumMag: number[] = [];
  for (let k = kLo; k <= kHi; k++) {
    spectrumHz.push(+(k * binHz).toFixed(4));
    spectrumMag.push(+mags[k].toFixed(6));
  }

  const breaths = peakHz * 60;
  let reliable = true;
  let reason = "estimate available";
  if (motion > 0.3) {
    reliable = false;
    reason = `motion contamination too high (${(motion * 100).toFixed(0)}%) — hold still`;
  } else if (quality < 2.2) {
    reliable = false;
    reason = `spectral peak not prominent enough (quality ${quality.toFixed(1)})`;
  } else if (breaths < 6 || breaths > 42) {
    reliable = false;
    reason = `peak outside plausible range (${breaths.toFixed(1)} bpm)`;
  }

  return {
    breathsPerMin: reliable ? +breaths.toFixed(1) : null,
    peakHz,
    quality,
    motionContamination: motion,
    reliable,
    reason,
    traceT: win.map((p) => p.t),
    traceV: bp.map((v) => +v.toFixed(6)),
    spectrumHz,
    spectrumMag,
    samples: n,
  };
}
