import { useEffect, useMemo, useRef, useState } from "react";
import FFTChart from "../charts/FFTChart";
import LineChart from "../charts/LineChart";
import { Chip, Dot, Icon, Toggle, type Tone } from "../components/ui";
import { TICK_S } from "../simulation/engine";
import {
  activeProcessor,
  pythonProcessor,
  type PipelineConfig,
  type ProcessedSignal,
} from "../services/processor";
import type { FilterConfig } from "../processing/dsp";
import { sim, useSim } from "../state/store";

type Channel = "amplitude" | "phase";

const CHANNELS: { v: Channel; l: string }[] = [
  { v: "amplitude", l: "AMPLITUDE" },
  { v: "phase", l: "PHASE" },
];

const FILTERS: { v: FilterConfig["kind"]; l: string }[] = [
  { v: "none", l: "None" },
  { v: "movingAverage", l: "Moving Avg" },
  { v: "median", l: "Median" },
  { v: "lowPass", l: "Low-pass" },
  { v: "highPass", l: "High-pass" },
  { v: "bandPass", l: "Band-pass" },
];

const WINDOWS = [10, 20, 30, 60];

function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="lbl w-16 shrink-0">{label}</span>
      <div className="flex flex-wrap overflow-hidden rounded border border-line2">
        {options.map((o, i) => (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            className={`mono px-2.5 py-[5px] text-[10.5px] tracking-wider transition-colors ${
              value === o.v ? "bg-acc/15 text-acc" : "bg-raise text-dim hover:text-txt"
            } ${i > 0 ? "border-l border-line2" : ""}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-txt">{label}</span>
        <span className="mono text-[11.5px] text-acc">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

function Stat({ label, value, unit, tone = "txt" }: { label: string; value: string; unit?: string; tone?: "txt" | "acc" | "amber" | "cyan" }) {
  const color = tone === "acc" ? "text-acc" : tone === "amber" ? "text-amber" : tone === "cyan" ? "text-cyan" : "text-txt";
  return (
    <div className="rounded border border-line bg-raise/50 px-3 py-2">
      <div className="lbl">{label}</div>
      <div className={`mono mt-0.5 text-[15px] font-semibold leading-tight ${color}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-faint">{unit}</span>}
      </div>
    </div>
  );
}

export default function SignalAnalysisPage() {
  const world = useSim();
  const [sensorId, setSensorId] = useState(() => sim.world.sensors[0]?.id ?? "");
  const [channel, setChannel] = useState<Channel>("amplitude");
  const [windowSec, setWindowSec] = useState(20);
  const [filterKind, setFilterKind] = useState<FilterConfig["kind"]>("movingAverage");
  const [win, setWin] = useState(5);
  const [alpha, setAlpha] = useState(0.2);
  const [alphaHigh, setAlphaHigh] = useState(0.4);
  const [alphaLow, setAlphaLow] = useState(0.1);
  const [unwrap, setUnwrap] = useState(true);
  const [norm, setNorm] = useState(false);
  const [result, setResult] = useState<ProcessedSignal | null>(null);
  const [pyUrl, setPyUrl] = useState(pythonProcessor.baseUrl);
  const [pyBusy, setPyBusy] = useState(false);

  const sensor = world.sensors.find((s) => s.id === sensorId);
  useEffect(() => {
    if (!sim.world.sensors.some((s) => s.id === sensorId)) setSensorId(sim.world.sensors[0]?.id ?? "");
  }, [world.sensors.length, sensorId]);

  const isSim = sim.mode === "simulation";
  const srcLabel = isSim ? `SIMULATED CSI · SEED ${sim.cfg.seed}` : "NO SOURCE · LIVE MODE";
  const sampleRateHz = 1 / TICK_S; // telemetry buffer cadence

  const cfg: PipelineConfig = useMemo(
    () => ({
      channel,
      filter: { kind: filterKind, window: win, alpha, alphaHigh, alphaLow },
      unwrap,
      normalizeOut: norm,
      sampleRateHz,
    }),
    [channel, filterKind, win, alpha, alphaHigh, alphaLow, unwrap, norm, sampleRateHz],
  );

  /* --------------------- run the pipeline ------------------------- */
  const busyRef = useRef(false);
  useEffect(() => {
    let stale = false;
    const run = async () => {
      if (busyRef.current) return;
      const s = sim.world.sensors.find((x) => x.id === sensorId);
      if (!s || !s.online || s.buffer.length < 4) {
        if (!stale) setResult(null);
        return;
      }
      const tEnd = s.buffer[s.buffer.length - 1].t;
      const t0 = tEnd - windowSec;
      const t: number[] = [];
      const v: number[] = [];
      for (const p of s.buffer) {
        if (p.t >= t0) {
          t.push(p.t - t0);
          v.push(channel === "phase" ? p.phase : p.amp);
        }
      }
      busyRef.current = true;
      try {
        const proc = activeProcessor();
        const res = await proc.process({ t, v }, cfg);
        if (!stale) setResult(res);
      } catch {
        if (!stale) setResult(null);
      } finally {
        busyRef.current = false;
      }
    };
    void run();
    return () => {
      stale = true;
    };
    // world.tickIndex drives live re-analysis; cfg changes re-run too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.tickIndex, sensorId, windowSec, cfg]);

  const seriesRef = useRef<{ t: number[]; v: number[] }>({ t: [], v: [] });
  if (result) seriesRef.current = { t: result.raw.t, v: result.raw.v };
  const filteredRef = useRef<{ t: number[]; v: number[] }>({ t: [], v: [] });
  if (result) filteredRef.current = { t: result.filtered.t, v: result.filtered.v };
  const specRef = useRef(result?.spectrum ?? []);
  if (result) specRef.current = result.spectrum;

  const idleText = !isSim
    ? "NO LIVE CSI SOURCE CONNECTED"
    : !sensor?.enabled
      ? "NODE DISABLED — TELEMETRY WITHHELD"
      : !sensor?.online
        ? "NODE OFFLINE — NO FRAMES"
        : "PROCESSING…";

  const py = pythonProcessor;
  const backend = activeProcessor();
  const usingPython = backend.id === "python";

  const connectPy = async () => {
    setPyBusy(true);
    const ok = await py.connect(pyUrl);
    sim.logPublic(
      ok ? "INFO" : "WARNING",
      "processor",
      ok ? `Python processor connected at ${py.baseUrl}` : `Python processor unreachable at ${pyUrl} — staying on LocalProcessor`,
    );
    setPyBusy(false);
    // Force a re-render to reflect the new backend state.
    setResult((r) => (r ? { ...r } : r));
  };

  const pyTone: Tone = py.state === "online" ? "acc" : py.state === "connecting" ? "blue" : "dim";

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Signal Analysis</h1>
          <p className="text-[12px] text-dim">
            CSI processing pipeline — validation, extraction, unwrapping, filtering, normalisation and spectral features.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={usingPython ? "cyan" : "acc"}>
            <Dot tone={usingPython ? "cyan" : "acc"} size={6} pulse={isSim} />
            {usingPython ? "Python Processor" : "LocalProcessor"}
          </Chip>
          <Chip tone={isSim ? "amber" : "red"}>{isSim ? "Simulation Data" : "No Source"}</Chip>
        </div>
      </header>

      {/* ---------------------- pipeline flow ----------------------- */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Processing Pipeline</span>
          <span className="mono ml-auto text-[10px] text-faint">{result ? `${result.stages.length} STAGES` : "IDLE"}</span>
        </div>
        <div className="flex items-stretch gap-1.5 overflow-x-auto px-4 py-3">
          {(result?.stages ?? []).map((st, i) => (
            <div key={st.id} className="flex items-center gap-1.5">
              <div
                className={`min-w-[130px] rounded border px-2.5 py-2 transition-colors ${
                  st.active ? "stage-active border-acc/50 bg-acc/5" : "border-line bg-panel"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Dot tone={st.active ? "acc" : "dim"} size={5} />
                  <span className={`mono text-[9px] font-semibold tracking-wider ${st.active ? "text-acc" : "text-faint"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] font-medium leading-tight text-txt">{st.label}</div>
                <div className="mono mt-0.5 truncate text-[9.5px] text-faint">{st.detail}</div>
              </div>
              {i < (result?.stages.length ?? 1) - 1 && (
                <svg width="18" height="12" viewBox="0 0 18 12" className="shrink-0 text-line2">
                  <line x1="0" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" className="dash-flow" />
                  <path d="M13 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
          {!result && <div className="mono self-center px-2 py-4 text-[11px] text-faint">AWAITING TELEMETRY…</div>}
        </div>
      </section>

      {/* ------------------------ controls -------------------------- */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Controls</span>
        </div>
        <div className="grid gap-x-8 gap-y-3 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="lbl w-16 shrink-0">Sensor</span>
              <select className="select flex-1" value={sensorId} onChange={(e) => setSensorId(e.target.value)}>
                {world.sensors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.roomName} {s.online ? "" : "(offline)"}
                  </option>
                ))}
              </select>
            </div>
            <Select label="Channel" value={channel} options={CHANNELS} onChange={setChannel} />
            <Select label="Window" value={windowSec} options={WINDOWS.map((w) => ({ v: w, l: `${w}s` }))} onChange={setWindowSec} />
            <Select label="Filter" value={filterKind} options={FILTERS.map((f) => ({ v: f.v, l: f.l }))} onChange={setFilterKind} />
          </div>

          <div className="space-y-3">
            {(filterKind === "movingAverage" || filterKind === "median") && (
              <Slider label={filterKind === "median" ? "Median window" : "Averaging window"} value={win} min={3} max={21} step={2} fmt={(v) => `${v} samples`} onChange={setWin} />
            )}
            {(filterKind === "lowPass" || filterKind === "highPass") && (
              <Slider label="Cutoff α" value={alpha} min={0.02} max={1} step={0.02} fmt={(v) => v.toFixed(2)} onChange={setAlpha} />
            )}
            {filterKind === "bandPass" && (
              <>
                <Slider label="High-pass α" value={alphaHigh} min={0.02} max={1} step={0.02} fmt={(v) => v.toFixed(2)} onChange={setAlphaHigh} />
                <Slider label="Low-pass α" value={alphaLow} min={0.02} max={1} step={0.02} fmt={(v) => v.toFixed(2)} onChange={setAlphaLow} />
              </>
            )}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <div className="text-[12.5px] font-medium text-txt">Phase unwrapping</div>
                <div className="text-[10px] text-faint">Remove ±2π jumps (phase channel)</div>
              </div>
              <Toggle checked={unwrap} onChange={setUnwrap} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12.5px] font-medium text-txt">Normalise output</div>
                <div className="text-[10px] text-faint">Min–max scale filtered signal to [0,1]</div>
              </div>
              <Toggle checked={norm} onChange={setNorm} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-3">
        {/* ------------------- raw vs filtered ---------------------- */}
        <section className="panel col-span-12 xl:col-span-7">
          <div className="panel-head">
            <span className="panel-title">{channel === "phase" ? "Phase" : "Amplitude"} — Raw vs Filtered</span>
            <span className="mono ml-auto text-[10px] text-faint">WINDOW {windowSec}s · {sampleRateHz.toFixed(0)} Hz</span>
          </div>
          <LineChart
            windowSec={windowSec}
            height={250}
            unit={channel === "phase" ? "rad" : norm ? "norm" : "amp"}
            sourceLabel={srcLabel}
            idleText={idleText}
            series={[
              { label: "raw", color: "#8fa1b6", width: 1.1, data: () => seriesRef.current.t.map((t, i) => ({ t, v: seriesRef.current.v[i] })) },
              { label: "filtered", color: "#3ce6a4", fill: true, data: () => filteredRef.current.t.map((t, i) => ({ t, v: filteredRef.current.v[i] })) },
            ]}
          />
        </section>

        {/* ------------------------ FFT ----------------------------- */}
        <section className="panel col-span-12 xl:col-span-5">
          <div className="panel-head">
            <span className="panel-title">FFT Spectrum</span>
            <span className="mono ml-auto text-[10px] text-faint">0–{(sampleRateHz / 2).toFixed(1)} Hz</span>
          </div>
          <FFTChart height={250} sourceLabel={srcLabel} data={() => specRef.current} peakHz={result?.features.peakFreqHz} />
        </section>

        {/* ---------------------- statistics ------------------------ */}
        <section className="panel col-span-12 xl:col-span-7">
          <div className="panel-head">
            <span className="panel-title">Signal Statistics</span>
            <span className="mono ml-auto text-[10px] text-faint">
              {result ? `${result.features.samples} SAMPLES · ${result.features.durationS.toFixed(1)}s` : "—"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Mean" value={result ? result.features.mean.toFixed(4) : "—"} tone="txt" />
            <Stat label="Std Dev" value={result ? result.features.stdDev.toFixed(4) : "—"} tone="cyan" />
            <Stat label="Variance" value={result ? result.features.variance.toExponential(2) : "—"} tone="cyan" />
            <Stat label="Energy" value={result ? result.features.energy.toFixed(1) : "—"} tone="txt" />
            <Stat label="Peak–Peak" value={result ? result.features.peakToPeak.toFixed(4) : "—"} tone="txt" />
            <Stat label="Peak Freq" value={result ? result.features.peakFreqHz.toFixed(2) : "—"} unit="Hz" tone="amber" />
            <Stat label="Samples" value={result ? String(result.features.samples) : "—"} tone="txt" />
            <Stat label="Duration" value={result ? result.features.durationS.toFixed(1) : "—"} unit="s" tone="txt" />
          </div>
        </section>

        {/* ------------------- python processor --------------------- */}
        <section className="panel col-span-12 xl:col-span-5">
          <div className="panel-head">
            <span className="panel-title">External Python Processor</span>
            <Chip tone={pyTone}>{py.state === "online" ? "Online" : py.state === "connecting" ? "Connecting" : "Unavailable"}</Chip>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-[11.5px] leading-relaxed text-dim">
              Heavy processing (advanced filters, ML features) can be delegated to the FastAPI service in{" "}
              <span className="mono text-cyan">python-service/</span> via <span className="mono text-cyan">POST /process</span>.
              The service is <span className="text-amber">not running in this preview</span> — the LocalProcessor handles all
              computation in-browser until you connect it.
            </p>
            <div className="flex gap-1.5">
              <input type="text" className="flex-1" value={pyUrl} onChange={(e) => setPyUrl(e.target.value)} aria-label="Python service URL" />
              <button className="btn !py-1.5" onClick={connectPy} disabled={pyBusy}>
                <Icon name="plug" size={13} /> {pyBusy ? "Probing…" : "Connect"}
              </button>
            </div>
            <div className="flex items-center justify-between rounded border border-line bg-raise/50 px-3 py-2">
              <span className="lbl">Active backend</span>
              <span className="mono text-[11.5px] text-acc">{backend.label}</span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-faint">
              <Icon name="alert" size={12} className="shrink-0 text-amber" />
              Local results are shown whenever the Python service is offline — nothing is fabricated as remote output.
            </div>
          </div>
        </section>
      </div>

      <p className="mono text-[10.5px] text-faint">
        PROVENANCE: {isSim ? "analysis runs on simulated telemetry from the deterministic engine" : "live mode — no adapter attached, no data analysed"}.
      </p>
    </div>
  );
}
