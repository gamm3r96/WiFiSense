/* ------------------------------------------------------------------ */
/* WiFiSense Lab — signal processing primitives (Phase 3 foundation).   */
/* Phase 4 (Signal Analysis) builds its full pipeline on these: every   */
/* function is causal, pure and allocation-light so the same code can   */
/* later be mirrored in the Python processor for parity checks.         */
/* ------------------------------------------------------------------ */

export interface Pt {
  t: number;
  v: number;
}

/** Causal moving average over a trailing window of `w` samples. */
export function movingAverage(data: Pt[], w: number): Pt[] {
  const n = Math.max(1, Math.floor(w));
  const out: Pt[] = new Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].v;
    if (i >= n) sum -= data[i - n].v;
    const denom = Math.min(i + 1, n);
    out[i] = { t: data[i].t, v: sum / denom };
  }
  return out;
}

/** One-pole IIR low-pass: y[i] = α·x[i] + (1−α)·y[i−1]. α ∈ (0,1]. */
export function lowPass(data: Pt[], alpha = 0.2): Pt[] {
  const a = Math.min(1, Math.max(0.01, alpha));
  const out: Pt[] = new Array(data.length);
  let prev = data.length > 0 ? data[0].v : 0;
  for (let i = 0; i < data.length; i++) {
    prev = a * data[i].v + (1 - a) * prev;
    out[i] = { t: data[i].t, v: prev };
  }
  return out;
}

/** Combined denoise used by the Live CSI "filtered" view. */
export function denoise(data: Pt[]): Pt[] {
  return lowPass(movingAverage(data, 5), 0.3);
}

export function meanOf(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return s / values.length;
}

export function varianceOf(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  const m = meanOf(values);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - m;
    s += d * d;
  }
  return s / values.length;
}

/** Frames-per-second measured from recent timestamps. */
export function frameRate(times: ArrayLike<number>, windowS = 5): number {
  if (times.length < 2) return 0;
  const last = times[times.length - 1];
  let count = 0;
  for (let i = times.length - 1; i >= 0; i--) {
    if (last - times[i] > windowS) break;
    count++;
  }
  const span = Math.min(windowS, last - times[Math.max(0, times.length - count)]);
  return span > 0 ? (count - 1) / span : 0;
}
