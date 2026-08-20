/* ------------------------------------------------------------------ */
/* WiFiSense Lab — Simulation Engine (Phase 1)                         */
/*                                                                     */
/* Generates physically-plausible synthetic CSI telemetry:             */
/*   amplitude = static multipath profile × slow Rayleigh fading       */
/*               × human-motion perturbation + wideband noise          */
/*   phase     = per-subcarrier delay slope + SFO drift + Doppler      */
/*               shimmer + noise (unwrapped, radians)                  */
/*                                                                     */
/* All randomness flows through one seeded PRNG stream ⇒ the same      */
/* seed always reproduces the same tick-by-tick sequence.              */
/* Output is SIMULATED DATA — it is never presented as hardware CSI.   */
/* ------------------------------------------------------------------ */

import type {
  EventItem,
  EventType,
  LogLevel,
  LogItem,
  RoomSim,
  RoomState,
  SensorSim,
  Severity,
  SimConfig,
  SimWorld,
  TelemetryPoint,
} from "../types";
import { clamp, clamp01 } from "../utils/format";
import { makeGaussian, mulberry32 } from "./rng";

export const TICK_S = 0.1; // engine tick = 100 ms
export const BUFFER_CAP = 900; // 90 s of telemetry per sensor
export const ROOM_DEFS = ["Lab A", "Lab B", "Corridor", "Meeting Room"];

const CHANNELS: Array<{ ch: number; band: "2.4 GHz" | "5 GHz" }> = [
  { ch: 1, band: "2.4 GHz" },
  { ch: 6, band: "2.4 GHz" },
  { ch: 11, band: "2.4 GHz" },
  { ch: 36, band: "5 GHz" },
  { ch: 44, band: "5 GHz" },
  { ch: 52, band: "5 GHz" },
];

/** Scenario dwell time in ticks [min, max]. */
const DWELL: Record<RoomState, [number, number]> = {
  EMPTY: [140, 320],
  ENTERING: [30, 50],
  WALKING: [70, 160],
  STANDING: [90, 200],
  SITTING: [110, 260],
  LEAVING: [30, 50],
};

/** Target activity envelope per scenario state. */
const TARGET: Record<RoomState, number> = {
  EMPTY: 0.015,
  ENTERING: 0.55,
  WALKING: 0.9,
  STANDING: 0.32,
  SITTING: 0.13,
  LEAVING: 0.5,
};

const OCCUPIED_STATES: RoomState[] = ["ENTERING", "WALKING", "STANDING", "SITTING", "LEAVING"];

export function roomIsOccupied(state: RoomState): boolean {
  return OCCUPIED_STATES.includes(state);
}

export function defaultConfig(): SimConfig {
  return {
    running: true,
    seed: 1337,
    noise: 0.3,
    motionIntensity: 0.7,
    people: 2,
    sensorCount: 4,
    sampleRate: 100,
    subcarriers: 30,
  };
}

/* ----------------------------- world ------------------------------ */

