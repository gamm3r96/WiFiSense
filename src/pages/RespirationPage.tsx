import { useEffect, useState } from "react";
import LineChart from "../charts/LineChart";
import { Chip, Dot, Icon, Meter } from "../components/ui";
import { estimateRespiration, type RespirationResult } from "../processing/respiration";
import { sim, useSim } from "../state/store";
import { TICK_S } from "../simulation/engine";

/**
 * Respiration research module (Phase 15).
 * EXPERIMENTAL — NOT A MEDICAL DEVICE. Provides no diagnosis.
 */
export default function RespirationPage() {
  const world = useSim();
  const [sensorId, setSensorId] = useState(sim.world.sensors[0]?.id ?? "");
  const [result, setResult] = useState<RespirationResult | null>(null);

  const sensor = world.sensors.find((s) => s.id === sensorId) ?? world.sensors[0];
  const fs = Math.round(1 / TICK_S);

  useEffect(() => {
    const id = setInterval(() => {
      if (!sensor || !sensor.online) {
        setResult(null);
        return;
      }
      setResult(estimateRespiration(sensor.buffer, fs));
    }, 1000);
    return () => clearInterval(id);
  }, [sensor, fs]);

  const bpm = result?.breathsPerMin ?? null;

  return (
    <div className="fade-up space-y-3 p-4">
      {/* safety banner — always visible */}
      <div className="flex flex-wrap items-center gap-3 rounded border border-amber/50 bg-amber/10 px-4 py-2.5">
        <Icon name="alert" size={16} className="text-amber" />
        <span className="font-disp text-[13px] font-bold tracking-[0.12em] text-amber">EXPERIMENTAL · NOT A MEDICAL DEVICE</span>
        <span className="text-[11.5px] text-dim">
          Research preview of CSI-based respiration estimation. No medical diagnosis is provided or implied.
        </span>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Respiration Research</h1>
          <p className="text-[12px] text-dim">
            Band-pass (0.08–0.6 Hz) → spectral analysis → dominant low-frequency component.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select className="select" value={sensor?.id ?? ""} onChange={(e) => setSensorId(e.target.value)}>
            {world.sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.roomName}
              </option>
            ))}
          </select>
          <Chip tone={result?.reliable ? "acc" : "dim"}>
            <Dot tone={result?.reliable ? "acc" : "dim"} size={6} pulse={!!result?.reliable} />
            {result?.reliable ? "estimate reliable" : "unreliable"}
          </Chip>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* headline estimate */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Estimated Rate</span>
            <span className="mono ml-auto text-[10px] text-faint">{result?.samples ?? 0} SAMPLES</span>
          </div>
          <div className="p-4 text-center">
            <div className={`font-disp text-[52px] font-bold leading-none ${bpm !== null ? "text-cyan" : "text-faint"}`}>
              {bpm !== null ? bpm.toFixed(1) : "——"}
            </div>
            <div className="lbl mt-1">breaths / minute (estimate)</div>
            <div className="mono mt-2 text-[10.5px] text-dim">
              spectral peak {result ? `${(result.peakHz * 60).toFixed(1)} bpm @ ${result.peakHz.toFixed(3)} Hz` : "—"}
            </div>
            <div className="mt-4 space-y-3 text-left">
              <Meter value={result ? Math.min(1, result.quality / 8) : 0} tone={result && result.quality > 2.2 ? "acc" : "amber"} label={`signal quality (${result?.quality.toFixed(1) ?? "—"} prominence)`} />
              <Meter value={result?.motionContamination ?? 0} tone={result && result.motionContamination > 0.3 ? "red" : "dim"} label={`motion contamination (${((result?.motionContamination ?? 0) * 100).toFixed(0)}%)`} />
            </div>
            <p className={`mt-3 rounded border px-3 py-2 text-left text-[11px] leading-relaxed ${result?.reliable ? "border-acc/30 bg-acc/5 text-dim" : "border-amber/30 bg-amber/5 text-amber"}`}>
              {result?.reason ?? "collecting samples…"}
            </p>
          </div>
        </section>

        {/* respiration trace */}
        <section className="panel col-span-12 lg:col-span-8">
          <div className="panel-head">
            <span className="panel-title">Respiration Signal (band-passed amplitude)</span>
            <span className="mono ml-auto text-[10px] text-faint">0.08–0.6 Hz · {fs} Hz CADENCE</span>
          </div>
          <LineChart
            unit="Δamp"
            height={252}
            windowSec={90}
            sourceLabel="SIMULATED CSI — RESEARCH VIEW"
            idleText={sensor?.online ? "COLLECTING WINDOW…" : "NODE OFFLINE"}
            yFmt={(v) => v.toExponential(1)}
            series={[
              {
                label: "band-passed",
                color: "#45d8d0",
                fill: true,
                data: () => (result ? result.traceT.map((t, i) => ({ t, v: result.traceV[i] })) : []),
              },
            ]}
          />
        </section>

        {/* spectrum */}
        <section className="panel col-span-12">
          <div className="panel-head">
            <span className="panel-title">Low-Frequency Spectrum</span>
            <span className="mono ml-auto text-[10px] text-faint">SEARCH 0.12–0.75 Hz (7–45 BPM)</span>
          </div>
          <div className="p-4">
            {!result || result.spectrumMag.length === 0 ? (
              <div className="mono py-10 text-center text-[11px] text-faint">AWAITING SPECTRUM</div>
            ) : (
              <SpectrumBars hz={result.spectrumHz} mag={result.spectrumMag} peakHz={result.peakHz} />
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Method & Limitations</span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 text-[12px] leading-relaxed text-dim md:grid-cols-3">
          <div>
            <div className="lbl mb-1">Pipeline</div>
            CSI amplitude → motion gating → DC removal → 0.08–0.6 Hz band-pass → Hann-windowed FFT → peak search 7–45 bpm.
          </div>
          <div>
            <div className="lbl mb-1">When it fails honestly</div>
            Macro-motion, an unfitted baseline, short buffers or a weak spectral peak all yield “unreliable” instead of a number.
          </div>
          <div>
            <div className="lbl mb-1">Status</div>
            Research module only. Accuracy against a reference sensor has <span className="text-amber">not</span> been validated in this platform.
          </div>
        </div>
      </section>
    </div>
  );
}

