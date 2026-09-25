import { useEffect, useMemo, useRef, useState } from "react";
import LineChart from "../charts/LineChart";
import { Chip, Dot, Icon, Meter } from "../components/ui";
import { datasetRepo } from "../services/datasetRepo";
import {
  ACTIVITY_CLASSES,
  CATEGORY_TO_LABEL,
  FEATURE_NAMES,
  extractWindows,
  liveWindow,
  localClassifier,
  pythonML,
  type LabeledWindow,
  type MLPrediction,
} from "../services/ml";
import { sim, useSim } from "../state/store";
import { fmtClock } from "../utils/format";

type BackendId = "local" | "python";

const CLASS_COLORS: Record<string, string> = {
  EMPTY: "#5b6c82",
  STANDING: "#f2b34c",
  WALKING: "#3ce6a4",
  SITTING: "#45d8d0",
  LYING: "#5ab9ff",
  WAVING: "#f2695c",
};

function collectLabeledWindows(): { windows: LabeledWindow[]; skipped: number } {
  const windows: LabeledWindow[] = [];
  let skipped = 0;
  for (const meta of sim.datasets) {
    if (meta.status !== "complete") continue;
    const label = CATEGORY_TO_LABEL[meta.category];
    if (!label) {
      skipped++;
      continue;
    }
    const rec = datasetRepo.load(meta.id);
    if (!rec) continue;
    for (const w of extractWindows(rec.samples)) windows.push({ label, window: w });
  }
  return { windows, skipped };
}

