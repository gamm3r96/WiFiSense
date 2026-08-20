/* ------------------------------------------------------------------ */
/* WiFiSense Lab — signal processing service (Phase 4).                */
/*                                                                     */
/* A clean backend-agnostic interface. Two implementations ship:       */
/*                                                                     */
/*   LocalProcessor   — runs the DSP pipeline in-browser (default).    */
/*   PythonProcessor  — delegates to the external FastAPI service      */
/*                      (python-service/app.py · POST /process).       */
/*                                                                     */
/* The Python processor is NOT assumed to be running in this runtime:  */
/* its connection state is surfaced honestly and the UI falls back to  */
/* the LocalProcessor rather than pretending remote work happened.     */
/* ------------------------------------------------------------------ */

import {
  applyFilter,
  energy,
  mean,
  medianFilter,
  movingAverage,
  normalize,
  peakFrequency,
  peakToPeak,
  spectrum,
  stdDev,
  unwrapPhase,
  variance,
  type FilterConfig,
  type SampledSeries,
  type SpectrumPoint,
} from "../processing/dsp";

export interface PipelineConfig {
  /** Which channel is being analysed. */
  channel: "amplitude" | "phase";
  filter: FilterConfig;
  unwrap: boolean;
  normalizeOut: boolean;
  sampleRateHz: number;
}

export interface StageResult {
  id: string;
  label: string;
  /** Samples after this stage (for validation). */
  n: number;
  active: boolean;
  detail: string;
}

export interface SignalFeatures {
  mean: number;
  stdDev: number;
  variance: number;
  energy: number;
  peakToPeak: number;
  peakFreqHz: number;
  samples: number;
  durationS: number;
}

export interface ProcessedSignal {
  raw: SampledSeries;
  filtered: SampledSeries;
  spectrum: SpectrumPoint[];
  features: SignalFeatures;
  stages: StageResult[];
  /** Which backend produced this result. */
  backend: "local" | "python";
}

export interface ProcessorBackend {
  readonly id: "local" | "python";
  readonly label: string;
  readonly available: boolean;
  process(series: SampledSeries, cfg: PipelineConfig): Promise<ProcessedSignal>;
}

/* --------------------------- local backend ------------------------ */

export class LocalProcessor implements ProcessorBackend {
  readonly id = "local" as const;
  readonly label = "LocalProcessor (in-browser)";
  readonly available = true;

  async process(series: SampledSeries, cfg: PipelineConfig): Promise<ProcessedSignal> {
    const stages: StageResult[] = [];
    const push = (id: string, label: string, n: number, active: boolean, detail: string) =>
      stages.push({ id, label, n, active, detail });

    // 1 — Validation: drop non-finite samples, keep series aligned.
    const t: number[] = [];
    const v: number[] = [];
    let dropped = 0;
    for (let i = 0; i < series.v.length; i++) {
      if (Number.isFinite(series.v[i]) && Number.isFinite(series.t[i])) {
        t.push(series.t[i]);
        v.push(series.v[i]);
      } else dropped++;
    }
    push("validate", "Validation", v.length, true, dropped ? `${dropped} sample(s) dropped` : "all samples valid");

    // 2 — Channel extraction is done upstream (caller picks amp vs phase).
    push("extract", cfg.channel === "phase" ? "Phase extraction" : "Amplitude extraction", v.length, true, cfg.channel);

    // 3 — Phase unwrapping (phase channel only).
    let work = v;
    if (cfg.channel === "phase" && cfg.unwrap) {
      work = unwrapPhase(work);
      push("unwrap", "Phase unwrapping", work.length, true, "±2π jumps removed");
    } else {
      push("unwrap", "Phase unwrapping", work.length, false, cfg.channel === "phase" ? "disabled" : "n/a (amplitude)");
    }

    // 4 — Noise reduction + 5 — filtering.
    const f = cfg.filter;
    let detail = "no filter";
    if (f.kind === "movingAverage") detail = `moving average · w=${f.window ?? 5}`;
    else if (f.kind === "median") detail = `median · w=${f.window ?? 5}`;
    else if (f.kind === "lowPass") detail = `low-pass · α=${f.alpha ?? 0.2}`;
    else if (f.kind === "highPass") detail = `high-pass · α=${f.alpha ?? 0.2}`;
    else if (f.kind === "bandPass") detail = `band-pass · αh=${f.alphaHigh ?? 0.4} αl=${f.alphaLow ?? 0.1}`;
    work = applyFilter(work, f);
    push("filter", "Noise reduction + filtering", work.length, f.kind !== "none", detail);

    // 6 — Normalisation.
    if (cfg.normalizeOut) {
      work = normalize(work);
      push("normalize", "Normalisation", work.length, true, "min–max → [0,1]");
    } else {
      push("normalize", "Normalisation", work.length, false, "passthrough");
    }

    // 7 — Feature extraction + spectrum.
    const spec = spectrum(work, cfg.sampleRateHz);
    const duration = t.length ? t[t.length - 1] - t[0] : 0;
    const features: SignalFeatures = {
      mean: mean(work),
      stdDev: stdDev(work),
      variance: variance(work),
      energy: energy(work),
      peakToPeak: peakToPeak(work),
      peakFreqHz: peakFrequency(spec),
      samples: work.length,
      durationS: duration,
    };
    push("features", "Feature extraction", work.length, true, `peak ${features.peakFreqHz.toFixed(2)} Hz`);

    return {
      raw: { t, v },
      filtered: { t, v: work },
      spectrum: spec,
      features,
      stages,
      backend: "local",
    };
  }
}

/* --------------------------- python backend ----------------------- */

export type PythonState = "offline" | "connecting" | "online";

/**
 * Delegates to the external FastAPI service. The exact wire format matches
 * `python-service/app.py · POST /process`; until that service is reachable
 * the backend reports `available = false` and the UI must not use it.
 */
export class PythonProcessor implements ProcessorBackend {
  readonly id = "python" as const;
  readonly label = "Python CSI Processor (FastAPI)";
  state: PythonState = "offline";
  baseUrl = "http://localhost:8000";

  get available(): boolean {
    return this.state === "online";
  }

  async connect(baseUrl: string): Promise<boolean> {
    this.state = "connecting";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.state = "online";
        return true;
      }
    } catch {
      /* unreachable — treated as offline */
    }
    this.state = "offline";
    return false;
  }

  disconnect(): void {
    this.state = "offline";
  }

  async process(series: SampledSeries, cfg: PipelineConfig): Promise<ProcessedSignal> {
    if (!this.available) {
      throw new Error("Python processor unavailable — connect it first (Settings → Python service).");
    }
    const res = await fetch(`${this.baseUrl}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samples: series, config: cfg }),
    });
    if (!res.ok) throw new Error(`Python processor returned HTTP ${res.status}`);
    return (await res.json()) as ProcessedSignal;
  }
}

export const localProcessor = new LocalProcessor();
export const pythonProcessor = new PythonProcessor();

/** Resolve the backend the UI should use: Python if online, else local. */
export function activeProcessor(): ProcessorBackend {
  return pythonProcessor.available ? pythonProcessor : localProcessor;
}

/* Re-export helpers used by the analysis page / tests. */
export { medianFilter, movingAverage };
