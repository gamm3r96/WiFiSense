import { useState } from "react";
import { Icon } from "../components/ui";

const SECTIONS: Array<{ id: string; title: string }> = [
  { id: "csi", title: "What CSI Is" },
  { id: "sensing", title: "How Wi-Fi Sensing Works" },
  { id: "esp32", title: "ESP32-S3 Integration" },
  { id: "connect", title: "Connecting Hardware" },
  { id: "sim", title: "How Simulation Works" },
  { id: "datasets", title: "How Datasets Work" },
  { id: "motion", title: "Motion Detection" },
  { id: "occupancy", title: "Occupancy Detection" },
  { id: "ml", title: "How ML Works" },
  { id: "python", title: "Python Processor" },
  { id: "deploy", title: "Deploying the System" },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel scroll-mt-4">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
      </div>
      <div className="space-y-3 p-4 text-[12.5px] leading-relaxed text-dim">{children}</div>
    </section>
  );
}

const Pre = ({ children }: { children: string }) => (
  <pre className="mono overflow-x-auto rounded border border-line bg-bg2 p-3 text-[10.5px] leading-relaxed text-cyan">{children}</pre>
);

export default function DocsPage() {
  const [active, setActive] = useState("csi");
  return (
    <div className="fade-up flex gap-4 p-4">
      {/* TOC */}
      <aside className="sticky top-4 hidden h-fit w-52 shrink-0 lg:block">
        <div className="panel overflow-hidden">
          <div className="panel-head"><span className="panel-title">Contents</span></div>
          <nav>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setActive(s.id)}
                className={`nav-item block border-l-2 px-3.5 py-2 text-[12px] ${
                  active === s.id ? "border-acc bg-raise text-txt" : "border-transparent text-dim"
                }`}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-3">
        <header>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Platform Documentation</h1>
          <p className="text-[12px] text-dim">Architecture, hardware reality, and operating guides for WiFiSense Lab.</p>
        </header>

        <div id="csi">
          <Block title="What CSI Is">
            <p>
              Channel State Information describes how a Wi-Fi channel transforms each OFDM subcarrier between transmitter and receiver —
              amplitude and phase per subcarrier, per packet. Where RSSI compresses a whole frame into one power number, CSI keeps the
              fine-grained <span className="text-txt">frequency response</span>, which makes it sensitive to tiny multipath changes caused
              by people moving or even breathing.
            </p>
            <Pre>{`packet → FFT per symbol → per-subcarrier H(f) = |H|·e^{jφ}
                         └── amplitude |H|  (this platform's primary signal)
                         └── phase φ        (requires calibration to be useful)`}</Pre>
            <p>
              A browser's own Wi-Fi adapter does <span className="text-amber">not</span> expose CSI. Access requires supported hardware
              and firmware — which is exactly what the ESP32-S3 + esp-csi path provides.
            </p>
          </Block>
        </div>

        <div id="sensing">
          <Block title="How Wi-Fi Sensing Works">
            <Pre>{`ESP32-S3 CSI node
      │  CSI measurements
      ▼
Transport layer (serial / UDP / TCP)
      ▼
Node gateway ──► CSI data pipeline
                   raw → validation → amplitude/phase
                   → unwrap → denoise → normalize → features
      ▼
Detection engine
      motion · presence · occupancy · activity · (respiration)
      ▼
WebSocket event stream ──► React dashboard`}</Pre>
            <p>
              Each stage is isolated behind an interface, so a stage can be replaced (for example by the Python processor) without
              touching the rest. The UI never speaks to hardware directly — it consumes the telemetry contract.
            </p>
          </Block>
        </div>

        <div id="esp32">
          <Block title="ESP32-S3 Integration">
            <p>
              The reference node runs ESP-IDF with Espressif's <span className="mono">esp-csi</span> component, which registers a CSI
              callback on received frames. This platform ships transport adapters (USB serial, UDP, TCP) and a parser stage as explicit{" "}
              <span className="text-amber">placeholders</span>: the firmware's frame layout is not invented here. When you supply the
              layout, implement one <span className="mono">CSIPacketParser</span> — nothing else changes.
            </p>
            <Pre>{`// the contract a real parser must satisfy
interface CSIPacketParser {
  canParse(line: string): boolean
  parse(line: string): CSIFrame | null   // null = reject, never guess
}`}</Pre>
          </Block>
        </div>

        <div id="connect">
          <Block title="Connecting Hardware">
            <p>Three supported paths, in order of increasing distance from the browser:</p>
            <p>
              <span className="text-txt">1 · Web Serial</span> — Chromium browsers, Serial Monitor page, user-gesture attach. Good for
              bench bring-up with the JSON debug format.
            </p>
            <p>
              <span className="text-txt">2 · Python serial bridge</span> — for Firefox/Safari/headless hosts:
            </p>
            <Pre>{`python -m wifisense.serial_bridge --port /dev/ttyUSB0 --baud 921600 --ws ws://gateway:8080/ws/serial`}</Pre>
            <p>
              <span className="text-txt">3 · UDP/TCP gateway</span> — nodes stream to the Node.js gateway; the dashboard connects over{" "}
              <span className="mono">/ws/csi</span>. Until a gateway is attached, Live mode honestly shows “No live CSI source connected.”
            </p>
          </Block>
        </div>

        <div id="sim">
          <Block title="How Simulation Works">
            <p>
              The engine is a deterministic tick loop (0.1 s) driven by a seeded mulberry32 PRNG. Each sensor gets a static multipath
              profile × slow fading (Ornstein–Uhlenbeck) × motion perturbation × wideband noise; rooms run scenario state machines
              (EMPTY → ENTERING → WALKING → STANDING → SITTING → LEAVING). Same seed ⇒ byte-identical telemetry, which is what makes the
              self-test suite meaningful. Every simulated value is labelled <span className="text-amber">SIMULATED</span> in the UI and in
              exports.
            </p>
          </Block>
        </div>

        <div id="datasets">
          <Block title="How Datasets Work">
            <p>
              Recording samples the selected node's telemetry buffer tick-by-tick into frames (t, RSSI, amplitude, phase, variance,
              motion score), with operator label markers. Datasets persist via a repository layer — index in one blob, samples in
              per-dataset blobs — shaped exactly like the future <span className="mono">datasets</span>/<span className="mono">dataset_samples</span>{" "}
              SQL tables. CSV/JSON export carries a provenance block; the importer refuses unknown binary formats.
            </p>
          </Block>
        </div>

        <div id="motion">
          <Block title="Motion Detection">
            <p>
              The Baseline Signal Motion Detector is deliberately <span className="text-amber">not</span> machine learning. It fuses
              variance, amplitude deviation from the empty-room baseline, and temporal difference over a moving window, applies gain and
              a threshold, and uses hysteresis so the flag doesn't flap. Outputs: <span className="mono">motion: bool</span>,{" "}
              <span className="mono">motion_score ∈ [0,1]</span>.
            </p>
          </Block>
        </div>

        <div id="occupancy">
          <Block title="Occupancy Detection">
            <p>
              Capture an empty-room baseline (per-sensor spectral mean/σ + RSSI stats). Live frames are scored by standardized spectral
              deviation; a confirmed state machine maps evidence to EMPTY / OCCUPIED / MOTION / STATIONARY / UNKNOWN. Confidence values
              are algorithmic estimates — the UI says so on every panel that shows them.
            </p>
          </Block>
        </div>

        <div id="ml">
          <Block title="How ML Works">
            <p>
              Classification targets: EMPTY, STANDING, WALKING, SITTING, LYING, WAVING. Feature windows (7 statistics over 30 frames)
              are extracted identically in the browser and in Python. The authoritative models (Random Forest / SVM / Logistic
              Regression) live in the Python service via <span className="mono">POST /predict</span>; the in-console prototype
              classifier is a clearly-labelled nearest-centroid <span className="text-amber">fallback</span> — no gradient training runs
              in the frontend.
            </p>
          </Block>
        </div>

        <div id="python">
          <Block title="Python Processor">
            <Pre>{`cd python-service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000

GET  /health     liveness + model inventory
POST /process    filter a series (moving_average/low/high/band/median)
POST /features   sliding feature windows
POST /fit        train RF | SVM | LogReg on labeled windows
POST /predict    classify one feature window`}</Pre>
            <p>
              The console probes <span className="mono">/health</span> before delegating. If the service is down it says “Python service
              unavailable” and uses local processing — it never pretends remote results exist.
            </p>
          </Block>
        </div>

        <div id="deploy">
          <Block title="Deploying the System">
            <p>Current (Phase 1–15) front-end-only deployment:</p>
            <Pre>{`npm run build        # static bundle in dist/
npm run preview      # serve locally`}</Pre>
            <p>Planned production topology (interfaces already in place, not yet implemented):</p>
            <Pre>{`ESP32-S3 nodes ─► Node.js gateway (REST + /ws/csi, SQLite→PostgreSQL)
                       │
Python processor ◄─────┤  /process /features /fit /predict
                       ▼
              React dashboard (this bundle) · Docker · Prometheus hooks`}</Pre>
            <p className="flex items-center gap-2 text-faint">
              <Icon name="alert" size={13} className="text-amber" />
              Extension points prepared but not implemented: MQTT, PostgreSQL, auth/RBAC, multi-site.
            </p>
          </Block>
        </div>
      </div>
    </div>
  );
}
