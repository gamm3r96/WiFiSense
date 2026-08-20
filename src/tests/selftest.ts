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
import {
  applyFilter,
  energy,
  highPass,
  medianFilter,
  normalize,
  peakFrequency,
  spectrum,
  stdDev,
  unwrapPhase,
  variance as dspVariance,
} from "../processing/dsp";
import {
  detectMotion,
  estimateBaseline,
  MotionDetector,
  type DetectorInput,
} from "../processing/detectors";
import {
  computeSensorStats,
  emptyAssessment,
  isPresence,
  OCC_THRESHOLDS,
  spectralDeviation,
  stepOccupancy,
  type StepInput,
} from "../processing/occupancy";
import { mulberry32 } from "../simulation/rng";
import { datasetRepo } from "../services/datasetRepo";
import { datasetToCSV, datasetToJSON } from "../utils/exporter";
import type {
  DatasetMeta,
  DatasetSample,
  SensorInput,
  SimConfig,
  SimWorld,
  TelemetryPoint,
} from "../types";

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
  /** Recorder guard: stopping with no active recording must fail cleanly. */
  stopRecording(): { ok: boolean; id?: string; error?: string };
}

/* ---------------------- dataset test helpers ----------------------- */

function mkSamples(n: number, sensorId = "ESP32-S3-001"): DatasetSample[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i * 0.1,
    sensorId,
    rssi: -50 - (i % 5),
    amp: 0.8 + 0.05 * Math.sin(i * 0.3),
    phase: 0.2 * i,
    variance: 0.002 + (i % 3) * 1e-4,
    score: Math.min(1, i / n),
  }));
}

