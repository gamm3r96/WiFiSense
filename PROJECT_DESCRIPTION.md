# WiFiSense Lab - Project Description

## Short Description (for GitHub, package.json, etc.)

**Professional Wi-Fi CSI sensing platform for human presence detection, activity recognition, and signal analysis. Features real-time visualization, machine learning, and full mobile responsiveness.**

## Medium Description (150-200 words)

WiFiSense Lab is a comprehensive web platform for Wi-Fi Channel State Information (CSI) sensing research and development. It provides a complete toolkit for working with CSI data — from real-time signal visualization and analysis to machine learning-based activity recognition and experimental respiration monitoring.

The platform features a deterministic simulation engine that generates physically plausible synthetic CSI data, allowing immediate experimentation without hardware. When ready, real ESP32-S3 sensors can be connected through clean adapter interfaces without code changes.

Key capabilities include live CSI amplitude/phase scopes, spectral waterfalls, FFT analysis, motion and occupancy detection, dataset recording with ML training, and a professional mobile-responsive interface. All simulated data is clearly labeled, maintaining scientific integrity.

Built with React 18, TypeScript, and FastAPI, WiFiSense Lab is production-ready with comprehensive self-tests, extensive documentation, and a modular architecture designed for research and deployment.

## Long Description (for detailed documentation)

WiFiSense Lab is a production-ready, browser-based control center for Wi-Fi sensing research and development. It implements a complete 15-phase platform covering the entire CSI workflow: from signal acquisition and visualization to machine learning-based activity recognition.

### Core Capabilities

**Signal Processing & Visualization**
- Real-time CSI amplitude and phase scopes with per-subcarrier analysis
- Spectral waterfall displays for temporal pattern recognition
- Advanced filtering (moving average, median, low/high/band-pass)
- FFT analysis with peak detection and feature extraction
- Phase unwrapping for continuous signal analysis

**Detection & Recognition**
- Baseline signal motion detector with configurable thresholds
- 5-state occupancy engine (EMPTY/OCCUPIED/MOTION/STATIONARY/UNKNOWN)
- Empty-room baseline capture for accurate presence detection
- Activity classification using Random Forest, SVM, and Logistic Regression
- Experimental respiration rate estimation (0.08-0.6 Hz band-pass)

**Data Management**
- Dataset recording with label markers and notes
- 9 activity categories (empty, standing, walking, sitting, lying, waving, entering, leaving, other)
- CSV/JSON export with provenance headers
- File import with format validation
- Persistent storage via localStorage (SQLite/PostgreSQL ready)

**Hardware Integration**
- ESP32-S3 adapter interfaces (serial/UDP/TCP)
- Web Serial API for direct browser connection
- Python processing service for advanced DSP/ML
- Clean abstraction layer for future hardware support

**User Experience**
- Professional dark-themed RF console interface
- Fully responsive design for mobile, tablet, and desktop
- Touch-optimized controls with 36px minimum targets
- Collapsible sidebar navigation on mobile
- Safe area support for notched devices

### Technical Highlights

**Deterministic Simulation**
The platform includes a seeded simulation engine (mulberry32 PRNG) that generates physically plausible synthetic CSI data. Same seed produces byte-identical results, enabling reproducible research and testing without hardware.

**Honesty by Design**
All simulated data is clearly labeled as "SIMULATED" in charts and exports. The platform never presents synthetic frames as hardware measurements, maintaining scientific integrity.

**Production Ready**
- Comprehensive self-test suite (runs at boot and on demand)
- Extensive error handling and validation
- Modular architecture with clean interfaces
- Full TypeScript type safety
- Professional documentation (README, CONTRIBUTING, in-app docs)

**Mobile Responsive**
Full mobile experience with collapsible sidebar, touch-optimized controls, and responsive layouts. Works seamlessly across phones, tablets, and desktops with GPU-accelerated animations.

### Use Cases

- **Academic Research** — Wi-Fi sensing, human-computer interaction, wireless communications
- **Smart Buildings** — Occupancy monitoring, energy optimization, space utilization
- **Healthcare** — Fall detection, activity monitoring, respiration tracking (experimental)
- **Security** — Intrusion detection, presence verification
- **IoT Development** — Prototyping presence-aware applications
- **Education** — Teaching wireless sensing, signal processing, machine learning

### Architecture

```
ESP32-S3 (hardware) → Transport (serial/UDP/TCP) → Parser → CSI Pipeline
                                                                    ↓
Simulation Engine → Central Store → Detection Layer → React Dashboard
                                    ↓
                              ML Layer (Local/Python)
```

The architecture separates concerns cleanly: data sources (simulation or hardware) feed a central store, which drives detection algorithms and the UI. This allows swapping components without rewriting others.

### Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite build system
- Tailwind CSS for styling
- Canvas-based charting (custom LineChart, SpectrumChart, WaterfallChart, FFTChart)
- Web Serial API for hardware connection

**Backend**
- FastAPI (Python 3)
- NumPy, SciPy for signal processing
- scikit-learn for machine learning
- REST API with WebSocket support

**Storage**
- localStorage (browser)
- SQLite (planned)
- PostgreSQL (planned)

### Browser Support

- Chrome 90+ (full support, including Web Serial)
- Firefox 88+ (full support)
- Safari 14+ (full support)
- Edge 90+ (full support)
- Mobile browsers (iOS Safari, Android Chrome) with responsive interface

### License

MIT License — free for academic and commercial use.

---

**Version:** 1.1.0  
**Status:** Production Ready  
**Phases:** 15/15 Complete  
**Mobile:** Fully Responsive
