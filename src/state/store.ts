/* ------------------------------------------------------------------ */
/* WiFiSense Lab — central data store                                  */
/*                                                                     */
/* Owns the active data source. In Phase 1 the only source is the      */
/* deterministic SimulationAdapter. The `mode` switch defines where    */
/* telemetry comes from:                                               */
/*                                                                     */
/*     Web App → DataAdapter ─┬─ SimulationAdapter  (Phase 1, active)  */
/*                            ├─ RESTAdapter        (future)          */
/*                            ├─ WebSocketAdapter   (future)          */
/*                            └─ PythonCSIProcessor (future)          */
/*                                                                     */
/* Selecting LIVE HARDWARE with no adapter attached halts the stream — */
/* the app never fabricates readings and labels them as hardware data. */
/*                                                                     */
/* Phase 2 adds sensor fleet management: persisted SensorConfig rows   */
/* are reconciled with the simulation gateway via applyFleetConfigs.   */
/* The same config rows will back /api/sensors in the Node backend.    */
/* ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import {
  advanceTick,
  applyFleetConfigs,
  configsFromFleet,
  createWorld,
  defaultConfig,
  TICK_S,
} from "../simulation/engine";
import { sensorRepo } from "../services/sensorRepo";
import { runSelfTests, type TestResult } from "../tests/selftest";
import type {
  EventItem,
  EventType,
  LogItem,
  SensorConfig,
  SensorInput,
  Severity,
  SimConfig,
  SimWorld,
  SourceMode,
} from "../types";

export const APP_VERSION = "0.5.0";
export const PHASE = 5;

/* ----------------------- input validation -------------------------- */

export function sanitizeName(raw: string): string {
  return raw.replace(/[^\w \-.]/g, "").trim().slice(0, 32);
}

export function isValidIp(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => Number(o) <= 255);
}

export function isValidMac(mac: string): boolean {
  return /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac);
}

export function randomMac(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  const first = (0x02 | (Math.floor(Math.random() * 4) << 1)).toString(16).padStart(2, "0"); // locally administered
  return [first, hex(), hex(), hex(), hex(), hex()].join(":").toUpperCase();
}

export interface ConnTestResult {
  ok: boolean;
  latencyMs?: number;
  reason?: string;
}

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

class WiFiSenseStore {
  cfg: SimConfig = defaultConfig();
  mode: SourceMode = "simulation";
  world: SimWorld = createWorld(this.cfg);
  /** Persisted fleet configuration (repository layer). */
  configs: SensorConfig[];
  /** Latest self-test results (run at boot and on demand). */
  selfTests: TestResult[] = [];

  private version = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private testsRan = false;

  constructor() {
    const stored = sensorRepo.load();
    if (stored && stored.length > 0) {
      this.configs = stored;
      applyFleetConfigs(this.world, this.cfg, this.configs);
    } else {
      this.configs = configsFromFleet(this.world);
      sensorRepo.save(this.configs);
    }
  }

  init() {
    if (this.timer) return;
    if (!this.testsRan) {
      this.testsRan = true;
      this.runTests(false);
    }
    this.timer = setInterval(() => {
      if (this.mode === "simulation" && this.cfg.running) {
        advanceTick(this.world, this.cfg);
        this.version++;
        this.listeners.forEach((l) => l());
      }
    }, TICK_S * 1000);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  get streaming(): boolean {
    return this.mode === "simulation" && this.cfg.running;
  }

  /** Nominal CSI samples/s across the online fleet. */
  get samplesPerSec(): number {
    if (!this.streaming) return 0;
    const online = this.world.sensors.filter((s) => s.online).length;
    return online * this.cfg.sampleRate;
  }

  setRunning(run: boolean) {
    if (this.cfg.running === run) return;
    this.cfg.running = run;
    this.log(run ? "INFO" : "WARNING", "engine", run ? "Simulation stream resumed" : "Simulation stream paused by operator");
    this.bump();
  }

  setMode(mode: SourceMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === "live") {
      this.log("WARNING", "adapter", "LIVE HARDWARE selected — no CSI adapter attached. Stream halted; no data is fabricated.");
    } else {
      this.log("INFO", "adapter", "SimulationAdapter attached. Stream source = SIMULATION.");
    }
    this.bump();
  }

  /** Live-tunable parameters (no world rebuild). */
  tune(patch: Partial<Pick<SimConfig, "noise" | "motionIntensity" | "people">>) {
    Object.assign(this.cfg, patch);
    this.bump();
  }

