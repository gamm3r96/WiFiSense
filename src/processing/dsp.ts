/* ------------------------------------------------------------------ */
/* WiFiSense Lab — DSP primitives (Phase 4 · Signal Analysis)          */
/*                                                                     */
/* Pure, deterministic functions. Every routine operates on a plain    */
/* numeric array so it can be unit-tested and later mirrored 1:1 by    */
/* the Python CSI processor (parity between local & remote backends).  */
/* ------------------------------------------------------------------ */

export interface SampledSeries {
  /** Timestamps (s). */
  t: number[];
  /** Values. */
  v: number[];
}

export interface FilterConfig {
  kind: "movingAverage" | "median" | "lowPass" | "highPass" | "bandPass" | "none";
  /** Window length for movingAverage / median (samples). */
  window?: number;
  /** α for lowPass / highPass (0..1). */
  alpha?: number;
  /** α1 (high-pass) and α2 (low-pass) for bandPass. */
  alphaHigh?: number;
  alphaLow?: number;
}

/* ------------------------------ filters --------------------------- */

export function movingAverage(v: number[], window: number): number[] {
  const w = Math.max(1, Math.floor(window));
  const out = new Array<number>(v.length);
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i];
    if (i >= w) sum -= v[i - w];
    out[i] = sum / Math.min(i + 1, w);
  }
  return out;
}

export function medianFilter(v: number[], window: number): number[] {
  const w = Math.max(1, Math.floor(window));
  const out = new Array<number>(v.length);
  const buf: number[] = [];
  for (let i = 0; i < v.length; i++) {
    buf.push(v[i]);
    if (buf.length > w) buf.shift();
    const sorted = [...buf].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    out[i] = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return out;
}

export function lowPass(v: number[], alpha: number): number[] {
  const a = Math.min(1, Math.max(0.01, alpha));
  const out = new Array<number>(v.length);
  let prev = v.length ? v[0] : 0;
  for (let i = 0; i < v.length; i++) {
    prev = a * v[i] + (1 - a) * prev;
    out[i] = prev;
  }
  return out;
}

export function highPass(v: number[], alpha: number): number[] {
  // y[i] = (1−α)·(y[i−1] + x[i] − x[i−1])  — removes DC / slow drift.
  const a = Math.min(1, Math.max(0.01, alpha));
  const out = new Array<number>(v.length);
  let prevY = 0;
  let prevX = v.length ? v[0] : 0;
  for (let i = 0; i < v.length; i++) {
    prevY = (1 - a) * (prevY + v[i] - prevX);
    out[i] = prevY;
    prevX = v[i];
  }
  return out;
}

export function bandPass(v: number[], alphaHigh: number, alphaLow: number): number[] {
  return lowPass(highPass(v, alphaHigh), alphaLow);
}

export function applyFilter(v: number[], cfg: FilterConfig): number[] {
  switch (cfg.kind) {
    case "movingAverage":
      return movingAverage(v, cfg.window ?? 5);
    case "median":
      return medianFilter(v, cfg.window ?? 5);
    case "lowPass":
      return lowPass(v, cfg.alpha ?? 0.2);
    case "highPass":
      return highPass(v, cfg.alpha ?? 0.2);
    case "bandPass":
      return bandPass(v, cfg.alphaHigh ?? 0.4, cfg.alphaLow ?? 0.1);
    case "none":
      return v.slice();
  }
}

/* ------------------------------ stats ----------------------------- */

export function mean(v: number[]): number {
  if (!v.length) return 0;
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

export function variance(v: number[]): number {
  if (!v.length) return 0;
  const m = mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
  return s / v.length;
}

export function stdDev(v: number[]): number {
  return Math.sqrt(variance(v));
}

export function energy(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return s;
}

export function peakToPeak(v: number[]): number {
  if (!v.length) return 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < v.length; i++) {
    if (v[i] < lo) lo = v[i];
    if (v[i] > hi) hi = v[i];
  }
  return hi - lo;
}

/* ------------------------------- FFT ------------------------------ */

/** In-place iterative radix-2 FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
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

export interface SpectrumPoint {
  /** Frequency in Hz. */
  f: number;
  /** Magnitude. */
  mag: number;
}

/** One-sided amplitude spectrum. Zero-pads to the next power of two. */
export function spectrum(v: number[], sampleRateHz: number): SpectrumPoint[] {
  if (v.length < 2 || sampleRateHz <= 0) return [];
  let n = 1;
  while (n < v.length) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < v.length; i++) re[i] = v[i];
  fft(re, im);
  const out: SpectrumPoint[] = [];
  const half = n >> 1;
  for (let k = 0; k <= half; k++) {
    out.push({
      f: (k * sampleRateHz) / n,
      mag: Math.hypot(re[k], im[k]) / v.length,
    });
  }
  return out;
}

/** Dominant frequency (Hz) excluding the DC bin, or 0 if flat. */
export function peakFrequency(spec: SpectrumPoint[]): number {
  let best = 0;
  let bestMag = -1;
  for (let i = 1; i < spec.length; i++) {
    if (spec[i].mag > bestMag) {
      bestMag = spec[i].mag;
      best = spec[i].f;
    }
  }
  return bestMag <= 0 ? 0 : best;
}

/* --------------------------- phase helpers ------------------------ */

/** Unwrap a phase series (radians), removing ±2π jumps. */
export function unwrapPhase(phase: number[]): number[] {
  const out = new Array<number>(phase.length);
  let offset = 0;
  for (let i = 0; i < phase.length; i++) {
    if (i > 0) {
      let d = phase[i] - phase[i - 1];
      while (d > Math.PI) {
        d -= 2 * Math.PI;
        offset -= 2 * Math.PI;
      }
      while (d < -Math.PI) {
        d += 2 * Math.PI;
        offset += 2 * Math.PI;
      }
    }
    out[i] = phase[i] + offset;
  }
  return out;
}

/** Min–max normalisation to [0,1]. Flat input maps to 0.5. */
export function normalize(v: number[]): number[] {
  if (!v.length) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < v.length; i++) {
    if (v[i] < lo) lo = v[i];
    if (v[i] > hi) hi = v[i];
  }
  const span = hi - lo;
  if (span < 1e-12) return v.map(() => 0.5);
  return v.map((x) => (x - lo) / span);
}
