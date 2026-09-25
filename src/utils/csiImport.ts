/* ------------------------------------------------------------------ */
/* CSI File Importer — parser core (Phase 30 deliverable).             */
/*                                                                     */
/* Formats today: CSV (WiFiSense export layout) and JSON (export       */
/* payload or plain object arrays). NPZ / binary formats are declared  */
/* but refused — an unknown binary format is never guessed at.         */
/* ------------------------------------------------------------------ */

import type { DatasetSample } from "../types";

export interface ImportParseResult {
  format: "csv" | "json" | "npz" | "unknown";
  samples: DatasetSample[];
  labels: Array<{ t: number; label: string }>;
  errors: string[];
  rows: number;
}

const num = (v: unknown, dflt: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : dflt;
};

export function parseCSIText(filename: string, text: string): ImportParseResult {
  const errors: string[] = [];
  const name = filename.toLowerCase();

  if (name.endsWith(".npz") || name.endsWith(".npy")) {
    return {
      format: "npz",
      samples: [],
      labels: [],
      errors: ["NPZ support is planned (Phase 9 Python bridge will decode it). Binary formats are never guessed."],
      rows: 0,
    };
  }

  const trimmed = text.trim();

  /* ------------------------------ JSON ---------------------------- */
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      let rows: unknown[] = [];
      let columns: string[] = [];
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as { rows?: unknown[]; columns?: string[] };
        rows = Array.isArray(obj.rows) ? obj.rows : [];
        columns = Array.isArray(obj.columns) ? obj.columns.map(String) : [];
      }
      const samples: DatasetSample[] = [];
      rows.forEach((r, i) => {
        if (Array.isArray(r) && columns.length) {
          const get = (c: string) => r[columns.indexOf(c)];
          samples.push(rowToSample(get("t_s"), get("sensor_id"), get("rssi_dbm"), get("amplitude"), get("phase_rad"), get("variance"), get("motion_score"), i));
        } else if (r && typeof r === "object") {
          const o = r as Record<string, unknown>;
          samples.push(rowToSample(o.t_s ?? o.t, o.sensor_id ?? o.sensorId, o.rssi_dbm ?? o.rssi, o.amplitude ?? o.amp, o.phase_rad ?? o.phase, o.variance, o.motion_score ?? o.score, i));
        } else {
          errors.push(`row ${i + 1}: unrecognized shape, skipped`);
        }
      });
      const good = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.amp));
      if (good.length < samples.length) errors.push(`${samples.length - good.length} rows dropped (non-numeric fields)`);
      return { format: "json", samples: good, labels: [], errors, rows: good.length };
    } catch (e) {
      return { format: "json", samples: [], labels: [], errors: [`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`], rows: 0 };
    }
  }

  /* ------------------------------ CSV ----------------------------- */
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { format: "unknown", samples: [], labels: [], errors: ["File has no data rows"], rows: 0 };
  }
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (c: string) => header.indexOf(c);
  if (idx("t_s") < 0 || idx("amplitude") < 0) {
    return {
      format: "csv",
      samples: [],
      labels: [],
      errors: [`CSV header must contain at least t_s and amplitude (found: ${header.slice(0, 8).join(", ")}${header.length > 8 ? "…" : ""})`],
      rows: 0,
    };
  }
  const samples: DatasetSample[] = [];
  const labels: Array<{ t: number; label: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#")) {
      const m = line.match(/^# label @ ([\d.]+)s :: (.+)$/);
      if (m) labels.push({ t: parseFloat(m[1]), label: m[2].trim() });
      continue;
    }
    const cols = line.split(",");
    const get = (c: string) => (idx(c) >= 0 ? cols[idx(c)] : undefined);
    samples.push(rowToSample(get("t_s"), get("sensor_id"), get("rssi_dbm"), get("amplitude"), get("phase_rad"), get("variance"), get("motion_score"), i - 1));
  }
  const good = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.amp));
  if (good.length < samples.length) errors.push(`${samples.length - good.length} rows dropped (non-numeric fields)`);
  return { format: "csv", samples: good, labels, errors, rows: good.length };
}

function rowToSample(
  t: unknown,
  sensorId: unknown,
  rssi: unknown,
  amp: unknown,
  phase: unknown,
  variance: unknown,
  score: unknown,
  rowIdx: number,
): DatasetSample {
  return {
    t: num(t, NaN),
    sensorId: sensorId ? String(sensorId) : "imported",
    rssi: num(rssi, -60),
    amp: num(amp, NaN),
    phase: num(phase, 0),
    variance: num(variance, 0),
    score: num(score, 0),
  };
}
