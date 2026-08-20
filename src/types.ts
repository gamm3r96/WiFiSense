/* ------------------------------------------------------------------ */
/* WiFiSense Lab — core domain types (Phases 1–3)                      */
/* These types describe the data contract between the simulation       */
/* engine, the store, and the UI. Future hardware adapters must emit   */
/* the same shapes so live data can replace simulated data 1:1.        */
/* ------------------------------------------------------------------ */

export type SourceMode = "simulation" | "live";

/** Planned transport for a node (real transports attach in Phase 10/11). */
export type TransportKind = "udp" | "tcp" | "serial";

export type RoomState =
  | "EMPTY"
  | "ENTERING"
  | "WALKING"
  | "STANDING"
  | "SITTING"
  | "LEAVING";

export interface SimConfig {
  /** Master switch for the simulation engine. */
  running: boolean;
  /** PRNG seed — same seed ⇒ same tick sequence (deterministic). */
  seed: number;
  /** 0..1 — wideband noise floor injected into amplitude & phase. */
  noise: number;
  /** 0..1 — gain applied to human-motion perturbations. */
  motionIntensity: number;
  /** 0..4 — simulated people moving between rooms. 0 forces empty rooms. */
  people: number;
  /** Number of sensing nodes in the topology (2..6). */
  sensorCount: number;
  /** Nominal CSI sample rate per sensor, Hz (affects KPIs & smoothing). */
  sampleRate: 10 | 25 | 50 | 100;
  /** OFDM subcarriers per CSI frame. */
  subcarriers: number;
}

export interface TelemetryPoint {
  /** Simulation timestamp, seconds since engine start. */
  t: number;
  /** Mean amplitude across subcarriers (normalized). */
  amp: number;
  /** Mean unwrapped phase across subcarriers, rad. */
  phase: number;
  /** Received signal strength, dBm. */
  rssi: number;
  /** Normalized variance across the spectrum (motion indicator). */
  variance: number;
  /** Heuristic motion score, 0..1. */
  score: number;
}

/**
 * Persisted sensor configuration (Phase 2 — repository layer).
 * This is the row shape that will live in the `sensors` table once the
 * Node/SQLite backend arrives; for now it is stored in localStorage.
 */
export interface SensorConfig {
  id: string;
  name: string;
  roomId: string;
  ip: string;
  mac: string;
  channel: number;
  band: "2.4 GHz" | "5 GHz";
  hardware: string;
  firmware: string;
  sampleRate: number;
  transport: TransportKind;
  /** Admin switch — disabled nodes are held offline by the gateway. */
  enabled: boolean;
  /** true for operator-added nodes (survives seed/count rebuilds). */
  custom: boolean;
}

/** Operator input when creating/editing a sensor (validated in store). */
export type SensorInput = Omit<SensorConfig, "id" | "custom"> & { id?: string };

export interface SensorSim {
  id: string;
  name: string;
  roomId: string;
  roomName: string;
  mac: string;
  ip: string;
  channel: number;
  band: "2.4 GHz" | "5 GHz";
  hardware: string;
  firmware: string;
  enabled: boolean;
  custom: boolean;
  sampleRate: number;
  transport: TransportKind;
  online: boolean;
  /** Ticks remaining until an offline sensor recovers. */
  offlineFor: number;
  uptimeS: number;
  packetLoss: number; // %
  latencyMs: number;
  lastPacketS: number; // simTime of last accepted frame
  rssi: number;
  motionScore: number;
  /** Static multipath magnitude profile (normalized). */
  baseAmp: Float64Array;
  /** Slow fading state per subcarrier (Ornstein–Uhlenbeck). */
  slow: Float64Array;
  /** Spatial sensitivity of this link to motion, per subcarrier. */
  weight: Float64Array;
  /** Current per-subcarrier amplitude snapshot. */
  spectrum: Float64Array;
  /** Rolling telemetry buffer (newest last). Index-aligned with specHist. */
  buffer: TelemetryPoint[];
  /** Rolling per-subcarrier amplitude frames (newest last) — powers the
      waterfall display and per-subcarrier time traces. */
  specHist: Float64Array[];
}

export interface RoomSim {
  id: string;
  name: string;
  state: RoomState;
  /** Ticks remaining in the current scenario state. */
  stateTicks: number;
  /** Smoothed activity envelope 0..1. */
  activity: number;
  /** Occupancy confidence, algorithmic estimate 0..100. */
  confidence: number;
  /** Short activity history for sparklines. */
  hist: number[];
  sensorIds: string[];
  anyOnline: boolean;
}

export type EventType =
  | "MOTION_DETECTED"
  | "PERSON_PRESENT"
  | "PERSON_LEFT"
  | "SENSOR_ONLINE"
  | "SENSOR_OFFLINE"
  | "HIGH_PACKET_LOSS"
  | "LOW_RSSI"
  | "CONFIG_CHANGE"
  | "BASELINE_CAPTURED"
  | "SYSTEM";

export type Severity = "info" | "warn" | "error";

export interface EventItem {
  id: number;
  /** Wall-clock ms. */
  t: number;
  type: EventType;
  severity: Severity;
  sensorId?: string;
  roomName?: string;
  message: string;
  /** Algorithmic estimate 0..1 where applicable. */
  confidence?: number;
  source: SourceMode;
}

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface LogItem {
  id: number;
  t: number;
  level: LogLevel;
  component: string;
  message: string;
  meta?: Record<string, string | number>;
}

export interface SimWorld {
  wallStart: number;
  simTime: number;
  tickIndex: number;
  rng: () => number;
  rooms: RoomSim[];
  sensors: SensorSim[];
  events: EventItem[]; // newest first
  logs: LogItem[]; // newest first
  /** simTime stamps of motion events (5-min KPI window). */
  motionStamps: number[];
  /** Per-entity cooldowns: key → last simTime fired. */
  cooldowns: Map<string, number>;
  nextId: number;
}

/* ------------------------- Phase 7 · datasets ---------------------- */

export type DatasetCategory =
  | "empty"
  | "standing"
  | "walking"
  | "sitting"
  | "lying"
  | "waving"
  | "entering"
  | "leaving"
  | "other";

export type DatasetStatus = "recording" | "paused" | "complete";

/** One captured telemetry frame inside a dataset. */
export interface DatasetSample {
  /** Simulation timestamp, s. */
  t: number;
  sensorId: string;
  rssi: number;
  amp: number;
  phase: number;
  variance: number;
  score: number;
}

/** A timestamped label marker added by the operator mid-recording. */
export interface DatasetLabel {
  /** Simulation timestamp, s. */
  t: number;
  label: string;
}

export interface DatasetMeta {
  id: string;
  name: string;
  category: DatasetCategory;
  sensorId: string;
  sensorName: string;
  roomId: string;
  roomName: string;
  /** Free-text subject / activity description. */
  subject: string;
  notes: string;
  /** Wall-clock ms. */
  createdAt: number;
  startedAtSim: number;
  stoppedAtSim: number | null;
  status: DatasetStatus;
  frames: number;
  labels: DatasetLabel[];
  /** Approximate serialized size in bytes. */
  sizeBytes: number;
  source: SourceMode;
  seed: number;
  sampleRateHz: number;
}

/** In-flight recorder state. */
export interface RecordingState {
  active: boolean;
  paused: boolean;
  datasetId: string | null;
  sensorId: string;
  category: DatasetCategory;
  subject: string;
  notes: string;
  startedAtSim: number | null;
  frames: number;
}
