/* ------------------------------------------------------------------ */
/* WiFiSense Lab — in-browser self-test harness (Phase 3).             */
/*                                                                     */
/* Pure-function assertions over the deterministic engine, signal      */
/* filters, exporters, repository and fleet management. Runs at boot   */
/* and on demand; results are written to System Logs. The store is     */
/* injected as a parameter so this module stays import-cycle-free.     */
/* ------------------------------------------------------------------ */

import {
  advanceTick,
  applyFleetConfigs,
  BUFFER_CAP,
  configsFromFleet,
  createWorld,
} from "../simulation/engine";
import { sensorRepo } from "../services/sensorRepo";
import {
  buildMeta,
  toCSV,
  toJSON,
} from "../utils/exporter";
import { frameRate, lowPass, movingAverage, varianceOf } from "../utils/signal";
import type { SensorInput, SimConfig, SimWorld, TelemetryPoint } from "../types";

export interface TestResult {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export type StoreActionResult = { ok: true; id: string } | { ok: false; error: string };

/** Minimal store surface needed by fleet-level tests (injected, no import). */
export interface StoreUnderTest {
  addSensor(input: SensorInput): StoreActionResult;
  removeSensor(id: string): StoreActionResult;
  hasSensor(id: string): boolean;
  getSeed(): number;
  rebuild(patch: Partial<Pick<SimConfig, "seed" | "sensorCount" | "sampleRate" | "subcarriers">>): void;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function testCfg(over: Partial<SimConfig> = {}): SimConfig {
  return {
    running: true,
    seed: 4242,
    noise: 0.25,
    motionIntensity: 0.8,
    people: 2,
    sensorCount: 4,
    sampleRate: 100,
    subcarriers: 30,
    ...over,
  };
}

function tickN(w: SimWorld, cfg: SimConfig, n: number): void {
  for (let i = 0; i < n; i++) advanceTick(w, cfg);
}

function bufEqual(a: TelemetryPoint[], b: TelemetryPoint[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      Math.abs(a[i].t - b[i].t) > 1e-9 ||
      Math.abs(a[i].amp - b[i].amp) > 1e-9 ||
      Math.abs(a[i].phase - b[i].phase) > 1e-9 ||
      Math.abs(a[i].rssi - b[i].rssi) > 1e-9 ||
      Math.abs(a[i].variance - b[i].variance) > 1e-12 ||
      Math.abs(a[i].score - b[i].score) > 1e-9
    )
      return false;
  }
  return true;
}

const CASES: Array<[string, (store: StoreUnderTest) => void]> = [
  [
    "engine · seeded determinism (200 ticks)",
    () => {
      const cfg = testCfg();
      const w1 = createWorld(cfg);
      const w2 = createWorld(cfg);
      tickN(w1, cfg, 200);
      tickN(w2, cfg, 200);
      assert(bufEqual(w1.sensors[0].buffer, w2.sensors[0].buffer), "sensor 1 buffers diverged");
      assert(w1.sensors[0].specHist.length === w2.sensors[0].specHist.length, "specHist length diverged");
    },
  ],
  [
    "engine · numeric bounds & buffer caps (950 ticks)",
    () => {
      const cfg = testCfg();
      const w = createWorld(cfg);
      tickN(w, cfg, 950);
      for (const s of w.sensors) {
        assert(s.buffer.length <= BUFFER_CAP, `${s.id} buffer exceeded cap`);
        assert(s.specHist.length <= BUFFER_CAP, `${s.id} specHist exceeded cap`);
        assert(s.buffer.length === s.specHist.length, `${s.id} buffer/specHist misaligned`);
        assert(s.motionScore >= 0 && s.motionScore <= 1, `${s.id} motion score out of [0,1]`);
        assert(Number.isFinite(s.rssi) && s.rssi > -120 && s.rssi < 0, `${s.id} RSSI implausible`);
        for (let sc = 0; sc < s.spectrum.length; sc++) {
          assert(Number.isFinite(s.spectrum[sc]) && s.spectrum[sc] > 0 && s.spectrum[sc] < 5, `${s.id} spectrum[${sc}] out of range`);
        }
      }
    },
  ],
  [
    "engine · motion score tracks human activity",
    () => {
      const cfgBusy = testCfg({ people: 4, motionIntensity: 1, noise: 0.1 });
      const cfgEmpty = testCfg({ people: 0, motionIntensity: 1, noise: 0.1 });
      const wBusy = createWorld(cfgBusy);
      const wEmpty = createWorld(cfgEmpty);
      tickN(wBusy, cfgBusy, 400);
      tickN(wEmpty, cfgEmpty, 400);
      const mean = (w: SimWorld) => {
        let s = 0;
        const b = w.sensors[0].buffer.slice(-250);
        for (const p of b) s += p.score;
        return s / b.length;
      };
      const busy = mean(wBusy);
      const empty = mean(wEmpty);
      assert(busy > empty + 0.05, `occupied-room mean score ${busy.toFixed(3)} not above empty-room ${empty.toFixed(3)}`);
    },
  ],
  [
    "signal · moving average correctness",
    () => {
      const data = Array.from({ length: 10 }, (_, i) => ({ t: i, v: i + 1 }));
      const out = movingAverage(data, 3);
      assert(out.length === 10, "length changed");
      assert(Math.abs(out[1].v - 2) < 1e-9, `out[1] = ${out[1].v}, expected 2`);
      assert(Math.abs(out[9].v - 9) < 1e-9, `out[9] = ${out[9].v}, expected 9`);
      const flat = movingAverage(data.map((p) => ({ t: p.t, v: 5 })), 7);
      assert(flat.every((p) => Math.abs(p.v - 5) < 1e-9), "constant signal distorted");
    },
  ],
  [
    "signal · low-pass attenuates variance, preserves DC",
    () => {
      const noisy = Array.from({ length: 200 }, (_, i) => ({
        t: i * 0.1,
        v: 1 + (i % 2 === 0 ? 0.5 : -0.5),
      }));
      const out = lowPass(noisy, 0.15);
      const vIn = varianceOf(noisy.map((p) => p.v));
      const vOut = varianceOf(out.map((p) => p.v));
      assert(vOut < vIn * 0.5, `variance not reduced (${vOut.toFixed(3)} vs ${vIn.toFixed(3)})`);
      assert(Math.abs(out[out.length - 1].v - 1) < 0.1, "DC level not preserved");
    },
  ],
  [
    "signal · frame-rate estimator",
    () => {
      const times = Array.from({ length: 51 }, (_, i) => i * 0.1);
      const r = frameRate(times, 5);
      assert(Math.abs(r - 10) < 0.6, `expected ~10 fps, got ${r.toFixed(2)}`);
    },
  ],
  [
    "export · CSV structure round-trip",
    () => {
      const buf: TelemetryPoint[] = Array.from({ length: 25 }, (_, i) => ({
        t: i * 0.1,
        amp: 0.8 + 0.01 * i,
        phase: 0.3 * i,
        rssi: -50 - i * 0.2,
        variance: 0.002 + i * 1e-5,
        score: Math.min(1, i / 30),
      }));
      const csv = toCSV(buf);
      const lines = csv.split("\n");
      assert(lines.length === 26, `expected 26 lines, got ${lines.length}`);
      assert(lines[0] === "t_s,amplitude,phase_rad,rssi_dbm,variance,motion_score", "header mismatch");
      assert(lines[1].split(",").length === 6, "column count mismatch");
    },
  ],
  [
    "export · JSON payload carries provenance",
    () => {
      const cfg = testCfg();
      const w = createWorld(cfg);
      const meta = buildMeta(w.sensors[0], cfg, "simulation");
      const json = toJSON(meta, w.sensors[0].buffer);
      const parsed = JSON.parse(json) as { meta: { source: string; provenance: string }; rows: unknown[] };
      assert(parsed.meta.source === "simulation", "source field wrong");
      assert(/SYNTHETIC/i.test(parsed.meta.provenance), "provenance not explicit");
      assert(parsed.rows.length === w.sensors[0].buffer.length, "row count mismatch");
    },
  ],
  [
    "repo · persistence round-trip with defensive validation",
    () => {
      const before = sensorRepo.load();
      const good = {
        id: "selftest-ok",
        name: "SelfTest Row",
        roomId: "room-1",
        ip: "10.0.10.240",
        mac: "AA:BB:CC:00:11:99",
        channel: 6,
        band: "2.4 GHz" as const,
        hardware: "ESP32-S3",
        firmware: "v0.9.2-sim",
        sampleRate: 100,
        transport: "udp" as const,
        enabled: true,
        custom: true,
      };
      // Malformed row: non-string id must be dropped by the defensive load.
      const bad = { id: 42, name: "Bad Row", roomId: "room-1" } as unknown as typeof good;
      sensorRepo.save([...(before ?? []), good, bad]);
      const after = sensorRepo.load() ?? [];
      assert(after.some((r) => r.id === "selftest-ok"), "valid row lost in round-trip");
      assert(!after.some((r) => (r.id as unknown) === 42), "malformed row survived defensive validation");
      // Restore previous state exactly (empty array ⇒ store re-seeds defaults).
      sensorRepo.save(before ?? []);
    },
  ],
  [
    "fleet · disabled node stays offline, enable restores",
    () => {
      const cfg = testCfg();
      const w = createWorld(cfg);
      const configs = configsFromFleet(w);
      configs[0].enabled = false;
      applyFleetConfigs(w, cfg, configs);
      tickN(w, cfg, 150);
      assert(!w.sensors[0].online, "disabled node auto-recovered");
      configs[0].enabled = true;
      applyFleetConfigs(w, cfg, configs);
      assert(w.sensors[0].online, "enabled node did not restore");
    },
  ],
  [
    "fleet · room reassignment updates membership",
    () => {
      const cfg = testCfg();
      const w = createWorld(cfg);
      const configs = configsFromFleet(w);
      const target = w.rooms.find((r) => r.id !== configs[0].roomId);
      assert(!!target, "no alternate room");
      configs[0].roomId = target!.id;
      applyFleetConfigs(w, cfg, configs);
      assert(target!.sensorIds.includes(configs[0].id), "target room missing sensor");
      assert(w.sensors[0].roomName === target!.name, "sensor roomName not synced");
    },
  ],
  [
    "store · custom node survives deterministic rebuild",
    (store) => {
      const res = store.addSensor({
        name: "SelfTest Node",
        roomId: "room-2",
        ip: "10.0.10.201",
        mac: "DE:AD:BE:EF:00:42",
        channel: 36,
        band: "5 GHz",
        hardware: "ESP32-S3",
        firmware: "v0.9.2-sim",
        sampleRate: 100,
        transport: "udp",
        enabled: true,
      });
      assert(res.ok, `addSensor rejected: ${res.ok ? "" : res.error}`);
      const id = res.ok ? res.id : "";
      const seed0 = store.getSeed();
      store.rebuild({ seed: 777 });
      assert(store.hasSensor(id), "custom node lost after rebuild");
      store.removeSensor(id);
      store.rebuild({ seed: 4242 });
      assert(!store.hasSensor(id), "removed node reappeared");
      // Restore the operator's engine state exactly.
      store.rebuild({ seed: seed0 });
    },
  ],
];

export function runSelfTests(store: StoreUnderTest): TestResult[] {
  return CASES.map(([name, fn]) => {
    const t0 = performance.now();
    try {
      fn(store);
      return { name, ok: true, ms: +(performance.now() - t0).toFixed(1) };
    } catch (e) {
      return { name, ok: false, ms: +(performance.now() - t0).toFixed(1), error: e instanceof Error ? e.message : String(e) };
    }
  });
}
