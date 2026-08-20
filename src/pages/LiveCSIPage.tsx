import { useEffect, useMemo, useRef, useState } from "react";
import LineChart from "../charts/LineChart";
import SpectrumChart from "../charts/SpectrumChart";
import WaterfallChart from "../charts/WaterfallChart";
import { Chip, Dot, Icon, Sparkline, type Tone } from "../components/ui";
import { simulationStream } from "../services/streamAdapter";
import { sim, useSim } from "../state/store";
import type { SensorSim, TelemetryPoint } from "../types";
import { buildMeta, downloadText, toCSV, toJSON } from "../utils/exporter";
import { denoise, frameRate, movingAverage, type Pt } from "../utils/signal";

type Metric = "amp" | "phase";
type Proc = "raw" | "filtered";
type SubSel = "mean" | number;

const WINDOWS = [10, 30, 60, 90];

function Seg<T extends string>({
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
      <span className="lbl">{label}</span>
      <div className="flex overflow-hidden rounded border border-line2">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`mono px-2.5 py-[5px] text-[10.5px] tracking-wider transition-colors ${
              value === o.v ? "bg-acc/15 text-acc" : "bg-raise text-dim hover:text-txt"
            } ${o.v !== options[0].v ? "border-l border-line2" : ""}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  data,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  data: number[];
  color: string;
}) {
  return (
    <div className="bg-panel px-3.5 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="lbl">{label}</span>
        <span className="mono text-[9.5px] text-faint">{unit}</span>
      </div>
      <div className="mono mt-0.5 text-[17px] font-semibold leading-tight text-txt">{value}</div>
      <Sparkline data={data} color={color} height={22} className="mt-1 opacity-80" />
    </div>
  );
}

export default function LiveCSIPage() {
  const world = useSim();
  const [sensorId, setSensorId] = useState(() => sim.world.sensors[0]?.id ?? "");
  const [metric, setMetric] = useState<Metric>("amp");
  const [proc, setProc] = useState<Proc>("raw");
  const [subSel, setSubSel] = useState<SubSel>("mean");
  const [windowSec, setWindowSec] = useState(30);
  const [frozen, setFrozen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep selection valid if the node is removed from the fleet.
  useEffect(() => {
    if (!sim.world.sensors.some((s) => s.id === sensorId)) {
      setSensorId(sim.world.sensors[0]?.id ?? "");
    }
  }, [world.sensors.length, sensorId]);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const sensor = world.sensors.find((s) => s.id === sensorId);
  const N = sim.cfg.subcarriers;
  const isSim = sim.mode === "simulation";
  const srcLabel = isSim ? `SIMULATED CSI · SEED ${sim.cfg.seed}` : "NO SOURCE · LIVE MODE";
  const idleText = !isSim
    ? "NO LIVE CSI SOURCE CONNECTED"
    : !sensor?.enabled
      ? "NODE DISABLED — TELEMETRY WITHHELD"
      : sensor?.online
        ? "AWAITING SAMPLES"
        : "NODE OFFLINE — NO FRAMES";

  const showFlash = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
  };

  /* ----------------------- data accessors -------------------------- */

  const scopeAccessor = (m: Metric, applyProc: boolean) => {
    const cache: Pt[] = [];
    return () => {
      if (frozen) return cache;
      const s = sim.world.sensors.find((x) => x.id === sensorId);
      let pts: Pt[] = [];
      if (s) {
        if (m === "amp" && subSel !== "mean") {
          const n = Math.min(s.buffer.length, s.specHist.length);
          const off = s.buffer.length - n;
          for (let i = 0; i < n; i++) pts.push({ t: s.buffer[off + i].t, v: s.specHist[off + i][subSel] });
        } else {
          pts = s.buffer.map((p) => ({ t: p.t, v: m === "amp" ? p.amp : p.phase }));
        }
        if (applyProc && proc === "filtered") {
          pts = m === "phase" ? movingAverage(pts, 7) : denoise(pts);
        }
      }
      cache.length = 0;
      for (const p of pts) cache.push(p);
      return cache;
    };
  };

  const mainSeries = useMemo(() => scopeAccessor(metric, true), [metric, proc, frozen, sensorId, subSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const secondaryMetric: Metric = metric === "amp" ? "phase" : "amp";
  const secondarySeries = useMemo(() => scopeAccessor(secondaryMetric, false), [metric, frozen, sensorId, subSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const motionSeries = useMemo(() => {
    const cache: Pt[] = [];
    return () => {
      if (frozen) return cache;
      const s = sim.world.sensors.find((x) => x.id === sensorId);
      cache.length = 0;
      if (s) for (const p of s.buffer) cache.push({ t: p.t, v: p.score });
      return cache;
    };
  }, [frozen, sensorId]);

  const spectrumAccessor = useMemo(() => {
    const cache: number[] = [];
    return () => {
      if (frozen) return cache;
      const s = sim.world.sensors.find((x) => x.id === sensorId);
      cache.length = 0;
      if (s) for (const v of s.spectrum) cache.push(v);
      return cache;
    };
  }, [frozen, sensorId]);
  const baselineAccessor = useMemo(
    () => () => {
      const s = sim.world.sensors.find((x) => x.id === sensorId);
      return s ? Array.from(s.baseAmp) : [];
    },
    [sensorId],
  );
  const framesAccessor = useMemo(() => {
    const cache: Float64Array[] = [];
    return () => {
      if (frozen) return cache;
      const s = sim.world.sensors.find((x) => x.id === sensorId);
      cache.length = 0;
      if (s) for (const f of s.specHist) cache.push(f);
      return cache;
    };
  }, [frozen, sensorId]);

  /* --------------------------- stats -------------------------------- */

  const buf = sensor?.buffer ?? [];
  const last = buf.length > 0 ? buf[buf.length - 1] : null;
  const spark = (sel: (p: TelemetryPoint) => number) => buf.slice(-60).map(sel);
  const fps = frameRate(buf.map((p) => p.t), 5);

  /* --------------------------- actions ------------------------------ */

  const doExport = (kind: "csv" | "json") => {
    const s = sim.world.sensors.find((x) => x.id === sensorId);
    if (!s || s.buffer.length === 0) return;
    // Until a live adapter produces frames (Phase 10), every buffered frame
    // was generated by the simulation engine — the export says so explicitly.
    const meta = buildMeta(s, sim.cfg, "simulation");
    const fname = `wifisense_csi_${s.id}_seed${sim.cfg.seed}_${Date.now()}.${kind}`;
    downloadText(fname, kind === "csv" ? toCSV(s.buffer) : toJSON(meta, s.buffer), kind === "csv" ? "text/csv" : "application/json");
    showFlash(`Exported ${s.buffer.length} frames → ${kind.toUpperCase()}`);
  };

  const statusTone: Tone = !sensor ? "dim" : !sensor.enabled ? "dim" : sensor.online ? "acc" : "red";
  const statusLabel = !sensor ? "NO NODE" : !sensor.enabled ? "DISABLED" : sensor.online ? "ONLINE" : "OFFLINE";
  const highlightSc = subSel === "mean" ? -1 : subSel;

  return (
    <div className="fade-up space-y-3 p-4">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Live CSI Stream</h1>
          <p className="text-[12px] text-dim">Per-node channel state information console · amplitude, phase, spectrum & waterfall.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Chip tone={isSim ? "cyan" : "red"}>{simulationStream.description}</Chip>
          <Chip tone={statusTone}>
            <Dot tone={statusTone} pulse={!!sensor?.online && sensor?.enabled} size={6} /> {statusLabel}
          </Chip>
          <Chip tone="dim">
            {sensor?.online && sensor.enabled ? `${fps.toFixed(1)} frames/s` : "0 frames/s"}
          </Chip>
          {frozen && <Chip tone="amber">FROZEN</Chip>}
          {flash && <Chip tone="acc">{flash}</Chip>}
        </div>
      </header>

      {/* Toolbar */}
      <section className="panel flex flex-wrap items-center gap-x-4 gap-y-2.5 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="lbl">Sensor</span>
          <select className="select" value={sensorId} onChange={(e) => setSensorId(e.target.value)}>
            {world.sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.roomName} {!s.enabled ? "(disabled)" : !s.online ? "(offline)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="lbl">Antenna</span>
          <select
            className="select"
            defaultValue="rx0"
            title="The simulation provides one spatial stream. Multi-antenna pairs arrive with esp-csi hardware (Phase 10)."
          >
            <option value="rx0">RX0 · stream 0</option>
            <option value="rx1" disabled>
              RX1 · not provisioned (sim)
            </option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="lbl">Subcarrier</span>
          <select
            className="select"
            value={String(subSel)}
            onChange={(e) => setSubSel(e.target.value === "mean" ? "mean" : Number(e.target.value))}
          >
            <option value="mean">MEAN · all {N}</option>
            {Array.from({ length: N }, (_, i) => (
              <option key={i} value={i}>
                SC {i}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="lbl">Window</span>
          <select className="select" value={windowSec} onChange={(e) => setWindowSec(Number(e.target.value))}>
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w} s
              </option>
            ))}
          </select>
        </div>
        <Seg label="Metric" value={metric} onChange={setMetric} options={[{ v: "amp", l: "AMPLITUDE" }, { v: "phase", l: "PHASE" }]} />
        <Seg label="Signal" value={proc} onChange={setProc} options={[{ v: "raw", l: "RAW" }, { v: "filtered", l: "FILTERED" }]} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="btn btn-acc !py-1.5"
            onClick={() => sim.setRunning(!sim.cfg.running)}
            disabled={!isSim}
            title={!isSim ? "No live CSI source connected" : sim.cfg.running ? "Pause the engine stream" : "Start the engine stream"}
          >
            <Icon name={sim.cfg.running ? "pause" : "play"} size={12} />
            {sim.cfg.running ? "Pause" : "Start"}
          </button>
          <button className="btn !py-1.5" onClick={() => setFrozen((f) => !f)}>
            <Icon name="pause" size={12} /> {frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button
            className="btn !py-1.5"
            onClick={() => {
              sim.clearBuffers(sensorId);
              showFlash("Buffers cleared");
            }}
          >
            <Icon name="x" size={12} /> Clear
          </button>
          <button className="btn !py-1.5" onClick={() => doExport("csv")} disabled={!sensor || buf.length === 0} title="Download frames as CSV">
            <Icon name="download" size={12} /> CSV
          </button>
          <button className="btn !py-1.5" onClick={() => doExport("json")} disabled={!sensor || buf.length === 0} title="Download frames as JSON">
            <Icon name="download" size={12} /> JSON
          </button>
        </div>
      </section>

      {/* Stats strip */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="RSSI" unit="dBm" value={last && sensor?.online ? last.rssi.toFixed(1) : "—"} data={spark((p) => p.rssi)} color="#5ab9ff" />
        <StatTile label="Packet rate" unit="frames/s" value={sensor?.online ? fps.toFixed(1) : "—"} data={spark(() => 1)} color="#3ce6a4" />
        <StatTile label="Variance" unit="norm²" value={last && sensor?.online ? last.variance.toExponential(2) : "—"} data={spark((p) => p.variance)} color="#f2b34c" />
        <StatTile label="Motion score" unit="0–1" value={last && sensor?.online ? last.score.toFixed(2) : "—"} data={spark((p) => p.score)} color="#f2695c" />
        <StatTile label="Mean amplitude" unit="norm" value={last && sensor?.online ? last.amp.toFixed(3) : "—"} data={spark((p) => p.amp)} color="#45d8d0" />
        <StatTile label="Mean phase" unit="rad" value={last && sensor?.online ? last.phase.toFixed(2) : "—"} data={spark((p) => p.phase)} color="#8fa1b6" />
      </section>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-3">
        <section className="panel col-span-12 xl:col-span-8">
          <div className="panel-head">
            <span className="panel-title">{metric === "amp" ? "CSI Amplitude Scope" : "CSI Phase Scope"}</span>
            <span className="mono ml-auto text-[10px] text-faint">
              {subSel === "mean" ? `MEAN OVER ${N} SC` : `SUBCARRIER ${subSel}`} · {proc.toUpperCase()} · {windowSec}s
            </span>
          </div>
          <LineChart
            windowSec={windowSec}
            height={252}
            unit={metric === "amp" ? "norm" : "rad"}
            sourceLabel={srcLabel}
            idleText={idleText}
            yFmt={(v) => (metric === "amp" ? v.toFixed(2) : v.toFixed(1))}
            series={[
              {
                label: metric === "amp" ? "amplitude" : "phase",
                color: metric === "amp" ? "#3ce6a4" : "#45d8d0",
                fill: true,
                data: mainSeries,
              },
              ...(metric === "amp"
                ? [{ label: "motion score", color: "#f2b34c", width: 1.1, domain: [0, 1] as [number, number], data: motionSeries }]
                : []),
            ]}
          />
        </section>

        <section className="panel col-span-12 xl:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Subcarrier Spectrum</span>
            <span className="mono ml-auto text-[10px] text-faint">CURRENT FRAME · {N} SC</span>
          </div>
          <SpectrumChart height={252} sourceLabel={srcLabel} data={spectrumAccessor} baseline={baselineAccessor} highlight={highlightSc} />
        </section>

        <section className="panel col-span-12 xl:col-span-5">
          <div className="panel-head">
            <span className="panel-title">{secondaryMetric === "amp" ? "Amplitude Trace" : "Phase Trace (unwrapped)"}</span>
            <span className="mono ml-auto text-[10px] text-faint">RAW · MEAN</span>
          </div>
          <LineChart
            windowSec={windowSec}
            height={228}
            unit={secondaryMetric === "amp" ? "norm" : "rad"}
            sourceLabel={srcLabel}
            idleText={idleText}
            yFmt={(v) => (secondaryMetric === "amp" ? v.toFixed(2) : v.toFixed(1))}
            series={[
              {
                label: secondaryMetric === "amp" ? "amplitude" : "phase",
                color: secondaryMetric === "amp" ? "#3ce6a4" : "#45d8d0",
                fill: true,
                data: secondarySeries,
              },
            ]}
          />
        </section>

        <section className="panel col-span-12 xl:col-span-7">
          <div className="panel-head">
            <span className="panel-title">Amplitude Waterfall</span>
            <span className="mono ml-auto text-[10px] text-faint">SPECTRAL FRAMES · NEWEST AT BOTTOM</span>
          </div>
          <WaterfallChart
            height={228}
            subcarriers={N}
            framePeriodS={0.1}
            sourceLabel={srcLabel}
            highlight={highlightSc}
            frames={framesAccessor}
          />
        </section>
      </div>

      {/* Provenance */}
      <footer className="flex flex-wrap items-center gap-2 rounded border border-line bg-panel px-3.5 py-2">
        <Icon name="alert" size={13} className={isSim ? "text-amber" : "text-red"} />
        <span className="mono text-[10.5px] leading-relaxed text-dim">
          {isSim ? (
            <>
              DATA SOURCE: SIMULATION ENGINE — synthetic CSI generated in-browser (seed {sim.cfg.seed}). These frames are{" "}
              <span className="text-amber">not hardware measurements</span>. Real CSI requires an ESP32-S3 / esp-csi node behind the
              gateway adapter (Phase 10).
            </>
          ) : (
            <>
              LIVE HARDWARE MODE — <span className="text-red">no CSI adapter attached</span>. The stream is halted and no data is
              fabricated. Attach a gateway via Settings → LIVE HARDWARE.
            </>
          )}
        </span>
      </footer>
    </div>
  );
}
