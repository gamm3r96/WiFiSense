import { useRef, useState } from "react";
import { parseCSIText, type ImportParseResult } from "../utils/csiImport";
import { sim } from "../state/store";
import type { DatasetMeta, DatasetSample } from "../types";
import { Chip, Icon } from "./ui";

/**
 * CSI File Importer (Phase 30). Parses CSV / JSON exports; NPZ and
 * unknown binary formats are declared and refused, never guessed.
 */
export default function CsiImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [result, setResult] = useState<ImportParseResult | null>(null);
  const [pending, setPending] = useState<{ samples: DatasetSample[]; name: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setDone(null);
    setFile({ name: f.name, size: f.size });
    const text = await f.text();
    const res = parseCSIText(f.name, text);
    setResult(res);
    setPending(res.samples.length > 0 ? { samples: res.samples, name: f.name } : null);
  };

  const doImport = () => {
    if (!pending) return;
    const sensorId = pending.samples[0]?.sensorId ?? "imported";
    const meta: DatasetMeta = {
      id: `imp_${Date.now().toString(36)}`,
      name: pending.name.replace(/\.[^.]+$/, "").slice(0, 48) || "imported",
      category: "other",
      sensorId,
      sensorName: sensorId,
      roomId: "",
      roomName: "",
      subject: "",
      notes: "IMPORTED FILE — original provenance unknown; treat as UNVERIFIED",
      createdAt: Date.now(),
      startedAtSim: pending.samples[0]?.t ?? 0,
      stoppedAtSim: pending.samples[pending.samples.length - 1]?.t ?? 0,
      status: "complete",
      frames: pending.samples.length,
      labels: result?.labels ?? [],
      sizeBytes: file?.size ?? 0,
      source: "simulation",
      seed: 0,
      sampleRateHz: 0,
    };
    const id = sim.importDataset({ meta, samples: pending.samples });
    setDone(`Imported ${pending.samples.length} frames as “${meta.name}” (${id})`);
    setPending(null);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <Icon name="database" size={15} className="text-cyan" />
        <span className="panel-title">CSI File Importer</span>
        <span className="mono ml-auto hidden text-[10px] text-faint sm:block">CSV · JSON · (NPZ planned)</span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,.txt,.npz"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            className="btn w-full !py-4"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Icon name="download" size={14} className="rotate-180" />
            Choose or drop a CSI file
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Accepts WiFiSense CSV/JSON exports. Unknown binary formats are <span className="text-amber">refused</span> — the parser never
            guesses a layout. Imported rows are flagged as unverified.
          </p>
        </div>

        <div className="min-h-[90px] rounded border border-line bg-raise/40 p-3">
          {!result && !done && <div className="mono pt-6 text-center text-[11px] text-faint">PARSER IDLE</div>}
          {done && (
            <div className="flex items-center gap-2 text-[12.5px] text-acc">
              <Icon name="zap" size={14} /> {done}
            </div>
          )}
          {result && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[11.5px] text-txt">{file?.name}</span>
                <Chip tone={result.format === "unknown" ? "red" : result.format === "npz" ? "amber" : "cyan"}>
                  {result.format.toUpperCase()}
                </Chip>
                <Chip tone={result.samples.length > 0 ? "acc" : "dim"}>{result.rows} rows</Chip>
                {file && <span className="mono text-[10px] text-faint">{(file.size / 1024).toFixed(1)} kB</span>}
              </div>
              {result.labels.length > 0 && (
                <div className="mono text-[10.5px] text-dim">{result.labels.length} label markers recovered</div>
              )}
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber">
                  <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {e}
                </div>
              ))}
              {pending && (
                <button className="btn btn-acc mt-1 !py-1.5" onClick={doImport}>
                  <Icon name="database" size={12} /> Import as dataset
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
