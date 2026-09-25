import { useEffect, useRef, useState } from "react";
import LineChart from "../charts/LineChart";
import { Chip, Dot, Icon } from "../components/ui";
import { liveWindow, localClassifier, pythonML, type MLPrediction } from "../services/ml";
import { sim, useSim } from "../state/store";
import { fmtClock } from "../utils/format";
import type { PageId } from "../nav";

const CLASS_COLORS: Record<string, string> = {
  EMPTY: "#5b6c82",
  STANDING: "#f2b34c",
  WALKING: "#3ce6a4",
  SITTING: "#45d8d0",
  LYING: "#5ab9ff",
  WAVING: "#f2695c",
};

interface HistoryItem {
  at: number;
  label: string;
  confidence: number;
  sensor: string;
}

/**
 * Live activity recognition console (Phase 8). Displays the active
 * model's predictions as a timeline. All outputs are labelled model
 * predictions — never observed ground truth.
 */
export default function ActivityPage({ go }: { go: (p: PageId) => void }) {
  const world = useSim();
  const [sensorId, setSensorId] = useState(sim.world.sensors[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [hist, setHist] = useState<HistoryItem[]>([]);
  const [backend, setBackend] = useState<"local" | "python">("local");
  const t0 = useRef(Date.now());

  const svc = backend === "local" ? localClassifier : pythonML;
  const fitted = svc.fitted;
  const sensor = world.sensors.find((s) => s.id === sensorId) ?? world.sensors[0];
  const current = hist[hist.length - 1];

  useEffect(() => {
    if (!running || !fitted || !sensor) return;
    const id = setInterval(async () => {
      if (!sensor.online) return;
      const w = liveWindow(sensor.buffer, sensor.id);
      if (!w) return;
      try {
        const p: MLPrediction = await svc.predict(w);
        setHist((h) => [...h.slice(-199), { at: Date.now(), label: p.prediction, confidence: p.confidence, sensor: sensor.name }]);
      } catch {
        /* backend dropped — timeline simply pauses */
      }
    }, 1200);
    return () => clearInterval(id);
  }, [running, fitted, sensor, svc]);

  const labelCounts = hist.reduce<Record<string, number>>((acc, h) => {
    acc[h.label] = (acc[h.label] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Activity Recognition</h1>
          <p className="text-[12px] text-dim">Live classification timeline from the active activity model.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select className="select" value={backend} onChange={(e) => setBackend(e.target.value as "local" | "python")}>
            <option value="local">local prototype</option>
            <option value="python">python service</option>
          </select>
          <Chip tone={fitted ? "acc" : "amber"}>
            <Dot tone={fitted ? "acc" : "amber"} size={6} /> {fitted ? "model ready" : "not fitted"}
          </Chip>
        </div>
      </header>

      {!fitted && (
        <section className="panel p-5 text-center">
          <Icon name="cpu" size={26} className="mx-auto text-faint" />
          <p className="mt-2 text-[13px] text-dim">No fitted model in this session yet.</p>
          <p className="mt-1 text-[11.5px] text-faint">
            Record a few labeled datasets, fit a model, then return here for the live timeline.
          </p>
          <button className="btn btn-acc mx-auto mt-3" onClick={() => go("ml")}>
            <Icon name="cpu" size={13} /> Open Machine Learning
          </button>
        </section>
      )}

      {fitted && (
        <>
          <div className="grid grid-cols-12 gap-3">
            <section className="panel col-span-12 lg:col-span-4">
              <div className="panel-head">
                <span className="panel-title">Current State</span>
                <span className="mono ml-auto text-[10px] text-faint">MODEL PREDICTION</span>
              </div>
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <select className="select" value={sensor?.id ?? ""} onChange={(e) => setSensorId(e.target.value)}>
                    {world.sensors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button className={`btn !py-1.5 ${running ? "btn-amber" : "btn-acc"}`} onClick={() => setRunning((v) => !v)}>
                    <Icon name={running ? "pause" : "play"} size={12} /> {running ? "Pause" : "Run"}
                  </button>
                </div>
                <div className="mt-4">
                  <div className="lbl">activity</div>
                  <div
                    className="font-disp mt-1 text-[34px] font-bold leading-none tracking-wider"
                    style={{ color: current ? CLASS_COLORS[current.label] ?? "#e6edf6" : "#5b6c82" }}
                  >
                    {current?.label ?? "——"}
                  </div>
                  <div className="mono mt-2 text-[11px] text-dim">
                    {current ? `${(current.confidence * 100).toFixed(0)}% confidence · ${fmtClock(current.at)}` : "awaiting first prediction"}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {Object.entries(labelCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([label, n]) => (
                      <div key={label} className="rounded border border-line bg-raise/40 px-2 py-1.5">
                        <div className="mono text-[13px] font-semibold" style={{ color: CLASS_COLORS[label] ?? "#8fa1b6" }}>{n}</div>
                        <div className="mono text-[8.5px] tracking-wider text-faint">{label}</div>
                      </div>
                    ))}
                </div>
              </div>
            </section>

            <section className="panel col-span-12 lg:col-span-8">
              <div className="panel-head">
                <span className="panel-title">Confidence Timeline</span>
                <span className="mono ml-auto text-[10px] text-faint">{hist.length} PREDICTIONS</span>
              </div>
              <LineChart
                unit="conf"
                height={208}
                windowSec={120}
                sourceLabel={backend === "local" ? "LOCAL PROTOTYPE" : "PYTHON ML SERVICE"}
                idleText="RUN THE CLASSIFIER TO PLOT"
                series={[
                  {
                    label: "confidence",
                    color: "#3ce6a4",
                    fill: true,
                    domain: [0, 1],
                    data: () => hist.map((h) => ({ t: (h.at - t0.current) / 1000, v: h.confidence })),
                  },
                ]}
              />
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Prediction Log</span>
              <span className="mono ml-auto text-[10px] text-faint">NEWEST FIRST</span>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-panel2">
                  <tr className="border-b border-line">
                    {["Time", "Sensor", "Predicted activity", "Confidence"].map((h) => (
                      <th key={h} className="lbl px-3.5 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...hist].reverse().slice(0, 60).map((h, i) => (
                    <tr key={`${h.at}-${i}`} className="border-b border-line/60">
                      <td className="mono px-3.5 py-1.5 text-[11px] text-dim">{fmtClock(h.at)}</td>
                      <td className="mono px-3.5 py-1.5 text-[11px] text-dim">{h.sensor}</td>
                      <td className="px-3.5 py-1.5">
                        <span className="mono text-[11px] font-semibold" style={{ color: CLASS_COLORS[h.label] ?? "#8fa1b6" }}>{h.label}</span>
                      </td>
                      <td className="px-3.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-raise">
                            <div className="h-full rounded-sm bg-acc" style={{ width: `${h.confidence * 100}%` }} />
                          </div>
                          <span className="mono text-[10.5px] text-dim">{(h.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {hist.length === 0 && (
                    <tr>
                      <td colSpan={4} className="mono px-4 py-8 text-center text-[11px] text-faint">NO PREDICTIONS YET</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mono text-[10.5px] text-faint">
            NOTICE: every entry is a MODEL PREDICTION (statistical estimate), not an observed fact. {sim.streaming ? "" : "Stream halted — classifier paused."}
          </p>
        </>
      )}
    </div>
  );
}
