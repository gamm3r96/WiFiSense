import { useEffect, useState } from "react";
import LineChart from "../charts/LineChart";
import { Chip, Dot, Icon, Meter, severityTone } from "../components/ui";
import { sim, useSim } from "../state/store";
import { clamp01 } from "../utils/format";
import { fmtClock } from "../utils/format";

/** Half-circle score gauge (SVG) with threshold tick. */
function Gauge({ score, threshold }: { score: number; threshold: number }) {
  const R = 56;
  const C = 64;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [C + R * Math.cos(a), C - R * Math.sin(a)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const PI = Math.PI;
  const needleA = PI * (1 - clamp01(score));
  const thA = PI * (1 - clamp01(threshold));
  const nx = C + (R - 10) * Math.cos(needleA);
  const ny = C - (R - 10) * Math.sin(needleA);
  const active = score >= threshold;
  return (
    <svg width="128" height="70" viewBox="0 0 128 70">
      <path d={arc(PI, 0)} fill="none" stroke="#1d2939" strokeWidth="8" strokeLinecap="round" />
      <path d={arc(PI, PI * (1 - clamp01(score)))} fill="none" stroke={active ? "#f2b34c" : "#3ce6a4"} strokeWidth="8" strokeLinecap="round" />
      {/* threshold tick */}
      <line
        x1={C + (R - 8) * Math.cos(thA)}
        y1={C - (R - 8) * Math.sin(thA)}
        x2={C + (R + 6) * Math.cos(thA)}
        y2={C - (R + 6) * Math.sin(thA)}
        stroke="#f2695c"
        strokeWidth="2.5"
      />
      <line x1={C} y1={C} x2={nx} y2={ny} stroke="#e6edf6" strokeWidth="2" strokeLinecap="round" />
      <circle cx={C} cy={C} r="3.5" fill="#e6edf6" />
    </svg>
  );
}

function ComponentBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="lbl">{label}</span>
        <span className="mono text-[10.5px] text-dim">
          {value.toFixed(2)} <span className="text-faint">· w {weight}</span>
        </span>
      </div>
      <Meter value={clamp01(value)} tone={value > 0.66 ? "red" : value > 0.33 ? "amber" : "acc"} />
    </div>
  );
}

