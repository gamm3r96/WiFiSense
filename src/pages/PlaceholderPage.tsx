import { Chip, Icon, type IconName } from "../components/ui";
import type { PageId } from "../nav";

interface ModuleSpec {
  title: string;
  icon: IconName;
  phase: number;
  summary: string;
  capabilities: string[];
  archNote: string;
}

const SPECS: Record<string, ModuleSpec> = {
  sensors: {
    title: "Sensors",
    icon: "chip",
    phase: 2,
    summary:
      "Full sensor lifecycle management: register, edit, enable/disable, room assignment and connection testing for every node in the fleet.",
    capabilities: [
      "Add / edit / delete sensors (ID, name, room, IP, MAC)",
      "Hardware type & firmware tracking (ESP32-S3 · esp-csi)",
      "Connection state, RSSI, channel, band, CSI rate, uptime",
      "Per-sensor detail page with live vitals",
      "Enable/disable and one-click connection test",
    ],
    archNote: "Sensor records will live behind the repository layer (SQLite now, PostgreSQL later) and feed the same fleet model the dashboard already renders.",
  },
  "live-csi": {
    title: "Live CSI",
    icon: "wave",
    phase: 3,
    summary:
      "Dedicated real-time CSI workbench: amplitude and phase versus time, per-subcarrier views, RSSI, packet rate, variance and motion score with stream controls.",
    capabilities: [
      "Amplitude / phase time charts with sensor, antenna & subcarrier selectors",
      "Raw vs filtered trace comparison and adjustable time windows",
      "Start · Pause · Clear · Freeze stream controls",
      "CSV / JSON export of the captured window",
      "WebSocket stream architecture (ws://…/ws/csi)",
    ],
    archNote: "Charts will subscribe to the same adapter contract used by the Phase 1 simulation — only the data source changes.",
  },
  analysis: {
    title: "Signal Analysis",
    icon: "sliders",
    phase: 4,
    summary:
      "The conceptual DSP pipeline as an interactive workbench: Raw CSI → Validation → Amplitude → Phase → Phase Unwrapping → Noise Reduction → Filtering → Normalization → Feature Extraction.",
    capabilities: [
      "Moving average, median, low/high/band-pass filters",
      "Standard deviation, variance, energy, FFT & peak frequency",
      "Side-by-side raw vs filtered signal and spectrum views",
      "Signal statistics panel",
      "Clean API so processing can later be delegated to Python",
    ],
    archNote: "Processing is kept behind a service interface so heavy DSP can move to the Python processor (Phase 9) without UI changes.",
  },
  motion: {
    title: "Motion",
    icon: "zap",
    phase: 5,
    summary:
      "Baseline Signal Motion Detector — a transparent, non-ML heuristic using signal variance, amplitude deviation and temporal difference over a moving window.",
    capabilities: [
      "motion = true/false with motion_score ∈ 0..1",
      "Configurable threshold and window length",
      "MOTION DETECTED / NO MOTION state display",
      "Per-sensor and per-room aggregation",
    ],
    archNote: "Explicitly not machine learning — a calibrated baseline detector that later ML models must beat.",
  },
  occupancy: {
    title: "Occupancy",
    icon: "user",
    phase: 6,
    summary:
      "Occupancy engine with states EMPTY · OCCUPIED · MOTION · STATIONARY · UNKNOWN, driven by deviation from a captured empty-room baseline.",
    capabilities: [
      "“Capture Empty Room Baseline” calibration flow",
      "Live deviation scoring against the baseline",
      "Per-room occupancy, motion flag and confidence estimate",
      "Confidence clearly labeled as an algorithmic estimate",
    ],
    archNote: "The dashboard already previews room scenario states; this module promotes them to a calibrated baseline model.",
  },
  activity: {
    title: "Activity",
    icon: "pulse",
    phase: 8,
    summary:
      "Activity recognition view: EMPTY · STANDING · WALKING · SITTING · LYING · WAVING classification results rendered with per-class confidence.",
    capabilities: [
      "Live predicted activity per room / sensor",
      "Confusion matrix and prediction history",
      "Model metadata (type, features, trained-on datasets)",
      "Every prediction labeled as a model prediction",
    ],
    archNote: "Consumes predictions from the ML interface (POST /api/ml/predict) — never runs training in the browser.",
  },
  datasets: {
    title: "Datasets",
    icon: "database",
    phase: 7,
    summary:
      "Professional dataset recorder: capture labeled CSI windows with start/stop/pause, subject & activity labels, notes, sensor and room context.",
    capabilities: [
      "Record with labels: empty · standing · walking · sitting · lying · waving · entering · leaving · other",
      "Stores timestamp, sensor_id, room_id, RSSI, CSI, amplitude, phase, label",
      "Dataset browser with search, filter, sort, view, delete",
      "CSV / JSON export (NPZ / Parquet planned)",
      "CSI file importer (CSV / JSON / NPZ) with parser status",
    ],
    archNote: "Datasets become the training fuel for Phase 8 ML models and flow through the repository layer.",
  },
  ml: {
    title: "Machine Learning",
    icon: "cpu",
    phase: 8,
    summary:
      "Modular ML interface for activity classification with classical models first (Random Forest, SVM, Logistic Regression). Training and inference run in the Python service, never in the browser.",
    capabilities: [
      "POST /api/ml/predict — features in, prediction + confidence out",
      "Model registry: version, type, feature set, metrics",
      "Train-on-dataset workflow via the Python processor",
      "All outputs labeled as model predictions",
    ],
    archNote: "The web app only renders results; the Python service (Phase 9) owns scikit-learn / optional PyTorch workloads.",
  },
  "room-map": {
    title: "Room Map",
    icon: "map",
    phase: 12,
    summary:
      "Building / floor / room editor with a 2D map for placing sensors and visualizing occupancy, motion and approximate activity.",
    capabilities: [
      "Create buildings, floors and rooms",
      "Drag-and-drop sensor placement on a 2D floor plan",
      "Live occupancy & motion overlays per room",
      "Human positions shown as Approximate Position only",
    ],
    archNote: "No exact localization claims until a validated localization model exists — by design.",
  },
};

