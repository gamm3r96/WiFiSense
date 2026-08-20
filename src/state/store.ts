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
/* ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";
import { advanceTick, createWorld, defaultConfig, TICK_S } from "../simulation/engine";
import type { LogItem, SimConfig, SimWorld, SourceMode } from "../types";

export const APP_VERSION = "0.1.0";
export const PHASE = 1;

class WiFiSenseStore {
  cfg: SimConfig = defaultConfig();
  mode: SourceMode = "simulation";
  world: SimWorld = createWorld(this.cfg);

  private version = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  init() {
    if (this.timer) return;
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
    this.log("INFO", "engine", "Engine rebuilt from seed (deterministic replay)", {
      seed: this.cfg.seed,
      sensors: this.cfg.sensorCount,
      rate: `${this.cfg.sampleRate} Hz`,
    });
    this.bump();
  }

  clearLogs() {
    this.world.logs = [
      { id: this.world.nextId++, t: Date.now(), level: "INFO", component: "logging", message: "Log buffer cleared by operator" } as LogItem,
    ];
    this.bump();
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
