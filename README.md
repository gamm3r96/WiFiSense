# WiFiSense Lab

**Professional Wi-Fi Channel State Information (CSI) research & monitoring platform.**

`v1.1.0` · `15/15 phases` · `React 18 + TypeScript` · `FastAPI` · `ESP32-S3 ready` · `📱 Mobile Responsive`

## 📖 About

WiFiSense Lab is a comprehensive, production-ready web platform for Wi-Fi sensing research and development. It provides a complete toolkit for working with Channel State Information (CSI) data — from real-time signal visualization and analysis to machine learning-based activity recognition and experimental respiration monitoring.

### What is Wi-Fi Sensing?

Wi-Fi sensing leverages the Channel State Information (CSI) from Wi-Fi signals to detect and analyze human presence, motion, and activities within a space. By analyzing how Wi-Fi signals are affected by people moving through an environment, the platform can:

- **Detect human presence** in rooms without cameras or wearables
- **Recognize activities** like walking, sitting, standing, or waving
- **Monitor occupancy** patterns across multiple rooms
- **Track motion** with high sensitivity using statistical analysis
- **Estimate respiration rates** (experimental research module)

### Key Features

🎯 **Complete Research Platform** — 15 fully-implemented phases covering the entire CSI workflow  
📊 **Real-time Visualization** — Live CSI amplitude/phase scopes, spectral waterfalls, and FFT analysis  
🤖 **Machine Learning Ready** — Classical models (Random Forest, SVM, Logistic Regression) with Python backend  
📱 **Fully Responsive** — Professional mobile experience with touch-optimized interface  
🔬 **Honest by Design** — Clear separation between simulation and real hardware data  
🚀 **Production Ready** — Self-test suite, comprehensive error handling, and extensive documentation  
🔌 **Hardware Agnostic** — Clean adapter interfaces for ESP32-S3 and other CSI-capable devices  

### Who Is This For?

- **Researchers** studying Wi-Fi sensing and human-computer interaction
- **Developers** building smart home, office, or healthcare applications
- **Students** learning about wireless sensing and signal processing
- **Engineers** prototyping presence detection systems
- **Data Scientists** working with CSI datasets and activity recognition

> ⚠️ **Honesty contract.** Simulated data is always labeled `SIMULATED`. The console never
> presents synthetic frames as hardware measurements, never invents packet protocols, and
> reports *unreliable* instead of guessing when an estimate cannot be trusted.

---

## Contents