export default function MachineLearningPage() {
  const world = useSim();
  const [backend, setBackend] = useState<BackendId>("local");
  const [pyUrl, setPyUrl] = useState(pythonML.baseUrl);
  const [pyStatus, setPyStatus] = useState<string>(pythonML.status);
  const [probing, setProbing] = useState(false);
  const [fitNote, setFitNote] = useState("");
  const [perClass, setPerClass] = useState<Record<string, number>>({});
  const [fitting, setFitting] = useState(false);
  const [accuracy, setAccuracy] = useState<{ per: Record<string, { hit: number; total: number }>; overall: number } | null>(null);
  const [liveSensor, setLiveSensor] = useState(sim.world.sensors[0]?.id ?? "");
  const [liveOn, setLiveOn] = useState(false);
  const [pred, setPred] = useState<MLPrediction | null>(null);
  const [hist, setHist] = useState<{ t: number; v: number; label: string }[]>([]);
  const t0 = useRef(Date.now());
  const lastLabel = useRef("");

  const fitted = backend === "local" ? localClassifier.fitted : pythonML.fitted && pyStatus === "online";
  const streaming = sim.streaming;
  const sensor = world.sensors.find((s) => s.id === liveSensor) ?? world.sensors[0];

  const doFit = async () => {
    setFitting(true);
    setAccuracy(null);
    const { windows, skipped } = collectLabeledWindows();
    const svc = backend === "local" ? localClassifier : pythonML;
    const res = await svc.fit(windows);
    setFitNote(res.note + (skipped ? ` · ${skipped} dataset(s) skipped (unmapped category)` : ""));
    setPerClass(res.perClass);
    sim.logPublic(res.ok ? "INFO" : "WARNING", "ml", `${svc.name}: ${res.note}`, { windows: windows.length });
    if (res.ok) sim.pushEventPublic("SYSTEM", "info", `Model fitted on ${windows.length} windows (${svc.name})`);
    setFitting(false);
  };

  const doValidate = async () => {
    const svc = backend === "local" ? localClassifier : pythonML;
    if (!svc.fitted) return;
    const per: Record<string, { hit: number; total: number }> = {};
    let hit = 0;
    let total = 0;
    for (const meta of sim.datasets) {
      const label = CATEGORY_TO_LABEL[meta.category];
      if (!label || meta.status !== "complete") continue;
      const rec = datasetRepo.load(meta.id);
      if (!rec) continue;
      for (const w of extractWindows(rec.samples)) {
        try {
          const p = await svc.predict(w);
          per[label] = per[label] ?? { hit: 0, total: 0 };
          per[label].total++;
          total++;
          if (p.prediction === label) {
            per[label].hit++;
            hit++;
          }
        } catch {
          break;
        }
      }
    }
    setAccuracy({ per, overall: total ? hit / total : 0 });
    sim.logPublic("INFO", "ml", `Validation (in-sample): ${(total ? (hit / total) * 100 : 0).toFixed(1)}% over ${total} windows`);
  };

  const probe = async () => {
    setProbing(true);
    pythonML.baseUrl = pyUrl.replace(/\/$/, "");
    const ok = await pythonML.health();
    setPyStatus(pythonML.status);
    sim.logPublic(ok ? "INFO" : "WARNING", "ml", ok ? `Python ML service online at ${pythonML.baseUrl}` : "Python ML service unreachable");
    setProbing(false);
  };

  /* ------------------------- live inference ------------------------ */
  useEffect(() => {
    if (!liveOn) return;
    const id = setInterval(async () => {
      const svc = backend === "local" ? localClassifier : pythonML;
      if (!svc.fitted || !sensor || !sensor.online) return;
      const w = liveWindow(sensor.buffer, sensor.id);
      if (!w) return;
      try {
        const p = await svc.predict(w);
        setPred(p);
        setHist((h) => [...h.slice(-149), { t: (Date.now() - t0.current) / 1000, v: p.confidence, label: p.prediction }]);
        if (p.prediction !== lastLabel.current && p.confidence > 0.5) {
          lastLabel.current = p.prediction;
          sim.pushEventPublic("MODEL_PREDICTION", "info", `Model prediction: ${p.prediction} (${(p.confidence * 100).toFixed(0)}%)`, sensor.id, sensor.roomName, p.confidence);
        }
      } catch {
        /* service dropped — keep last prediction, stay silent */
      }
    }, 1500);
    return () => clearInterval(id);
  }, [liveOn, backend, sensor]);

  // Window count only recomputes when the dataset index changes — never per tick.
  const totalWindows = useMemo(() => collectLabeledWindows().windows.length, [sim.datasets]);

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Machine Learning</h1>
          <p className="text-[12px] text-dim">
            Activity classification over CSI feature windows — classical models, trained on your recorded datasets.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={fitted ? "acc" : "dim"}>
            <Dot tone={fitted ? "acc" : "dim"} size={6} /> {fitted ? "model ready" : "no model fitted"}
          </Chip>
          <Chip tone="amber">predictions are estimates</Chip>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* ---------------- backend selection ---------------- */}
        <section className="panel col-span-12 lg:col-span-5">
          <div className="panel-head">
            <span className="panel-title">Model Backend</span>
            <span className="mono ml-auto text-[10px] text-faint">POST /api/ml/predict</span>
          </div>
          <div className="space-y-3 p-4">
            <button
              onClick={() => setBackend("local")}
              className={`w-full rounded border p-3 text-left transition-colors ${backend === "local" ? "border-acc/60 bg-acc/5" : "border-line bg-raise/40 hover:border-line2"}`}
            >
              <div className="flex items-center gap-2">
                <Dot tone={localClassifier.fitted ? "acc" : "dim"} size={7} />
                <span className="font-disp text-[13px] font-semibold text-txt">Local Prototype Classifier</span>
                <Chip tone="cyan">fallback</Chip>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-dim">
                Deterministic nearest-centroid model fitted in the console from dataset features. A usability fallback —{" "}
                <span className="text-amber">not</span> the scikit-learn pipeline.
              </p>
            </button>

            <div className={`rounded border p-3 transition-colors ${backend === "python" ? "border-acc/60 bg-acc/5" : "border-line bg-raise/40"}`}>
              <button className="flex w-full items-center gap-2 text-left" onClick={() => setBackend("python")}>
                <Dot tone={pyStatus === "online" ? "acc" : pyStatus === "offline" ? "red" : "dim"} size={7} />
                <span className="font-disp text-[13px] font-semibold text-txt">Python ML Service</span>
                <Chip tone={pyStatus === "online" ? "acc" : pyStatus === "offline" ? "red" : "dim"}>{pyStatus}</Chip>
              </button>
              <p className="mt-1 text-[11px] leading-relaxed text-dim">Random Forest · SVM · Logistic Regression via FastAPI (<span className="mono">python-service/</span>).</p>
              <div className="mt-2 flex gap-2">
                <input type="text" className="min-w-0 flex-1" value={pyUrl} onChange={(e) => setPyUrl(e.target.value)} placeholder="http://localhost:8000" />
                <button className="btn !py-1.5" onClick={probe} disabled={probing}>
                  <Icon name="plug" size={12} /> {probing ? "Probing…" : "Connect"}
                </button>
              </div>
            </div>

            <div className="rounded border border-line bg-raise/40 p-3">
              <div className="flex items-center justify-between">
                <span className="lbl">Training data</span>
                <span className="mono text-[11px] text-txt">{totalWindows} labeled windows</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ACTIVITY_CLASSES.map((c) => (
                  <span key={c} className="mono rounded border border-line2 px-1.5 py-0.5 text-[10px]" style={{ color: CLASS_COLORS[c] }}>
                    {c} {perClass[c] ?? 0}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-acc flex-1 !py-2" onClick={doFit} disabled={fitting || totalWindows === 0}>
                  <Icon name="cpu" size={13} /> {fitting ? "Fitting…" : "Fit Model"}
                </button>
                <button className="btn !py-2" onClick={doValidate} disabled={!fitted}>
                  Validate
                </button>
              </div>
              {totalWindows === 0 && (
                <p className="mt-2 text-[10.5px] text-amber">No labeled datasets yet — record walking/sitting/… sessions in Datasets first.</p>
              )}
              {fitNote && <p className="mt-2 text-[11px] leading-relaxed text-dim">{fitNote}</p>}
            </div>
          </div>
        </section>

        {/* ---------------- validation ---------------- */}
        <section className="panel col-span-12 lg:col-span-3">
          <div className="panel-head">
            <span className="panel-title">Validation</span>
            <span className="mono ml-auto text-[10px] text-faint">IN-SAMPLE</span>
          </div>
          <div className="p-4">
            {!accuracy ? (
              <p className="pt-6 text-center text-[11px] leading-relaxed text-faint">
                Fit a model, then run validation to score it against the recorded datasets.
              </p>
            ) : (
              <>
                <div className="mb-3 text-center">
                  <div className="mono text-[26px] font-semibold text-acc">{(accuracy.overall * 100).toFixed(1)}%</div>
                  <div className="lbl">overall accuracy</div>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(accuracy.per).map(([label, v]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="mono w-20 text-[10.5px]" style={{ color: CLASS_COLORS[label] ?? "#8fa1b6" }}>{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-raise">
                        <div className="h-full rounded-sm bg-acc" style={{ width: `${v.total ? (v.hit / v.total) * 100 : 0}%` }} />
                      </div>
                      <span className="mono text-[10px] text-dim">{v.hit}/{v.total}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-faint">In-sample (training = test) — optimistic by design. Held-out validation arrives with the Python service.</p>
              </>
            )}
          </div>
        </section>

        {/* ---------------- live inference ---------------- */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <Icon name="pulse" size={14} className="text-acc" />
            <span className="panel-title">Live Inference</span>
            <span className="mono ml-auto text-[10px] text-faint">30-FRAME WINDOW</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <select className="select min-w-0 flex-1" value={sensor?.id ?? ""} onChange={(e) => setLiveSensor(e.target.value)}>
                {world.sensors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.roomName}
                  </option>
                ))}
              </select>
              <button className={`btn !py-1.5 ${liveOn ? "btn-amber" : "btn-acc"}`} onClick={() => setLiveOn((v) => !v)} disabled={!fitted}>
                <Icon name={liveOn ? "pause" : "play"} size={12} /> {liveOn ? "Stop" : "Run"}
              </button>
            </div>

            {!fitted && <p className="text-[11px] text-amber">Fit a model to enable live inference.</p>}
            {fitted && !liveOn && <p className="mono text-center text-[10.5px] text-faint">INFERENCE IDLE</p>}

            {pred && liveOn && (
              <>
                <div className="rounded border border-line bg-raise/50 p-3 text-center">
                  <div className="lbl">current prediction</div>
                  <div className="font-disp mt-1 text-[26px] font-bold tracking-wider" style={{ color: CLASS_COLORS[pred.prediction] ?? "#e6edf6" }}>
                    {pred.prediction}
                  </div>
                  <Meter value={pred.confidence} tone={pred.confidence > 0.6 ? "acc" : "amber"} label="confidence (model estimate)" />
                  <div className="mono mt-1 text-[9.5px] text-faint">
                    {pred.backend} · {fmtClock(pred.at)}
                  </div>
                </div>
                <div className="space-y-1">
                  {Object.entries(pred.distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, p]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="mono w-20 text-[10px]" style={{ color: CLASS_COLORS[label] ?? "#8fa1b6" }}>{label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-raise">
                          <div className="h-full rounded-sm" style={{ width: `${p * 100}%`, background: CLASS_COLORS[label] ?? "#8fa1b6" }} />
                        </div>
                        <span className="mono w-10 text-right text-[10px] text-dim">{(p * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* confidence timeline + feature names */}
        <section className="panel col-span-12 xl:col-span-8">
          <div className="panel-head">
            <span className="panel-title">Prediction Confidence Timeline</span>
            <span className="mono ml-auto text-[10px] text-faint">SRC: {backend === "local" ? "LOCAL PROTOTYPE" : "PYTHON SERVICE"}</span>
          </div>
          <LineChart
            unit="conf"
            height={170}
            windowSec={120}
            sourceLabel={backend === "local" ? "LOCAL PROTOTYPE CLASSIFIER" : "PYTHON ML SERVICE"}
            idleText={liveOn ? "AWAITING PREDICTIONS" : "RUN LIVE INFERENCE TO PLOT"}
            series={[
              { label: "confidence", color: "#3ce6a4", fill: true, domain: [0, 1], data: () => hist.map((h) => ({ t: h.t, v: h.v })) },
            ]}
          />
        </section>

        <section className="panel col-span-12 xl:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Feature Vector</span>
            <span className="mono ml-auto text-[10px] text-faint">{FEATURE_NAMES.length}-DIM</span>
          </div>
          <ul className="divide-y divide-line/60 p-1">
            {FEATURE_NAMES.map((f, i) => (
              <li key={f} className="flex items-center justify-between px-3 py-1.5">
                <span className="mono text-[11px] text-txt">f{i} · {f}</span>
                <span className="mono text-[10px] text-faint">{pred ? "" : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-relaxed text-faint">
            Windows are extracted identically in the browser and in <span className="mono">python-service/processors/csi.py</span> for parity.
          </p>
        </section>
      </div>

      <p className="mono text-[10.5px] text-faint">
        NOTICE: outputs are MODEL PREDICTIONS — statistical estimates with no guarantee of physical truth. Not a safety system.
        {streaming ? "" : " · stream halted — live inference paused"}
      </p>
    </div>
  );
}