export default function PlaceholderPage({ page }: { page: PageId }) {
  const spec = SPECS[page];
  if (!spec) return null;
  const phases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  return (
    <div className="fade-up mx-auto max-w-[880px] space-y-4 p-4">
      <header className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-line2 bg-raise text-acc">
          <Icon name={spec.icon} size={22} />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-disp text-[22px] font-bold tracking-wide text-txt">{spec.title}</h1>
            <Chip tone="blue">PHASE {spec.phase}</Chip>
            <Chip tone="dim">SCHEDULED</Chip>
          </div>
          <p className="mt-1.5 max-w-[620px] text-[13px] leading-relaxed text-dim">{spec.summary}</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Planned Capabilities</h2>
        </div>
        <ul className="grid gap-x-8 gap-y-2 p-4 sm:grid-cols-2">
          {spec.capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-[12.5px] text-dim">
              <Icon name="chevron" size={13} className="mt-0.5 shrink-0 text-acc" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel px-4 py-3">
        <div className="lbl mb-1.5">Architecture Note</div>
        <p className="text-[12.5px] leading-relaxed text-dim">{spec.archNote}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Build Roadmap</h2>
          <span className="mono ml-auto text-[10px] text-faint">INCREMENTAL · VERIFIED PER PHASE</span>
        </div>
        <div className="flex items-center gap-0 overflow-x-auto px-4 py-4">
          {phases.map((p, i) => (
            <div key={p} className="flex items-center">
              <div className="flex flex-col items-center">
                <span
                  className={`mono grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold ${
                    p === 1
                      ? "border-acc bg-acc/15 text-acc"
                      : p === spec.phase
                        ? "border-blue bg-blue/10 text-blue"
                        : "border-line2 bg-raise text-faint"
                  }`}
                >
                  {p}
                </span>
                <span className={`mono mt-1 text-[8.5px] tracking-wider ${p === 1 ? "text-acc" : "text-faint"}`}>
                  {p === 1 ? "SHIPPED" : p === spec.phase ? "TARGET" : "QUEUED"}
                </span>
              </div>
              {i < phases.length - 1 && <span className="mx-1 mb-4 h-px w-6 bg-line2 sm:w-9" />}
            </div>
          ))}
        </div>
      </section>

      <p className="mono text-[10.5px] leading-relaxed text-faint">
        Phases 1–6 (dashboard, simulation engine, fleet management, live CSI, signal analysis, motion & occupancy detection) are live and powering this workspace. Modules are
        built one phase at a time — compiled, tested and stabilized before the next phase begins.
      </p>
    </div>
  );
}