function SpectrumBars({ hz, mag, peakHz }: { hz: number[]; mag: number[]; peakHz: number }) {
  const max = Math.max(...mag, 1e-9);
  const H = 130;
  const bw = 100 / hz.length;
  return (
    <div>
      <svg viewBox="0 0 100 40" className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        {hz.map((f, i) => {
          const h = (mag[i] / max) * 34;
          const isPeak = Math.abs(f - peakHz) < 1e-6;
          return (
            <rect
              key={f}
              x={i * bw + bw * 0.12}
              y={38 - h}
              width={bw * 0.76}
              height={Math.max(0.4, h)}
              fill={isPeak ? "#45d8d0" : "rgba(69,216,208,0.30)"}
            />
          );
        })}
        <line x1={0} y1={38} x2={100} y2={38} stroke="#2a3b52" strokeWidth={0.3} />
      </svg>
      <div className="mono mt-1 flex justify-between text-[9.5px] text-faint">
        <span>{hz[0]?.toFixed(2)} Hz ({(hz[0] * 60).toFixed(0)} bpm)</span>
        <span className="text-cyan">peak {peakHz.toFixed(3)} Hz ≈ {(peakHz * 60).toFixed(1)} bpm</span>
        <span>{hz[hz.length - 1]?.toFixed(2)} Hz ({(hz[hz.length - 1] * 60).toFixed(0)} bpm)</span>
      </div>
    </div>
  );
}