export default function MotionPage() {
  const world = useSim();
  const [sensorId, setSensorId] = useState(() => sim.world.sensors[0]?.id ?? "");
  const cfg = sim.motionCfg;

  useEffect(() => {
    if (!sim.world.sensors.some((s) => s.id === sensorId)) setSensorId(sim.world.sensors[0]?.id ?? "");
  }, [world.sensors.length, sensorId]);

  const sensor = world.sensors.find((s) => s.id === sensorId);
  const res = sensor ? sim.motionResultFor(sensor.id) : undefined;
  const motion = !!res?.motion;
  const score = res?.score ?? 0;

  const srcLabel = sim.mode === "simulation" ? `SIMULATED CSI · SEED ${sim.cfg.seed}` : "NO SOURCE · LIVE MODE";
  const idle =
    sim.mode !== "simulation"
      ? "NO LIVE CSI SOURCE CONNECTED"
      : !sensor?.enabled
        ? "NODE DISABLED — TELEMETRY WITHHELD"
        : sensor?.online
          ? "AWAITING SAMPLES"
          : "NODE OFFLINE — NO FRAMES";

  const onsets = world.events.filter((e) => e.type === "MOTION_DETECTED" && e.sensorId === sensorId).slice(0, 12);

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Motion Detection</h1>
          <p className="text-[12px] text-dim">Baseline Signal Motion Detector — variance, amplitude deviation &amp; temporal difference.</p>
        </div>
        <Chip tone="dim" >
          <Icon name="zap" size={12} /> NON-ML · STATISTICAL
        </Chip>
        <div className="ml-auto flex items-center gap-2">
          <span className="lbl">Sensor</span>
          <select className="select" value={sensorId} onChange={(e) => setSensorId(e.target.value)} aria-label="Sensor">
            {world.sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.roomName}
              </option>
            ))}
          </select>
          <button className="btn !py-1.5" onClick={() => sim.resetMotionDetectors()} title="Clear hysteresis state on all detectors">
            Reset
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* ------------ status + gauge ------------ */}
        <section className="panel col-span-12 flex flex-col items-center justify-center gap-1 p-5 lg:col-span-4">
          <Gauge score={score} threshold={cfg.threshold} />
          <div
            className={`font-disp text-[26px] font-bold tracking-widest ${
              motion ? "text-amber" : "text-acc"
            }`}
          >
            {motion ? "MOTION DETECTED" : "NO MOTION"}
          </div>
          <div className="mono text-[12px] text-dim">
            score <span className={motion ? "text-amber" : "text-acc"}>{score.toFixed(3)}</span>
            <span className="mx-1.5 text-faint">·</span>threshold <span className="text-red">{cfg.threshold.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Dot tone={motion ? "amber" : "acc"} pulse={motion} size={7} />
            <span className="mono text-[10.5px] tracking-wider text-faint">
              {res?.baselineUsed ? "BASELINE-REFERENCED" : "SELF-NORMALIZED"} · WINDOW {res?.windowTicks ?? cfg.windowTicks} TICKS
            </span>
          </div>
        </section>

        {/* ------------ controls ------------ */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Detector Configuration</span>
            <span className="mono ml-auto text-[10px] text-faint">PERSISTED</span>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-txt">Threshold</span>
                <span className="mono text-[12px] text-red">{cfg.threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.01}
                value={cfg.threshold}
                onChange={(e) => sim.setMotionCfg({ threshold: Number(e.target.value) })}
                aria-label="Motion threshold"
              />
              <div className="mono text-[10px] text-faint">score ≥ threshold ⇒ motion (hysteresis ×0.85 to release)</div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-txt">Moving Window</span>
                <span className="mono text-[12px] text-acc">{cfg.windowTicks} ticks</span>
              </div>
              <input
                type="range"
                min={5}
                max={80}
                step={1}
                value={cfg.windowTicks}
                onChange={(e) => sim.setMotionCfg({ windowTicks: Number(e.target.value) })}
                aria-label="Moving window ticks"
              />
              <div className="mono text-[10px] text-faint">frames fused per evaluation (1 tick = 100 ms)</div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-txt">Sensitivity Gain</span>
                <span className="mono text-[12px] text-acc">{cfg.sensitivity.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={cfg.sensitivity}
                onChange={(e) => sim.setMotionCfg({ sensitivity: Number(e.target.value) })}
                aria-label="Sensitivity gain"
              />
              <div className="mono text-[10px] text-faint">overall gain on the fused score (0.5× – 2×)</div>
            </div>
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <p className="text-[10.5px] leading-relaxed text-faint">
              This is a classical signal-statistics detector, not machine learning. The ML activity classifier is a
              separate Phase 8 module.
            </p>
          </div>
        </section>

        {/* ------------ components ------------ */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Fused Components</span>
            <span className="mono ml-auto text-[10px] text-faint">Σ WEIGHTS = 1.00</span>
          </div>
          <div className="space-y-4 p-4">
            <ComponentBar label="Signal Variance" value={res?.components.variance ?? 0} weight={0.45} />
            <ComponentBar label="Amplitude Deviation" value={res?.components.amplitudeDev ?? 0} weight={0.25} />
            <ComponentBar label="Temporal Difference" value={res?.components.temporalDiff ?? 0} weight={0.3} />
            <div className="rounded border border-line bg-raise/40 px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="lbl">Fused Score</span>
                <span className="mono text-[15px] font-semibold text-txt">{score.toFixed(3)}</span>
              </div>
              <div className="mono mt-0.5 text-[10px] text-faint">
                = gain × (0.45·var + 0.25·dev + 0.30·Δt), clamped to [0,1]
              </div>
            </div>
          </div>
        </section>

        {/* ------------ score trace ------------ */}
        <section className="panel col-span-12 xl:col-span-8">
          <div className="panel-head">
            <span className="panel-title">Motion Score · 60 s</span>
            <span className="mono ml-auto text-[10px] text-faint">THRESHOLD OVERLAY</span>
          </div>
          <LineChart
            windowSec={60}
            height={240}
            unit="score"
            sourceLabel={srcLabel}
            idleText={idle}
            series={[
              {
                label: "motion score",
                color: "#f2b34c",
                fill: true,
                domain: [0, 1],
                data: () => (sensor ? sim.motionHistoryFor(sensor.id) : []),
              },
              {
                label: "threshold",
                color: "#f2695c",
                width: 1.2,
                domain: [0, 1],
                data: () => (sensor ? sensor.buffer.map((p) => ({ t: p.t, v: sim.motionCfg.threshold })) : []),
              },
            ]}
          />
        </section>

        {/* ------------ onset log ------------ */}
        <section className="panel col-span-12 xl:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Onset Events</span>
            <span className="mono ml-auto text-[10px] text-faint">THIS NODE</span>
          </div>
          <ul className="max-h-[240px] divide-y divide-line/60 overflow-y-auto">
            {onsets.map((e) => (
              <li key={e.id} className="event-row flex items-start gap-2.5 px-3.5 py-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityTone(e.severity) === "amber" ? "bg-amber" : "bg-acc"}`} />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-txt">{e.message}</div>
                  <div className="mono text-[10px] text-faint">
                    {fmtClock(e.t)}
                    {e.confidence !== undefined && <span> · score {(e.confidence * 100).toFixed(0)}%</span>}
                  </div>
                </div>
              </li>
            ))}
            {onsets.length === 0 && (
              <li className="mono px-4 py-8 text-center text-[11px] text-faint">NO ONSET EVENTS FOR THIS NODE</li>
            )}
          </ul>
        </section>
      </div>

      <p className="mono text-[10.5px] text-faint">
        PROVENANCE: scores derive from {sim.mode === "simulation" ? "the deterministic simulation engine" : "no attached source"} —
        motion flags are algorithmic estimates, not guaranteed physical truth.
      </p>
    </div>
  );
}