export function createWorld(cfg: SimConfig): SimWorld {
  const rng = mulberry32(cfg.seed);
  const wallStart = Date.now();

  const rooms: RoomSim[] = ROOM_DEFS.map((name, i) => ({
    id: `room-${i + 1}`,
    name,
    state: "EMPTY",
    stateTicks: 40 + Math.floor(rng() * 120),
    activity: 0,
    confidence: 96,
    hist: [],
    sensorIds: [],
    anyOnline: false,
  }));

  const N = cfg.subcarriers;
  const sensors: SensorSim[] = [];
  for (let i = 0; i < cfg.sensorCount; i++) {
    const room = rooms[i % rooms.length];
    const ch = CHANNELS[i % CHANNELS.length];
    const baseAmp = new Float64Array(N);
    const k = 0.8 + rng() * 1.7;
    const ph = rng() * Math.PI * 2;
    const p2 = rng() * Math.PI * 2;
    for (let sc = 0; sc < N; sc++) {
      const x = sc / (N - 1);
      baseAmp[sc] = clamp(
        0.52 + 0.34 * Math.sin(Math.PI * x * k + ph) + 0.09 * Math.sin(sc * 0.85 + p2),
        0.22,
        1.05,
      );
    }
    const weight = new Float64Array(N);
    const center = N * (0.25 + rng() * 0.5);
    const sigma = N * 0.16;
    for (let sc = 0; sc < N; sc++) {
      weight[sc] = 0.25 + 0.75 * Math.exp(-((sc - center) ** 2) / (2 * sigma * sigma));
    }
    const mac = Array.from({ length: 6 }, () =>
      Math.floor(rng() * 256).toString(16).padStart(2, "0"),
    ).join(":");
    const s: SensorSim = {
      id: `esp32s3-${String(i + 1).padStart(3, "0")}`,
      name: `ESP32-S3-${String(i + 1).padStart(3, "0")}`,
      roomId: room.id,
      roomName: room.name,
      mac,
      ip: `10.0.10.${20 + i}`,
      channel: ch.ch,
      band: ch.band,
      hardware: "ESP32-S3 · esp-csi",
      firmware: "v0.9.2-sim",
      online: true,
      offlineFor: 0,
      uptimeS: 0,
      packetLoss: 0.4,
      latencyMs: 8,
      lastPacketS: 0,
      rssi: -48,
      motionScore: 0,
      baseAmp,
      slow: new Float64Array(N),
      weight,
      spectrum: Float64Array.from(baseAmp),
      buffer: [],
    };
    sensors.push(s);
    room.sensorIds.push(s.id);
  }

  const w: SimWorld = {
    wallStart,
    simTime: 0,
    tickIndex: 0,
    rng,
    rooms,
    sensors,
    events: [],
    logs: [],
    motionStamps: [],
    cooldowns: new Map(),
    nextId: 1,
  };

  pushLog(w, "INFO", "engine", `Simulation engine initialized`, {
    seed: cfg.seed,
    sensors: cfg.sensorCount,
    subcarriers: N,
  });
  pushLog(w, "DEBUG", "rng", `PRNG stream seeded — sequence is reproducible`, {
    seed: cfg.seed,
  });
  pushLog(w, "INFO", "pipeline", "Adapter chain: SimulationAdapter → CSIPipeline → DetectionEngine");
  pushLog(w, "INFO", "provenance", "Data source = SIMULATION. No physical CSI hardware involved.");
  pushEvent(w, "SYSTEM", "info", `Simulation engine started (seed ${cfg.seed})`, undefined, undefined, 1);

  // Warm start: 12 s of history so charts are populated on first paint.
  for (let i = 0; i < 120; i++) advanceTick(w, cfg);
  return w;
}

/* ----------------------------- helpers ---------------------------- */

function pushLog(
  w: SimWorld,
  level: LogLevel,
  component: string,
  message: string,
  meta?: Record<string, string | number>,
) {
  const item: LogItem = { id: w.nextId++, t: w.wallStart + w.simTime * 1000, level, component, message, meta };
  w.logs.unshift(item);
  if (w.logs.length > 400) w.logs.length = 400;
}

function pushEvent(
  w: SimWorld,
  type: EventType,
  severity: Severity,
  message: string,
  sensorId?: string,
  roomName?: string,
  confidence?: number,
) {
  const item: EventItem = {
    id: w.nextId++,
    t: w.wallStart + w.simTime * 1000,
    type,
    severity,
    sensorId,
    roomName,
    message,
    confidence,
    source: "simulation",
  };
  w.events.unshift(item);
  if (w.events.length > 260) w.events.length = 260;
}

function cooled(w: SimWorld, key: string, seconds: number): boolean {
  const last = w.cooldowns.get(key);
  if (last !== undefined && w.simTime - last < seconds) return true;
  w.cooldowns.set(key, w.simTime);
  return false;
}