  /** Structural changes rebuild the world deterministically from the seed. */
  rebuild(patch: Partial<Pick<SimConfig, "seed" | "sensorCount" | "sampleRate" | "subcarriers">>) {
    Object.assign(this.cfg, patch);
    this.world = createWorld(this.cfg);
    // Operator-added nodes survive rebuilds; defaults are regenerated.
    const customs = this.configs.filter((c) => c.custom);
    this.configs = [...configsFromFleet(this.world), ...customs];
    applyFleetConfigs(this.world, this.cfg, this.configs);
    sensorRepo.save(this.configs);
    this.log("INFO", "engine", "Engine rebuilt from seed (deterministic replay)", {
      seed: this.cfg.seed,
      sensors: this.cfg.sensorCount,
      rate: `${this.cfg.sampleRate} Hz`,
      custom: customs.length,
    });
    this.bump();
  }

  /* ------------------ sensor fleet management (P2) ------------------ */

  nextCustomId(): string {
    let max = 0;
    for (const c of this.configs) {
      const m = c.id.match(/^esp32s3-c(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `esp32s3-c${String(max + 1).padStart(3, "0")}`;
  }

  suggestIp(): string {
    const used = new Set(this.configs.map((c) => c.ip));
    for (let i = 20; i < 250; i++) {
      const ip = `10.0.10.${i}`;
      if (!used.has(ip)) return ip;
    }
    return `10.0.10.${Math.floor(Math.random() * 200) + 30}`;
  }

  addSensor(input: SensorInput): ActionResult {
    const name = sanitizeName(input.name);
    if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters (letters, digits, space, - _ .)" };
    if (this.configs.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return { ok: false, error: `A sensor named “${name}” already exists` };
    if (!isValidIp(input.ip)) return { ok: false, error: "Invalid IPv4 address" };
    if (this.configs.some((c) => c.ip === input.ip)) return { ok: false, error: `IP ${input.ip} is already assigned` };
    if (!isValidMac(input.mac)) return { ok: false, error: "Invalid MAC address (expected XX:XX:XX:XX:XX:XX)" };
    if (!this.world.rooms.some((r) => r.id === input.roomId)) return { ok: false, error: "Unknown room" };

    const id = this.nextCustomId();
    const config: SensorConfig = {
      id,
      name,
      roomId: input.roomId,
      ip: input.ip,
      mac: input.mac.toUpperCase(),
      channel: input.channel,
      band: input.band,
      hardware: input.hardware,
      firmware: sanitizeName(input.firmware) || "v0.9.2-sim",
      sampleRate: input.sampleRate,
      transport: input.transport,
      enabled: input.enabled,
      custom: true,
    };
    this.configs = [...this.configs, config];
    applyFleetConfigs(this.world, this.cfg, this.configs);
    sensorRepo.save(this.configs);
    this.log("INFO", "gateway", `Sensor ${name} provisioned by operator`, { sensor: id, room: input.roomId });
    this.bump();
    return { ok: true, id };
  }

  updateSensor(id: string, patch: Partial<SensorInput>): ActionResult {
    const config = this.configs.find((c) => c.id === id);
    if (!config) return { ok: false, error: "Sensor not found" };
    if (patch.name !== undefined) {
      const name = sanitizeName(patch.name);
      if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters (letters, digits, space, - _ .)" };
      if (this.configs.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
        return { ok: false, error: `A sensor named “${name}” already exists` };
      patch = { ...patch, name };
    }
    if (patch.ip !== undefined) {
      if (!isValidIp(patch.ip)) return { ok: false, error: "Invalid IPv4 address" };
      if (this.configs.some((c) => c.id !== id && c.ip === patch.ip))
        return { ok: false, error: `IP ${patch.ip} is already assigned` };
    }
    if (patch.mac !== undefined) {
      if (!isValidMac(patch.mac)) return { ok: false, error: "Invalid MAC address (expected XX:XX:XX:XX:XX:XX)" };
      patch = { ...patch, mac: patch.mac.toUpperCase() };
    }
    if (patch.firmware !== undefined) patch = { ...patch, firmware: sanitizeName(patch.firmware) || config.firmware };
    if (patch.roomId !== undefined && !this.world.rooms.some((r) => r.id === patch.roomId))
      return { ok: false, error: "Unknown room" };

    Object.assign(config, patch);
    applyFleetConfigs(this.world, this.cfg, this.configs);
    sensorRepo.save(this.configs);
    this.log("INFO", "gateway", `Sensor ${config.name} configuration updated`, { sensor: id });
    this.bump();
    return { ok: true, id };
  }

  removeSensor(id: string): ActionResult {
    const config = this.configs.find((c) => c.id === id);
    if (!config) return { ok: false, error: "Sensor not found" };
    this.configs = this.configs.filter((c) => c.id !== id);
    applyFleetConfigs(this.world, this.cfg, this.configs);
    sensorRepo.save(this.configs);
    this.log("WARNING", "gateway", `Sensor ${config.name} removed from fleet`, { sensor: id });
    this.bump();
    return { ok: true, id };
  }

  setEnabled(id: string, enabled: boolean): void {
    this.updateSensor(id, { enabled });
  }

  hasSensor(id: string): boolean {
    return this.configs.some((c) => c.id === id);
  }

  getSeed(): number {
    return this.cfg.seed;
  }

  /** Drop telemetry buffers (Live CSI “Clear”). Never touches configs. */
  clearBuffers(sensorId?: string): void {
    const targets = sensorId ? this.world.sensors.filter((s) => s.id === sensorId) : this.world.sensors;
    for (const s of targets) {
      s.buffer = [];
      s.specHist = [];
    }
    this.log(
      "INFO",
      "pipeline",
      sensorId ? `Telemetry buffers cleared for ${sensorId}` : "All telemetry buffers cleared",
      sensorId ? { sensor: sensorId } : undefined,
    );
    this.bump();
  }

  /** Run the deterministic self-test suite and log a structured summary. */
  runTests(announce = true): TestResult[] {
    const t0 = performance.now();
    const results = runSelfTests(this);
    const ms = (performance.now() - t0).toFixed(0);
    this.selfTests = results;
    const fails = results.filter((r) => !r.ok);
    if (fails.length === 0) {
      this.log("INFO", "selftest", `Self-test suite passed ${results.length}/${results.length} (${ms} ms)`);
    } else {
      this.log("WARNING", "selftest", `Self-test suite: ${results.length - fails.length}/${results.length} passed (${ms} ms)`);
      for (const f of fails) this.log("ERROR", "selftest", `FAILED · ${f.name}: ${f.error ?? "unknown error"}`);
    }
    if (announce) this.bump();
    return results;
  }

  /** Simulated link probe. Real adapters replace this in Phase 10/11. */
  testConnection(id: string): Promise<ConnTestResult> {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        const s = this.world.sensors.find((x) => x.id === id);
        const c = this.configs.find((x) => x.id === id);
        const room = s?.roomName;
        const fail = (reason: string) => {
          this.pushEvent("CONFIG_CHANGE", "warn", `Connection test failed for ${s?.name ?? id}: ${reason}`, id, room);
          this.log("WARNING", "gateway", `Connection test failed: ${reason}`, { sensor: id });
          resolve({ ok: false, reason });
        };
        if (!s || !c) return fail("sensor not found");
        if (!c.enabled) return fail("node disabled by operator");
        if (this.mode !== "simulation") return fail("no live adapter attached");
        if (!this.cfg.running) return fail("simulation stream halted");
        if (!s.online) return fail("link down");
        const latencyMs = Math.max(2, Math.round(s.latencyMs + (Math.random() * 6 - 3)));
        this.pushEvent("CONFIG_CHANGE", "info", `Connection test OK for ${s.name} (${latencyMs} ms)`, id, room, 1);
        this.log("INFO", "gateway", `Connection test passed`, { sensor: id, latency: `${latencyMs} ms` });
        this.bump();
        resolve({ ok: true, latencyMs });
      }, 650 + Math.random() * 550);
    });
  }

  /* ------------------------------ misc ------------------------------ */

  clearLogs() {
    this.world.logs = [
      { id: this.world.nextId++, t: Date.now(), level: "INFO", component: "logging", message: "Log buffer cleared by operator" } as LogItem,
    ];
    this.bump();
  }

  /** Structured log entry from UI/service layers (public, version-bumping). */
  logPublic(level: LogItem["level"], component: string, message: string, meta?: Record<string, string | number>) {
    this.log(level, component, message, meta);
    this.bump();
  }

  /** Event entry from UI/service layers (public, version-bumping). */
  pushEventPublic(
    type: EventType,
    severity: Severity,
    message: string,
    sensorId?: string,
    roomName?: string,
    confidence?: number,
  ) {
    this.pushEvent(type, severity, message, sensorId, roomName, confidence);
    this.bump();
  }

  private pushEvent(
    type: EventType,
    severity: Severity,
    message: string,
    sensorId?: string,
    roomName?: string,
    confidence?: number,
  ) {
    const item: EventItem = {
      id: this.world.nextId++,
      t: Date.now(),
      type,
      severity,
      sensorId,
      roomName,
      message,
      confidence,
      source: this.mode,
    };
    this.world.events.unshift(item);
    if (this.world.events.length > 260) this.world.events.length = 260;
  }

  private log(level: LogItem["level"], component: string, message: string, meta?: Record<string, string | number>) {
    this.world.logs.unshift({ id: this.world.nextId++, t: Date.now(), level, component, message, meta });
    if (this.world.logs.length > 400) this.world.logs.length = 400;
  }

  private bump() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

export const sim = new WiFiSenseStore();

/** Subscribe a component to engine ticks (re-renders ~10 Hz while streaming). */
export function useSim(): SimWorld {
  useSyncExternalStore(sim.subscribe, sim.getVersion);
  return sim.world;
}

/** Non-rendering hook: returns the version counter for effect deps. */
export function useSimVersion(): number {
  return useSyncExternalStore(sim.subscribe, sim.getVersion);
}
