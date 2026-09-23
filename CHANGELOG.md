# Changelog

All notable changes to WiFiSense Lab will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- MQTT integration for distributed sensor networks
- PostgreSQL backend for production deployments
- Docker containerization
- Prometheus/Grafana monitoring integration
- Authentication and role-based access control
- Multi-site deployment support

## [1.1.0] - 2024

### Added
- **Mobile Responsive Design** — Full mobile experience with collapsible sidebar navigation
  - Hamburger menu with smooth slide-in animation
  - Touch-optimized controls (36px minimum touch targets)
  - Responsive layouts for phones, tablets, and desktops
  - Safe area support for notched devices (iPhone X+)
  - Landscape orientation optimization
  - GPU-accelerated animations (60fps)
- **Mobile Documentation**
  - MOBILE_VIEW.md — Complete mobile implementation guide
  - MOBILE_SUMMARY.md — Quick reference for mobile features
- **Enhanced Navigation**
  - Mobile menu button in top navigation bar
  - Backdrop overlay for mobile sidebar
  - Auto-close sidebar after navigation
  - Touch-friendly hover states

### Changed
- Updated CSS with comprehensive mobile media queries
- Optimized typography and spacing for mobile devices
- Enhanced grid layouts for responsive breakpoints
- Improved touch feedback and interaction states

### Technical Details
- Added responsive breakpoints: mobile (<768px), tablet (769-1024px), desktop (>1024px)
- Implemented safe area insets for modern mobile devices
- Added touch-specific CSS optimizations
- Enhanced sidebar component with mobile props
- Updated TopNav with hamburger menu button
- Added "menu" icon to UI component library

## [1.0.0] - 2024

### Added
- **Phase 1: Dashboard & Simulation Engine**
  - Professional dark-themed dashboard with KPI cards
  - Deterministic simulation engine with seeded PRNG
  - Real-time CSI amplitude and phase visualization
  - Room occupancy and motion detection overview
  - Event feed and system logs
  - Simulation controls (noise, motion intensity, people count)

- **Phase 2: Sensor Management**
  - Fleet management with CRUD operations
  - Sensor configuration persistence
  - Room assignment and connection testing
  - Sensor detail console with live metrics

- **Phase 3: Live CSI Visualization**
  - Real-time amplitude and phase scopes
  - Per-subcarrier spectrum analysis
  - Spectral waterfall display
  - CSV/JSON export with provenance headers
  - Freeze/clear controls

- **Phase 4: Signal Analysis**
  - Moving average, median, low/high/band-pass filters
  - Radix-2 FFT with peak detection
  - Phase unwrapping
  - Feature extraction and statistics
  - Python processor delegation support

- **Phase 5: Motion Detection**
  - Baseline signal motion detector
  - Configurable threshold and window
  - Hysteresis for stable detection
  - Motion score visualization

- **Phase 6: Occupancy Detection**
  - 5-state occupancy engine (EMPTY/OCCUPIED/MOTION/STATIONARY/UNKNOWN)
  - Empty-room baseline capture
  - Confidence estimation
  - Per-room occupancy tracking

- **Phase 7: Dataset Recording**
  - Record/pause/stop functionality
  - Label markers and notes
  - 9 activity categories
  - Dataset browser with search/filter/sort
  - CSV/JSON export and import
  - File importer with format validation

- **Phase 8: Machine Learning**
  - Activity classification interface
  - Python ML service integration
  - Local prototype classifier fallback
  - Live inference with confidence timeline
  - Model validation

- **Phase 9: Python Processing Service**
  - FastAPI backend with REST endpoints
  - CSI signal processing (filters, FFT)
  - Feature extraction
  - Model training (Random Forest, SVM, Logistic Regression)
  - Prediction API

- **Phase 10: Hardware Integration**
  - ESP32-S3 adapter interfaces
  - Transport adapters (serial/UDP/TCP)
  - Parser stage with JSON debug format
  - Hardware integration console

- **Phase 11: Serial Monitor**
  - Web Serial API integration
  - Real-time serial data capture
  - Baud rate configuration
  - Data logging and export

- **Phase 12: Multi-Sensor Network**
  - Fleet health monitoring
  - Node status tracking
  - Simulated OTA updates
  - Network statistics

- **Phase 13: Room Map**
  - Building/floor/room management
  - Draggable sensor placement
  - Occupancy visualization
  - Motion pulse indicators

- **Phase 14: Event Engine**
  - Comprehensive event taxonomy
  - Event filtering and search
  - Timestamped event log
  - Event persistence

- **Phase 15: Respiration Research**
  - Experimental respiration rate estimation
  - 0.08-0.6 Hz band-pass filtering
  - FFT-based peak detection
  - Signal quality assessment
  - Motion contamination detection

### Core Features
- **Deterministic Simulation** — Seeded mulberry32 PRNG for reproducible results
- **Honesty Contract** — Clear separation between simulation and live data
- **Self-Test Suite** — Automated testing at boot and on demand
- **Comprehensive Documentation** — In-app docs and markdown guides
- **Professional UI** — Dark theme with RF console aesthetic
- **Type Safety** — Full TypeScript implementation
- **Modular Architecture** — Clean adapter interfaces for extensibility

### Technical Stack
- React 18 with TypeScript
- Vite build system
- Tailwind CSS for styling
- Canvas-based charting (LineChart, SpectrumChart, WaterfallChart, FFTChart)
- FastAPI for Python backend
- localStorage for persistence
- Web Serial API for hardware connection

### Documentation
- README.md — Project overview and setup
- CONTRIBUTING.md — Development guidelines
- In-app documentation system
- Architecture diagrams (Mermaid)

## [0.1.0] - 2024

### Added
- Initial project setup
- Basic React + TypeScript + Vite configuration
- Tailwind CSS integration
- Development environment

---

## Version History Summary

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.1.0 | 2024 | Mobile responsive design, touch optimization |
| 1.0.0 | 2024 | Complete platform with all 15 phases |
| 0.1.0 | 2024 | Initial project setup |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and the phased build methodology.

## License

MIT License - see LICENSE file for details.
