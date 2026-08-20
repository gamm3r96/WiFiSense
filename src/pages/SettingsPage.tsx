import { useState } from "react";
import { Chip, Dot, Icon, Toggle } from "../components/ui";
import { sim, useSim } from "../state/store";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-txt">{label}</span>
        <span className="mono text-[12px] text-acc">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <div className="mono text-[10px] text-faint">{hint}</div>
    </div>
  );
}

const PIPELINE = [
  { name: "SimulationAdapter", note: "deterministic CSI source", state: "ACTIVE" },
  { name: "RESTAdapter", note: "POST /api/csi · future", state: "PLANNED" },
  { name: "WebSocketAdapter", note: "ws://…/ws/csi · future", state: "PLANNED" },
  { name: "Python CSI Processor", note: "FastAPI service · Phase 9", state: "PLANNED" },
];

export default function SettingsPage() {
  useSim();
  const [seedInput, setSeedInput] = useState(String(sim.cfg.seed));
  const cfg = sim.cfg;

  return (
    <div className="fade-up mx-auto max-w-[980px] space-y-3 p-4">
      <header className="flex items-center gap-3">
        <Icon name="gear" size={18} className="text-acc" />
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Settings</h1>
          <p className="text-[12px] text-dim">Data source, simulation engine and pipeline configuration.</p>
        </div>
      </header>

      {/* ---------------- data source mode ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Data Source Mode</h2>
          <Chip tone={sim.mode === "simulation" ? "amber" : "red"}>
            {sim.mode === "simulation" ? "SIMULATION" : "LIVE HARDWARE"}
          </Chip>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <button
            onClick={() => sim.setMode("simulation")}
            className={`rounded-md border p-4 text-left transition-colors ${
              sim.mode === "simulation" ? "border-amber/60 bg-amber/5" : "border-line bg-panel hover:border-line2"
            }`}
          >
            <div className="flex items-center gap-2">
              <Dot tone="amber" size={7} pulse={cfg.running} />
              <span className="font-disp text-[14px] font-semibold tracking-wide text-txt">SIMULATION</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Deterministic synthetic CSI from the local engine. Every reading is clearly labeled as simulated —
              ideal for UI development, algorithm design and demos without hardware.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="lbl">Engine</span>
              <Toggle checked={cfg.running} onChange={(v) => sim.setRunning(v)} />
              <span className={`mono text-[10.5px] ${cfg.running ? "text-acc" : "text-amber"}`}>
                {cfg.running ? "RUNNING" : "PAUSED"}
              </span>
            </div>
          </button>

          <button
            onClick={() => sim.setMode("live")}
            className={`rounded-md border p-4 text-left transition-colors ${
              sim.mode === "live" ? "border-red/60 bg-red/5" : "border-line bg-panel hover:border-line2"
            }`}
          >
            <div className="flex items-center gap-2">
              <Dot tone="red" size={7} />
              <span className="font-disp text-[14px] font-semibold tracking-wide text-txt">LIVE HARDWARE</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Requires an attached CSI source (ESP32-S3 · esp-csi via serial/UDP, or the external Python
              processor). Browser JavaScript alone cannot extract CSI from a laptop Wi-Fi adapter.
            </p>
            <div className="mt-3 rounded border border-red/30 bg-red/5 px-3 py-2">
              <span className="mono text-[10.5px] text-red">No live CSI source connected.</span>
            </div>
          </button>
        </div>
        {sim.mode === "live" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
            <Icon name="alert" size={15} className="text-red" />
            <span className="text-[12px] text-dim">
              Selecting LIVE HARDWARE halts the stream. The platform never substitutes simulated data for hardware
              data. Transport adapters (USB serial · UDP · Wi-Fi) ship in Phase 10.
            </span>
            <button className="btn ml-auto" disabled title="Hardware integration — Phase 10">
              <Icon name="plug" size={13} /> Connect Sensor
            </button>
            <button className="btn btn-acc" onClick={() => sim.setMode("simulation")}>
              Return to Simulation
            </button>
          </div>
        )}
      </section>

      {/* ---------------- simulation engine ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Simulation Engine</h2>
          <span className="mono ml-auto text-[10px] text-faint">TICK 100 ms · SEEDED PRNG</span>
        </div>
        <div className="grid gap-x-8 gap-y-4 p-4 md:grid-cols-2">
          <SliderRow
            label="Signal Noise"
            value={cfg.noise}
            min={0}
            max={1}
            step={0.05}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => sim.tune({ noise: v })}
            hint="Wideband noise floor injected into amplitude & phase"
          />
          <SliderRow
            label="Movement Intensity"
            value={cfg.motionIntensity}
            min={0}
            max={1}
            step={0.05}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => sim.tune({ motionIntensity: v })}
            hint="Gain applied to human-motion perturbations"
          />
          <SliderRow
            label="Number of People"
            value={cfg.people}
            min={0}
            max={4}
            step={1}
            fmt={(v) => `${v}`}
            onChange={(v) => sim.tune({ people: v })}
            hint="0 forces all rooms to the EMPTY scenario"
          />
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-txt">Sensor Count</span>
                <span className="mono text-[12px] text-acc">{cfg.sensorCount} nodes</span>
              </div>
              <input
                type="range"
                min={2}
                max={6}
                step={1}
                value={cfg.sensorCount}
                onChange={(e) => sim.rebuild({ sensorCount: Number(e.target.value) })}
                aria-label="Sensor count"
              />
              <div className="mono text-[10px] text-faint">Rebuilds the topology deterministically from the seed</div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-txt">CSI Sample Rate</span>
                <span className="mono text-[12px] text-acc">{cfg.sampleRate} Hz</span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {([10, 25, 50, 100] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => sim.rebuild({ sampleRate: r })}
                    className={`mono flex-1 rounded border px-2 py-1.5 text-[11.5px] transition-colors ${
                      cfg.sampleRate === r
                        ? "border-acc/60 bg-acc/10 text-acc"
                        : "border-line2 bg-raise text-dim hover:border-acc-dim"
                    }`}
                  >
                    {r} Hz
                  </button>
                ))}
              </div>
              <div className="mono mt-1 text-[10px] text-faint">Nominal per-node rate (KPI + smoothing)</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-line px-4 py-3">
          <div>
            <div className="lbl mb-1">PRNG Seed</div>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                className="w-28"
                aria-label="PRNG seed"
              />
              <button
                className="btn btn-acc !py-1.5"
                onClick={() => {
                  const n = Number(seedInput);
                  if (Number.isFinite(n)) sim.rebuild({ seed: Math.abs(Math.trunc(n)) % 1_000_000 });
                }}
              >
                <Icon name="seed" size={13} /> Apply & Re-seed
              </button>
            </div>
          </div>
          <button
            className="btn ml-auto"
            onClick={() => {
              setSeedInput(String(cfg.seed));
              sim.rebuild({});
            }}
            title="Rebuild world from the current seed"
          >
            Reset Engine
          </button>
          <span className="mono w-full text-[10px] text-faint sm:w-auto">
            Same seed + same settings ⇒ identical tick sequence (deterministic replay).
          </span>
        </div>
      </section>

      {/* ---------------- adapter pipeline ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Hardware / Data Adapter Chain</h2>
          <span className="mono ml-auto text-[10px] text-faint">MODULAR BY DESIGN</span>
        </div>
        <div className="space-y-2 p-4">
          {PIPELINE.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <div className="mono w-6 text-right text-[11px] text-faint">{i + 1}</div>
              <div
                className={`flex flex-1 items-center gap-3 rounded border px-3 py-2 ${
                  p.state === "ACTIVE" ? "border-acc/50 bg-acc/5" : "border-line bg-panel"
                }`}
              >
                <Dot tone={p.state === "ACTIVE" ? "acc" : "dim"} pulse={p.state === "ACTIVE"} size={6} />
                <span className="mono text-[12px] text-txt">{p.name}</span>
                <span className="text-[11px] text-faint">{p.note}</span>
                <Chip tone={p.state === "ACTIVE" ? "acc" : "dim"}>{p.state}</Chip>
              </div>
            </div>
          ))}
          <p className="pt-1 text-[11.5px] leading-relaxed text-faint">
            All adapters emit the same telemetry contract, so live hardware (or the Python CSI processor) can
            replace the simulation source without touching the dashboard, detection or recording layers.
          </p>
        </div>
      </section>
    </div>
  );
}