function pickNext(state: RoomState, people: number, rng: () => number): RoomState {
  const r = rng();
  switch (state) {
    case "EMPTY":
      return people > 0 ? "ENTERING" : "EMPTY";
    case "ENTERING":
      return "WALKING";
    case "WALKING":
      return r < 0.3 ? "WALKING" : r < 0.55 ? "STANDING" : r < 0.8 ? "SITTING" : "LEAVING";
    case "STANDING":
      return r < 0.35 ? "WALKING" : r < 0.65 ? "SITTING" : "LEAVING";
    case "SITTING":
      return r < 0.4 ? "STANDING" : r < 0.6 ? "WALKING" : "LEAVING";
    case "LEAVING":
      return "EMPTY";
  }
}

/* ------------------------------ tick ------------------------------ */

export function advanceTick(w: SimWorld, cfg: SimConfig): void {
  const rng = w.rng;
  const g = makeGaussian(rng);
  w.tickIndex++;
  w.simTime += TICK_S;
  const t = w.simTime;

  const peopleFactor = cfg.people === 0 ? 0 : clamp(0.55 + 0.22 * cfg.people, 0.55, 1.45);

  /* ---- room scenario state machines ---- */
  for (const room of w.rooms) {
    room.stateTicks--;
    if (room.stateTicks <= 0) {
      const prev = room.state;
      const next = pickNext(prev, cfg.people, rng);
      room.state = next;
      const [lo, hi] = DWELL[next];
      room.stateTicks = lo + Math.floor(rng() * (hi - lo));

      const becameOccupied = roomIsOccupied(next) && !roomIsOccupied(prev);
      const becameEmpty = next === "EMPTY" && roomIsOccupied(prev);
      if (next === "ENTERING") {
        if (!cooled(w, `occ-${room.id}`, 6))
          pushEvent(w, "PERSON_PRESENT", "info", `Person entering ${room.name}`, undefined, room.name, 0.62);
      } else if (becameOccupied && !cooled(w, `occ-${room.id}`, 6)) {
        pushEvent(w, "PERSON_PRESENT", "info", `Presence established in ${room.name} (${next.toLowerCase()})`, undefined, room.name, 0.72);
      } else if (becameEmpty && !cooled(w, `occ-${room.id}`, 6)) {
        pushEvent(w, "PERSON_LEFT", "info", `Room ${room.name} is now empty`, undefined, room.name, 0.7);
      }
    }
    // Activity envelope: Ornstein–Uhlenbeck toward the state target.
    let target = TARGET[room.state] * peopleFactor;
    if (room.state === "SITTING") target += 0.035 * Math.sin(t * 1.05 + w.rooms.indexOf(room)); // micro-motion
    room.activity = clamp01(room.activity + (target - room.activity) * 0.06 + g() * 0.012);
    room.hist.push(room.activity);
    if (room.hist.length > 90) room.hist.shift();
    room.confidence =
      room.state === "EMPTY"
        ? clamp(Math.round(97 - room.activity * 90), 55, 99)
        : clamp(Math.round(56 + room.activity * 42), 55, 98);
    room.anyOnline = false;
  }

  /* ---- sensors / CSI synthesis ---- */
  const N = cfg.subcarriers;
  const noiseAmp = cfg.noise * 0.06;
  const varFloor = noiseAmp * noiseAmp * 0.6 + 1e-5;

  for (const s of w.sensors) {
    if (!s.online) {
      s.offlineFor--;
      if (s.offlineFor <= 0) {
        s.online = true;
        pushEvent(w, "SENSOR_ONLINE", "info", `${s.name} back online`, s.id, s.roomName, 1);
        pushLog(w, "INFO", "gateway", `${s.name} reconnected`, { sensor: s.id });
      }
      continue;
    }
    s.uptimeS += TICK_S;
    const room = w.rooms.find((r) => r.id === s.roomId)!;
    room.anyOnline = true;
    const act = room.activity;
    const phaseDrift = g() * 0.05;
    let sum = 0;
    let sumSq = 0;
    let phaseAcc = 0;

    for (let sc = 0; sc < N; sc++) {
      // Slow Rayleigh-ish fading per subcarrier.
      s.slow[sc] += -s.slow[sc] * 0.012 + g() * 0.006;
      // Motion perturbation: Doppler-like flicker concentrated where the link is sensitive.
      const wgt = s.weight[sc];
      const doppler =
        0.5 + 0.5 * Math.sin(t * (2.1 + sc * 0.09) + sc * 0.35 + s.channel);
      const motionComp =
        act * cfg.motionIntensity * wgt * (0.34 * doppler + 0.22 * Math.abs(g()));
      const amp =
        s.baseAmp[sc] * (1 + 0.22 * s.slow[sc]) * (1 + motionComp) +
        g() * noiseAmp * s.baseAmp[sc];
      s.spectrum[sc] = Math.max(0.02, amp);
      sum += s.spectrum[sc];
      sumSq += s.spectrum[sc] * s.spectrum[sc];
      // Phase: delay slope + clock drift + motion shimmer + noise (unwrapped).
      phaseAcc += (sc / N) * 1.9 + phaseDrift + act * 0.5 * Math.sin(t * 3.1 + sc * 0.4) + g() * cfg.noise * 0.32;
    }

    const mean = sum / N;
    const varN = Math.max(0, sumSq / N - mean * mean) / (mean * mean);
    const scoreInst = clamp01(((varN - varFloor) / (0.012 + varFloor)) * 1.35);
    const prevScore = s.motionScore;
    s.motionScore = s.motionScore * 0.65 + scoreInst * 0.35;
    s.rssi = -42 - 12 * Math.abs(s.slow[N >> 1]) - 7 * act - 5 * cfg.noise + g() * 1.1;

    // Transport health.
    const spike = rng() < 0.006 ? 12 : 0;
    const lossTarget = 0.3 + cfg.noise * 1.2 + act * 1.6 + spike;
    s.packetLoss = s.packetLoss * 0.9 + lossTarget * 0.1;
    s.latencyMs = s.latencyMs * 0.85 + (5 + cfg.noise * 9 + act * 12 + Math.abs(g()) * 2.5) * 0.15;
    s.lastPacketS = t;

    const pt: TelemetryPoint = {
      t,
      amp: mean,
      phase: phaseAcc / N,
      rssi: s.rssi,
      variance: varN,
      score: s.motionScore,
    };
    s.buffer.push(pt);
    if (s.buffer.length > BUFFER_CAP) s.buffer.shift();

    /* ---- baseline detection events ---- */
    if (prevScore < 0.45 && s.motionScore >= 0.45 && !cooled(w, `mot-${s.id}`, 4)) {
      pushEvent(w, "MOTION_DETECTED", "info", `Motion in ${s.roomName} (score ${s.motionScore.toFixed(2)})`, s.id, s.roomName, s.motionScore);
      w.motionStamps.push(t);
      if (w.motionStamps.length > 400) w.motionStamps.shift();
    }
    if (s.packetLoss > 6 && !cooled(w, `loss-${s.id}`, 30)) {
      pushEvent(w, "HIGH_PACKET_LOSS", "warn", `${s.name} packet loss ${s.packetLoss.toFixed(1)}%`, s.id, s.roomName, undefined);
      pushLog(w, "WARNING", "gateway", "Packet loss above 6%", { sensor: s.id, loss: +s.packetLoss.toFixed(1) });
    }
    if (s.rssi < -80 && !cooled(w, `rssi-${s.id}`, 45)) {
      pushEvent(w, "LOW_RSSI", "warn", `${s.name} RSSI ${s.rssi.toFixed(0)} dBm`, s.id, s.roomName, undefined);
    }

    // Random transport dropout (never affects other sensors).
    if (rng() < 0.0022) {
      s.online = false;
      s.offlineFor = 70 + Math.floor(rng() * 160);
      pushEvent(w, "SENSOR_OFFLINE", "error", `${s.name} went offline — link down`, s.id, s.roomName, undefined);
      pushLog(w, "ERROR", "gateway", `${s.name} transport lost; other nodes continue processing`, { sensor: s.id });
    }
  }
}