- [About](#about)
- [Highlights](#highlights)
- [Mobile Experience](#mobile-experience)
- [Phase roadmap — all delivered](#phase-roadmap--all-delivered)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Python processing service](#python-processing-service)
- [Simulation vs. live hardware](#simulation-vs-live-hardware)
- [Self-test suite](#self-test-suite)
- [Hardware integration (ESP32-S3)](#hardware-integration-esp32-s3)
- [Dataset formats](#dataset-formats)
- [Persistence](#persistence)
- [Project structure](#project-structure)
- [Security notes](#security-notes)
- [Extension points](#extension-points)
- [Browser support](#browser-support)
- [License](#license)

---

## Highlights

| Capability | Detail |
|---|---|
| **Deterministic simulation** | Seeded `mulberry32` engine — same seed ⇒ byte-identical tick sequence. Multipath baseline × slow fading × motion perturbation, per-subcarrier spectra, phase drift/Doppler, per-room scenario state machines. |
| **Live CSI console** | Amplitude/phase scopes, per-subcarrier traces, spectral **waterfall**, RSSI/variance/motion stats, freeze/clear/export (CSV/JSON with provenance headers). |
| **Signal analysis** | Moving-average, median, low/high/band-pass filters; radix-2 FFT with peak detection; phase unwrapping; feature statistics — pure functions mirrored in Python for parity. |
| **Detection** | Baseline signal motion detector (hysteresis, configurable threshold/window) and a 5-state occupancy engine (`EMPTY / OCCUPIED / MOTION / STATIONARY / UNKNOWN`) driven by empty-room baselines you capture. |
| **Datasets** | Record/pause/stop, inline label markers, notes, 9 activity categories; search/filter/sort browser; viewer with amplitude replay; CSV/JSON export; file importer that **refuses unknown binary formats**. |
| **Machine learning** | Classical models via FastAPI (Random Forest, SVM, Logistic Regression); honest in-browser prototype fallback; live inference with confidence timeline. |
| **Room map** | Building/floor/room plans, draggable sensor placement, occupancy tinting, motion pulses — person markers are *approximate*, never claimed localization. |
| **Hardware plumbing** | Transport adapters (serial/UDP/TCP), parser stage, Web Serial monitor, fleet health — all placeholder-safe until the esp-csi frame layout is supplied. |
| **Respiration (experimental)** | 0.08–0.6 Hz band-pass → FFT → peak search. Bannered `EXPERIMENTAL · NOT A MEDICAL DEVICE`; unreliable windows explain *why*. |
| **Mobile responsive** | Full mobile experience with collapsible sidebar, touch-optimized controls, and responsive layouts. Works seamlessly on phones, tablets, and desktops. |

## 📱 Mobile Experience

WiFiSense Lab is fully responsive and optimized for mobile devices, providing a professional experience across all screen sizes.

### Mobile Features

- **Collapsible Sidebar** — Hamburger menu with smooth slide-in animation
- **Touch-Optimized Controls** — All buttons and inputs meet 36px minimum touch target guidelines
- **Responsive Layouts** — KPI cards, charts, and tables adapt to screen size
- **Safe Area Support** — Proper handling of notched devices (iPhone X and newer)
- **Landscape Mode** — Optimized chart heights and spacing for landscape orientation
- **GPU-Accelerated Animations** — Smooth 60fps transitions and interactions

### Responsive Breakpoints

| Device | Screen Width | Layout |
|--------|--------------|--------|
| **Mobile** | < 768px | Single column, collapsible sidebar, stacked KPIs |
| **Tablet** | 768px - 1024px | 2-column KPIs, fixed sidebar |
| **Desktop** | > 1024px | Full layout, fixed sidebar, multi-column grids |

### Mobile Navigation

1. Tap the hamburger menu (☰) in the top-left corner
2. Sidebar slides in from the left with all navigation options
3. Select a page — sidebar automatically closes
4. Tap the backdrop to dismiss the menu manually

The mobile experience maintains all desktop functionality while optimizing for touch interaction and smaller screens. See [MOBILE_VIEW.md](MOBILE_VIEW.md) for implementation details.

## Phase roadmap — all delivered

| # | Module | Status |
|---|---|---|
| 1 | Professional dashboard + simulation engine | ✅ |
| 2 | Sensor fleet management (CRUD, rooms, connection test) | ✅ |
| 3 | Live CSI visualization (scopes, waterfall, export) | ✅ |
| 4 | Signal analysis (filters, FFT, features) | ✅ |
| 5 | Motion detection (baseline signal detector) | ✅ |
| 6 | Presence / occupancy engine + baselines | ✅ |
| 7 | Dataset recorder + browser + import | ✅ |
| 8 | Machine learning interface + activity console | ✅ |
| 9 | Python processing service (FastAPI) | ✅ |
| 10 | ESP32-S3 hardware adapters | ✅ |
| 11 | Serial monitor (Web Serial) | ✅ |
| 12 | Multi-sensor network + fleet health | ✅ |
| 13 | Room map + placement | ✅ |
| 14 | Event engine | ✅ |
| 15 | Respiration research module | ✅ |

## Architecture

```mermaid
flowchart TD
    subgraph HW["Hardware (attach when ready)"]
        ESP["ESP32-S3<br/>esp-csi firmware"]
    end

    subgraph Transport
        SER["Serial adapter"]
        UDP["UDP adapter"]
        TCP["TCP adapter"]
    end

    ESP -->|CSI frames| SER & UDP & TCP
    SER & UDP & TCP --> PARSER["CSIPacketParser<br/>(placeholder until protocol supplied)"]

    subgraph Source["Data source (exactly one active)"]
        SIM["SimulationStreamSource<br/>deterministic engine"]
        WS["WebSocketStreamSource<br/>(skeleton)"]
    end

    PARSER -.->|future| WS
    SIM --> STORE["Central store<br/>tick loop + repositories"]
    WS --> STORE

    STORE --> DET["Detection layer<br/>motion · occupancy · respiration"]
    STORE --> ML["ML layer<br/>local prototype / Python service"]
    STORE --> UI["React console<br/>dashboards · charts · consoles"]

    PY["python-service<br/>FastAPI"] <-->|/fit /predict /process| ML
```

**Key invariant:** the UI and detection layers only ever consume the telemetry contract
(`TelemetryPoint`, `SensorSim`, `RoomSim`). Swapping the simulation source for a live
WebSocket source changes nothing downstream.

## Quick start

```bash
# 1. Install & run the web console
npm install
npm run dev          # http://localhost:5173

# 2. Production build
npm run build        # → dist/ (single self-contained index.html)
```

On first boot the console:

1. Generates a deterministic 4-node fleet (seed `4242`) streaming synthetic CSI.
2. Runs the **self-test suite** (see [Settings → Self-Test Suite](#self-test-suite)).
3. Persists fleet configuration, datasets, baselines and map layout to `localStorage`.

> A browser is **not** an automatic CSI receiver. CSI requires supported hardware,
> firmware and drivers — see [Hardware integration](#hardware-integration-esp32-s3).

## Python processing service

Optional but recommended for real DSP/ML workloads.

```bash
cd python-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness + fitted-model inventory (the console probes this) |
| `POST /process` | Filter a CSI amplitude series (parity with browser DSP) |
| `POST /features` | Sliding feature windows over raw samples |
| `POST /fit` | Train RF / SVM / Logistic Regression on labeled windows |
| `POST /predict` | Classify one feature window → `{prediction, confidence, distribution}` |

In the console: **Machine Learning → Python ML Service → Connect**. Until the service
answers, the console falls back to the clearly-labelled local prototype.

## Simulation vs. live hardware

| | Simulation mode | Live hardware mode |
|---|---|---|
| Source | In-process deterministic engine | `/ws/csi` gateway (adapter required) |
| Labeling | Every chart/export tagged `SIMULATED` | Never relabeled as simulated |
| With no adapter | Streams synthetic CSI | Shows *"No live CSI source connected."* |

**Never mix the two.** The mode switch is explicit in Settings, and exports carry an
explicit `provenance` block so downstream tools can't mistake synthetic frames for
measurements.

## Self-test suite

Runs automatically at boot and on demand (**Settings → Self-Test Suite**). Covers:

- Engine seeded determinism (200 ticks) and numeric bounds (950 ticks)
- Motion score tracking human activity
- All DSP filters, FFT peak recovery, phase unwrap, normalisation
- Motion detector hysteresis and baseline estimation
- Occupancy state-machine transitions (EMPTY/MOTION/STATIONARY/UNKNOWN)
- Dataset round-trip, repository validation, fleet rebuild safety
- ML classifier determinism, respiration tone recovery, importer refusals

Results are also written to **System Logs**.

## Hardware integration (ESP32-S3)

```
ESP32-S3 (esp-csi) → transport adapter (serial/udp/tcp)
    → CSIPacketParser → CSIFrame → signal pipeline → detection
```

- Adapters and the parser are **explicit placeholders** — the binary esp-csi frame
  layout has not been supplied and will not be guessed.
- A documented JSON-line debug format is parsed today so firmware bring-up can start.
- The **Serial Monitor** uses Web Serial in Chromium (`/dev/ttyUSB0`, `/dev/ttyACM0`);
  elsewhere, use the Python `pyserial` bridge.

## Dataset formats

Exported CSV columns: `t_s, amplitude, phase_rad, rssi_dbm, variance, motion_score`,
with label markers appended as `# label @ <t>s :: <label>` comments. JSON exports wrap
rows with a `meta` block (sensor, room, seed, sample rate, **provenance**).

The importer accepts these CSV/JSON exports and **refuses** NPZ/unknown binaries with an
explanation.

## Persistence

| Key | Content |
|---|---|
| `wifisense.sensors.v1` | Fleet configuration |
| `wifisense.baselines.v1` | Empty-room baselines |
| `wifisense.datasets.v1` | Dataset index + blobs |
| `wifisense.map.v1` | Floor plan + sensor placement |
| `wifisense.motion.v1` | Motion detector settings |

The repository layer is interface-driven, so SQLite/PostgreSQL can replace
`localStorage` behind the same API.

## Project structure

```
src/
  charts/        LineChart · SpectrumChart · WaterfallChart · FFTChart · CaptureChart
  components/    ui kit · TopNav · Sidebar · modals · CsiImporter
  pages/         16 routed consoles (Dashboard → Respiration → Docs)
  processing/    dsp · detectors · occupancy · respiration   (pure, testable)
  services/      repositories · streamAdapter · processor · ml · transport
  simulation/    engine · rng                                (deterministic)
  state/         store                                       (single source of truth)
  tests/         selftest                                    (boot-run suite)
  utils/         format · signal · exporter · csiImport
python-service/  FastAPI app + processors + models + utils
```

## Security notes

- No secrets in frontend code; service URLs are operator-entered.
- All user inputs (labels, filenames, sensor fields) validated and sanitized.
- CORS on the Python service restricted to the console origin.
- Unknown binary inputs are refused, never parsed speculatively.

## Extension points

MQTT · PostgreSQL · Docker · Prometheus/Grafana · auth/RBAC · multi-site — each has a
clean seam (source adapter, repository interface, event bus) prepared but intentionally
unimplemented.

## Browser support

WiFiSense Lab is tested and optimized for modern browsers with full mobile responsiveness.

| Browser | Version | Support | Mobile |
|---------|---------|---------|--------|
| **Chrome** | 90+ | ✅ Full | ✅ Android |
| **Firefox** | 88+ | ✅ Full | ✅ Android |
| **Safari** | 14+ | ✅ Full | ✅ iOS |
| **Edge** | 90+ | ✅ Full | ✅ Android |
| **Samsung Internet** | 15+ | ✅ Full | ✅ Android |

**Notes:**
- Web Serial API (for direct hardware connection) requires Chromium-based browsers
- Mobile devices support all features via the responsive interface
- Internet Explorer is not supported (no CSS Grid/Flexbox support)

## 📚 Documentation

Comprehensive documentation is available in the repository:

- **[README.md](README.md)** — This file (project overview and setup)
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Development guidelines and phased build rules
- **[CHANGELOG.md](CHANGELOG.md)** — Version history and release notes
- **[PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md)** — Detailed project description for various contexts
- **[MOBILE_VIEW.md](MOBILE_VIEW.md)** — Mobile implementation details
- **[MOBILE_SUMMARY.md](MOBILE_SUMMARY.md)** — Mobile features quick reference
- **In-app Docs** — Click "Docs" in the sidebar for platform documentation

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and release notes.

**Latest:** v1.1.0 — Mobile responsive design with collapsible sidebar and touch-optimized interface

## License

MIT — see [CONTRIBUTING.md](CONTRIBUTING.md) for the phased development rules that keep
this platform stable as it grows.