function mkMeta(id: string, frames: number, labels: DatasetMeta["labels"] = []): DatasetMeta {
  return {
    id,
    name: `walking_test_${id}`,
    category: "walking",
    sensorId: "ESP32-S3-001",
    sensorName: "ESP32-S3-001",
    roomId: "room-1",
    roomName: "Lab A",
    subject: "Self-test subject",
    notes: "synthetic",
    createdAt: Date.now(),
    startedAtSim: 0,
    stoppedAtSim: frames * 0.1,
    status: "complete",
    frames,
    labels,
    sizeBytes: frames * 60,
    source: "simulation",
    seed: 4242,
    sampleRateHz: 100,
  };
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
    "dsp · median filter removes impulse noise",
    () => {
      const clean = Array.from({ length: 40 }, (_, i) => Math.sin(i * 0.3));
      const noisy = clean.slice();
      noisy[10] += 50;
      noisy[25] -= 40;
      const out = medianFilter(noisy, 5);
      assert(Math.abs(out[10] - clean[10]) < 2, `impulse at 10 not suppressed (${out[10].toFixed(2)})`);
      assert(Math.abs(out[25] - clean[25]) < 2, `impulse at 25 not suppressed (${out[25].toFixed(2)})`);
    },
  ],
  [
    "dsp · high-pass removes DC offset",
    () => {
      const dc = Array.from({ length: 300 }, () => 5);
      const out = highPass(dc, 0.2);
      const tail = out.slice(-50);
      const m = tail.reduce((a, b) => a + b, 0) / tail.length;
      assert(Math.abs(m) < 0.5, `DC not removed (residual mean ${m.toFixed(3)})`);
    },
  ],
  [
    "dsp · phase unwrap removes 2π discontinuities",
    () => {
      const wrapped = Array.from({ length: 100 }, (_, i) => {
        const p = i * 0.25;
        return ((p + Math.PI) % (2 * Math.PI)) - Math.PI; // wrap to (−π, π]
      });
      const out = unwrapPhase(wrapped);
      let maxJump = 0;
      for (let i = 1; i < out.length; i++) maxJump = Math.max(maxJump, Math.abs(out[i] - out[i - 1]));
      assert(maxJump < Math.PI, `unwrap left a jump of ${maxJump.toFixed(2)} rad`);
    },
  ],
  [
    "dsp · FFT peak frequency of a known tone",
    () => {
      const fs = 100; // Hz
      const f0 = 7; // Hz
      const n = 512;
      const sig = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f0 * i) / fs));
      const spec = spectrum(sig, fs);
      const pk = peakFrequency(spec);
      assert(Math.abs(pk - f0) < 0.5, `peak ${pk.toFixed(2)} Hz, expected ~${f0} Hz`);
    },
  ],
  [
    "dsp · normalisation maps to [0,1] and handles flat input",
    () => {
      const v = [3, 1, 4, 1, 5, 9, 2, 6];
      const out = normalize(v);
      assert(Math.min(...out) === 0 && Math.max(...out) === 1, "range not [0,1]");
      const flat = normalize([2, 2, 2]);
      assert(flat.every((x) => Math.abs(x - 0.5) < 1e-9), "flat input not mapped to 0.5");
    },
  ],
  [
    "dsp · feature stats are internally consistent",
    () => {
      const v = Array.from({ length: 200 }, (_, i) => 2 + Math.sin(i * 0.2));
      assert(Math.abs(stdDev(v) - Math.sqrt(dspVariance(v))) < 1e-12, "stdDev ≠ √variance");
      assert(energy(v) > 0, "energy must be positive");
      const f = applyFilter(v, { kind: "movingAverage", window: 7 });
      assert(f.length === v.length, "filter changed length");
    },
  ],
  [
    "detector · quiescent signal reports no motion",
    () => {
      const pts: DetectorInput[] = Array.from({ length: 60 }, (_, i) => ({
        t: i * 0.1,
        amp: 1,
        variance: 0.001,
      }));
      const r = detectMotion(pts, { threshold: 0.4, windowTicks: 20, sensitivity: 1.2 }, null);
      assert(!r.motion, "flat signal flagged as motion");
      assert(r.score < 0.1, `flat-signal score ${r.score.toFixed(3)} too high`);
    },
  ],
  [
    "detector · oscillation above threshold triggers motion",
    () => {
      const pts: DetectorInput[] = Array.from({ length: 80 }, (_, i) => ({
        t: i * 0.1,
        amp: 1 + 0.2 * Math.sin(2 * Math.PI * 0.4 * i * 0.1),
        variance: 0.01,
      }));
      const r = detectMotion(pts, { threshold: 0.4, windowTicks: 20, sensitivity: 1.2 }, null);
      assert(r.motion, "strong oscillation not detected");
      assert(r.score >= 0.4, `score ${r.score.toFixed(3)} below threshold`);
    },
  ],
  [
    "detector · noise at baseline level stays quiet",
    () => {
      const rng = mulberry32(1234);
      const gauss = () => (rng() + rng() + rng() + rng() - 2) / 2;
      const pts: DetectorInput[] = Array.from({ length: 160 }, (_, i) => ({
        t: i * 0.1,
        amp: 1 + 0.03 * Math.sin(2 * Math.PI * 0.2 * i * 0.1) + 0.02 * gauss(),
        variance: 0.002 + 0.001 * gauss(),
      }));
      const baseline = estimateBaseline(pts.slice(0, 80), 8);
      const r = detectMotion(pts.slice(80), { threshold: 0.4, windowTicks: 20, sensitivity: 1.2 }, baseline);
      assert(r.baselineUsed, "baseline not used");
      assert(!r.motion, `baseline-level noise flagged as motion (score ${r.score.toFixed(3)})`);
    },
  ],
  [
    "detector · step change produces motion via deviation + temporal spike",
    () => {
      const flat: DetectorInput[] = Array.from({ length: 60 }, (_, i) => ({ t: i * 0.1, amp: 1, variance: 0.001 }));
      const baseline = estimateBaseline(flat, 6);
      const stepped: DetectorInput[] = [
        ...flat.slice(-20),
        ...Array.from({ length: 30 }, (_, i) => ({ t: (i + 60) * 0.1, amp: 1.25, variance: 0.004 })),
      ];
      const r = detectMotion(stepped, { threshold: 0.4, windowTicks: 20, sensitivity: 1.2 }, baseline);
      assert(r.motion, "mean step not detected");
      assert(r.components.amplitudeDev > 0.5, `amplitude-dev component weak (${r.components.amplitudeDev.toFixed(2)})`);
    },
  ],
  [
    "detector · higher threshold never increases detections",
    () => {
      const rng = mulberry32(99);
      const pts: DetectorInput[] = Array.from({ length: 200 }, (_, i) => ({
        t: i * 0.1,
        amp: 1 + (i > 60 && i < 130 ? 0.18 * Math.sin(2 * Math.PI * 0.5 * i * 0.1) : 0) + 0.015 * (rng() - 0.5),
        variance: 0.002,
      }));
      const count = (th: number) => {
        const d = new MotionDetector({ threshold: th, windowTicks: 15, sensitivity: 1.2 }, null);
        let n = 0;
        for (let i = 10; i <= pts.length; i++) if (d.feed(pts.slice(0, i)).motion) n++;
        return n;
      };
      const c2 = count(0.2);
      const c5 = count(0.5);
      const c8 = count(0.8);
      assert(c2 >= c5 && c5 >= c8, `detections not monotonic in threshold (${c2}, ${c5}, ${c8})`);
    },
  ],
  [
    "detector · hysteresis suppresses flapping near the threshold",
    () => {
      const d = new MotionDetector({ threshold: 0.4, windowTicks: 10, sensitivity: 1 }, null);
      const scores = [0.5, 0.36, 0.39, 0.33, 0.36, 0.5];
      let roses = 0;
      let naiveCrossings = 0;
      let prevAbove = false;
      for (const s of scores) {
        if (d.evaluate(s).rose) roses++;
        const above = s >= 0.4;
        if (above && !prevAbove) naiveCrossings++;
        prevAbove = above;
      }
      assert(roses < naiveCrossings, `hysteresis did not reduce toggles (roses ${roses} vs naive ${naiveCrossings})`);
      assert(d.active, "detector should be active after final score 0.5");
    },
  ],
  [
    "occupancy · no baseline yields UNKNOWN",
    () => {
      const input: StepInput = {
        t: 1, sensorsOnline: true, hasBaseline: false, spectral: 0.5, rssiScore: 0.5,
        motionScore: 0.5, motionThresh: 0.4, baselineFrames: 0, coverage: 0,
      };
      const a = stepOccupancy(null, input);
      assert(a.state === "UNKNOWN", `expected UNKNOWN, got ${a.state}`);
      assert(a.confidence === 0, "UNKNOWN must carry zero confidence");
    },
  ],
  [
    "occupancy · quiet room settles to EMPTY after confirmation",
    () => {
      let a = emptyAssessment();
      const input: StepInput = {
        t: 0, sensorsOnline: true, hasBaseline: true, spectral: 0.02, rssiScore: 0.02,
        motionScore: 0.05, motionThresh: 0.4, baselineFrames: 100, coverage: 1,
      };
      for (let i = 0; i < OCC_THRESHOLDS.emptyConfirm + 5; i++) {
        a = stepOccupancy(a, { ...input, t: i * 0.1 });
      }
      assert(a.state === "EMPTY", `expected EMPTY, got ${a.state}`);
      assert(!isPresence(a.state), "EMPTY must not count as presence");
    },
  ],
  [
    "occupancy · high deviation with motion becomes MOTION",
    () => {
      let a = emptyAssessment();
      const input: StepInput = {
        t: 0, sensorsOnline: true, hasBaseline: true, spectral: 0.6, rssiScore: 0.4,
        motionScore: 0.7, motionThresh: 0.4, baselineFrames: 100, coverage: 1,
      };
      for (let i = 0; i < OCC_THRESHOLDS.occupyConfirm + 3; i++) {
        a = stepOccupancy(a, { ...input, t: i * 0.1 });
      }
      assert(a.state === "MOTION", `expected MOTION, got ${a.state}`);
      assert(isPresence(a.state), "MOTION must count as presence");
    },
  ],
  [
    "occupancy · high deviation without motion becomes STATIONARY",
    () => {
      let a = emptyAssessment();
      const input: StepInput = {
        t: 0, sensorsOnline: true, hasBaseline: true, spectral: 0.6, rssiScore: 0.4,
        motionScore: 0.1, motionThresh: 0.4, baselineFrames: 100, coverage: 1,
      };
      for (let i = 0; i < OCC_THRESHOLDS.stationaryConfirm + OCC_THRESHOLDS.occupyConfirm + 5; i++) {
        a = stepOccupancy(a, { ...input, t: i * 0.1 });
      }
      assert(a.state === "STATIONARY", `expected STATIONARY, got ${a.state}`);
      assert(isPresence(a.state), "STATIONARY must count as presence");
    },
  ],
  [
    "occupancy · computeSensorStats recovers mean and σ",
    () => {
      const frames = [
        new Float64Array([1, 2]),
        new Float64Array([3, 4]),
        new Float64Array([2, 3]),
      ];
      const stats = computeSensorStats(frames, 2);
      assert(Math.abs(stats.mean[0] - 2) < 1e-9, `mean[0] = ${stats.mean[0]}`);
      assert(Math.abs(stats.mean[1] - 3) < 1e-9, `mean[1] = ${stats.mean[1]}`);
      assert(stats.sd[0] > 0 && stats.sd[1] > 0, "σ must be positive for spread data");
      assert(stats.frames === 3, "frame count wrong");
    },
  ],
  [
    "occupancy · spectralDeviation is zero for the baseline itself",
    () => {
      const stats = { mean: [0.5, 0.7, 0.6], sd: [0.05, 0.04, 0.06], frames: 50 };
      const d = spectralDeviation(new Float64Array([0.5, 0.7, 0.6]), stats);
      assert(d < 1e-9, `self-deviation must be ~0, got ${d}`);
      const shifted = spectralDeviation(new Float64Array([0.9, 0.2, 0.95]), stats);
      assert(shifted > 0.5, `large shift must give high deviation, got ${shifted}`);
    },
  ],
  [
    "dataset · repository save/load/remove round-trip",
    () => {
      const id = "selftest-ds-roundtrip";
      const samples = mkSamples(40);
      const meta = mkMeta(id, samples.length, [{ t: 1.2, label: "wave start" }]);
      datasetRepo.save({ meta, samples });
      const loaded = datasetRepo.load(id);
      assert(!!loaded, "saved dataset not retrievable");
      assert(loaded!.samples.length === 40, `expected 40 samples, got ${loaded!.samples.length}`);
      assert(loaded!.meta.labels.length === 1, "label not persisted");
      assert(datasetRepo.loadIndex().some((m) => m.id === id), "index missing saved dataset");
      datasetRepo.remove(id);
      assert(datasetRepo.load(id) === null, "dataset still present after remove");
      assert(!datasetRepo.loadIndex().some((m) => m.id === id), "index still lists removed dataset");
    },
  ],
  [
    "dataset · CSV export has header, rows and label comments",
    () => {
      const samples = mkSamples(25);
      const meta = mkMeta("selftest-ds-csv", 25, [{ t: 0.5, label: "enter" }, { t: 1.5, label: "exit" }]);
      const csv = datasetToCSV(meta, samples);
      const lines = csv.split("\n");
      assert(lines[0] === "t_s,sensor_id,rssi_dbm,amplitude,phase_rad,variance,motion_score", "CSV header mismatch");
      const dataRows = lines.filter((l) => !l.startsWith("#"));
      assert(dataRows.length === 26, `expected 26 non-comment lines, got ${dataRows.length}`);
      const labelRows = lines.filter((l) => l.startsWith("# label"));
      assert(labelRows.length === 2, `expected 2 label comments, got ${labelRows.length}`);
    },
  ],
  [
    "dataset · JSON export carries provenance and aligned rows/labels",
    () => {
      const samples = mkSamples(30);
      const meta = mkMeta("selftest-ds-json", 30, [{ t: 1.0, label: "mark" }]);
      const parsed = JSON.parse(datasetToJSON(meta, samples)) as {
        meta: { source: string; provenance: string };
        rows: unknown[];
        labels: unknown[];
      };
      assert(parsed.meta.source === "simulation", "source field wrong");
      assert(/SYNTHETIC/i.test(parsed.meta.provenance), "provenance not explicit");
      assert(parsed.rows.length === 30, "row count mismatch");
      assert(parsed.labels.length === 1, "label count mismatch");
    },
  ],
  [
    "recorder · stopping with no active recording fails cleanly",
    (store) => {
      const r = store.stopRecording();
      assert(!r.ok, "stopRecording should fail when nothing is recording");
      assert(typeof r.error === "string" && r.error.length > 0, "expected an error message");
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
