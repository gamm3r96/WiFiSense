/* ------------------------------------------------------------------ */
/* WiFiSense Lab — CSI stream source contract (Phase 3).               */
/*                                                                     */
/* Defines how telemetry reaches the UI, independent of transport:     */
/*                                                                     */
/*   CSIStreamSource                                                   */
/*     ├─ SimulationStreamSource  (active — backed by the in-process   */
/*     │                           deterministic engine tick loop)     */
/*     └─ WebSocketStreamSource   (skeleton — attaches to a real       */
/*                                 /ws/csi gateway in Phase 10/11)     */
/*                                                                     */
/* The WebSocket skeleton implements the full lifecycle (connect,      */
/* backoff reconnect, frame dispatch) but refuses to emit frames until */
/* a gateway is reachable — it never fabricates hardware data.         */
/* ------------------------------------------------------------------ */

import type { TelemetryPoint } from "../types";

export type StreamKind = "simulation" | "websocket" | "rest";

export interface CSIStreamSource {
  readonly kind: StreamKind;
  /** True while frames are actively flowing. */
  readonly connected: boolean;
  /** Human-readable transport description for the UI. */
  readonly description: string;
  start(): void;
  stop(): void;
  /** Subscribe to frames of one sensor. Returns an unsubscribe fn. */
  onFrame(sensorId: string, cb: (pt: TelemetryPoint, sensorId: string) => void): () => void;
}

/* --------------------- simulation binding ------------------------- */

import { sim } from "../state/store";

class SimulationStreamSource implements CSIStreamSource {
  readonly kind = "simulation" as const;
  private subs = new Map<string, Set<(pt: TelemetryPoint, id: string) => void>>();
  private unsubTick: (() => void) | null = null;

  get connected(): boolean {
    return sim.streaming;
  }
  get description(): string {
    return sim.streaming ? "SIM ENGINE · in-process tick loop" : "SIM ENGINE · halted";
  }

  start(): void {
    if (this.unsubTick) return;
    this.unsubTick = sim.subscribe(() => this.dispatch());
  }
  stop(): void {
    this.unsubTick?.();
    this.unsubTick = null;
  }

  onFrame(sensorId: string, cb: (pt: TelemetryPoint, id: string) => void): () => void {
    let set = this.subs.get(sensorId);
    if (!set) {
      set = new Set();
      this.subs.set(sensorId, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) this.subs.delete(sensorId);
    };
  }

  private lastSeen = new Map<string, number>();
  private dispatch(): void {
    for (const [id, set] of this.subs) {
      const s = sim.world.sensors.find((x) => x.id === id);
      if (!s || s.buffer.length === 0) continue;
      const last = s.buffer[s.buffer.length - 1];
      const seen = this.lastSeen.get(id);
      if (seen !== undefined && last.t <= seen) continue;
      this.lastSeen.set(id, last.t);
      set.forEach((cb) => cb(last, id));
    }
  }
}

/** The active stream source in simulation mode. */
export const simulationStream = new SimulationStreamSource();

/* --------------------- websocket skeleton ------------------------- */

export interface WSOptions {
  url: string;
  /** Reconnect backoff schedule, ms. */
  backoff?: number[];
}

/**
 * Real-time gateway client for `ws://<gateway>/ws/csi`.
 * Skeleton only — no WiFiSense gateway exists yet, so `start()` reports
 * "unattached" and the source stays silent instead of inventing frames.
 */
export class WebSocketStreamSource implements CSIStreamSource {
  readonly kind = "websocket" as const;
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Map<string, Set<(pt: TelemetryPoint, id: string) => void>>();
  readonly url: string;
  private backoff: number[];

  constructor(opts: WSOptions) {
    this.url = opts.url;
    this.backoff = opts.backoff ?? [500, 1000, 2000, 5000, 10000];
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  get description(): string {
    return this.connected ? `WS · ${this.url}` : "WS · unattached";
  }

  start(): void {
    this.closedByUser = false;
    this.connect();
  }
  stop(): void {
    this.closedByUser = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  onFrame(sensorId: string, cb: (pt: TelemetryPoint, id: string) => void): () => void {
    let set = this.subs.get(sensorId);
    if (!set) {
      set = new Set();
      this.subs.set(sensorId, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) this.subs.delete(sensorId);
    };
  }

  private connect(): void {
    if (this.closedByUser) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws.onopen = () => {
      this.attempt = 0;
    };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          sensor_id?: string;
          frame?: TelemetryPoint;
        };
        if (!msg.sensor_id || !msg.frame) return;
        const set = this.subs.get(msg.sensor_id);
        if (set) set.forEach((cb) => cb(msg.frame as TelemetryPoint, msg.sensor_id as string));
      } catch {
        /* malformed frame — drop, keep connection */
      }
    };
    this.ws.onclose = () => {
      if (!this.closedByUser) this.scheduleRetry();
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleRetry(): void {
    const delay = this.backoff[Math.min(this.attempt, this.backoff.length - 1)];
    this.attempt++;
    this.timer = setTimeout(() => this.connect(), delay);
  }
}
