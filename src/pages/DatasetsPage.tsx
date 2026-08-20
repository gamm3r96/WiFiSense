import { useEffect, useMemo, useState } from "react";
import CaptureChart from "../charts/CaptureChart";
import { Chip, Dot, Icon, Sparkline, type Tone } from "../components/ui";
import { ConfirmModal, ModalShell } from "../components/sensorModals";
import { sim, useSim } from "../state/store";
import type { DatasetCategory, DatasetMeta } from "../types";
import {
  datasetToCSV,
  datasetToJSON,
  downloadText,
  sanitizeFilename,
} from "../utils/exporter";

const CATEGORIES: DatasetCategory[] = [
  "empty", "standing", "walking", "sitting", "lying", "waving", "entering", "leaving", "other",
];

const CAT_TONE: Record<DatasetCategory, Tone> = {
  empty: "dim",
  standing: "amber",
  walking: "acc",
  sitting: "cyan",
  lying: "blue",
  waving: "amber",
  entering: "blue",
  leaving: "red",
  other: "dim",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function DatasetsPage() {
  const world = useSim();
  const rec = sim.recording;

  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [labelText, setLabelText] = useState("");
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | DatasetCategory>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "frames" | "size">("newest");
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2800);
    return () => clearTimeout(id);
  }, [flash]);

  const onlineSensors = world.sensors.filter((s) => s.online && s.enabled);
  const isSim = sim.mode === "simulation";
  const srcLabel = isSim ? `SIMULATED CSI · SEED ${sim.cfg.seed}` : "NO SOURCE · LIVE MODE";

  const elapsed =
    rec.active && rec.startedAtSim !== null ? Math.max(0, world.simTime - rec.startedAtSim) : 0;

  const canStart =
    isSim && sim.cfg.running && onlineSensors.length > 0 && !!rec.sensorId;

  const onStart = () => {
    const r = sim.startRecording(subject, notes);
    setFlash(r.ok ? "● Recording started" : `⚠ ${r.error}`);
  };
  const onStop = () => {
    const frames = sim.getRecordingSamples().length;
    const r = sim.stopRecording();
    if (r.ok) {
      setFlash(`■ Saved · ${frames} frames`);
      setSubject("");
      setNotes("");
    } else setFlash(`⚠ ${r.error}`);
  };
  const onAddLabel = () => {
    if (!labelText.trim()) return;
    sim.addRecordingLabel(labelText);
    setLabelText("");
    setFlash(`◆ Label marker added`);
  };

  const filtered = useMemo(() => {
    let list = [...sim.datasets];
    if (catFilter !== "all") list = list.filter((d) => d.category === catFilter);
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          d.sensorName.toLowerCase().includes(q) ||
          d.roomName.toLowerCase().includes(q),
      );
    switch (sortBy) {
      case "newest": list.sort((a, b) => b.createdAt - a.createdAt); break;
      case "oldest": list.sort((a, b) => a.createdAt - b.createdAt); break;
      case "frames": list.sort((a, b) => b.frames - a.frames); break;
      case "size": list.sort((a, b) => b.sizeBytes - a.sizeBytes); break;
    }
    return list;
  }, [world.tickIndex, catFilter, query, sortBy]);

  const totalFrames = sim.datasets.reduce((a, d) => a + d.frames, 0);
  const totalBytes = sim.datasets.reduce((a, d) => a + d.sizeBytes, 0);

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Datasets</h1>
          <p className="text-[12px] text-dim">Record, label, browse and export CSI capture sessions.</p>
        </div>
        <div className="mono ml-auto text-[11px] text-faint">
          {sim.datasets.length} DATASETS · {totalFrames.toLocaleString()} FRAMES · {formatBytes(totalBytes)}
        </div>
      </header>

      {flash && (
        <div className="mono fade-up rounded border border-line2 bg-raise/70 px-3 py-1.5 text-[11.5px] text-txt">
          {flash}
        </div>
      )}

      {/* ------------------------- recorder deck ------------------------ */}
      <div className="grid grid-cols-12 gap-3">
        <section className="panel col-span-12 xl:col-span-5">
          <div className="panel-head">
            <span className="panel-title">Recorder</span>
            <Chip tone={rec.active ? (rec.paused ? "amber" : "red") : "dim"}>
              <Dot tone={rec.active ? (rec.paused ? "amber" : "red") : "dim"} pulse={rec.active && !rec.paused} size={6} />
              {rec.active ? (rec.paused ? "PAUSED" : "RECORDING") : "IDLE"}
            </Chip>
          </div>

          <div className="space-y-3.5 p-4">
            {/* transport row */}
            <div className="flex items-center gap-2">
              {!rec.active ? (
                <button className="btn btn-acc flex-1" onClick={onStart} disabled={!canStart}>
                  <Icon name="record" size={14} /> Record
                </button>
              ) : (
                <>
                  {rec.paused ? (
                    <button className="btn btn-acc flex-1" onClick={() => { sim.resumeRecording(); setFlash("● Resumed"); }}>
                      <Icon name="play" size={13} /> Resume
                    </button>
                  ) : (
                    <button className="btn btn-amber flex-1" onClick={() => { sim.pauseRecording(); setFlash("‖ Paused"); }}>
                      <Icon name="pause" size={13} /> Pause
                    </button>
                  )}
                  <button className="btn flex-1 hover:!border-red/60 hover:!text-red" onClick={onStop}>
                    <Icon name="stop" size={13} /> Stop & Save
                  </button>
                </>
              )}
            </div>
            {!canStart && !rec.active && (
              <p className="mono text-[10.5px] leading-relaxed text-amber">
                {isSim
                  ? sim.cfg.running
                    ? "NO ONLINE SENSOR SELECTED"
                    : "SIMULATION HALTED — START IT IN SETTINGS"
                  : "NO LIVE CSI SOURCE CONNECTED"}
              </p>
            )}

            {/* counters */}
            <div className="grid grid-cols-3 gap-2">
              <Counter label="Frames" value={rec.frames.toLocaleString()} accent={rec.active} />
              <Counter label="Elapsed" value={`${elapsed.toFixed(1)}s`} accent={rec.active} />
              <Counter label="Rate" value={rec.active ? `${sim.cfg.sampleRate} Hz` : "—"} />
            </div>

            {/* sensor + category */}
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="lbl">Sensor</span>
                <select
                  className="select mt-1 w-full"
                  value={rec.sensorId}
                  disabled={rec.active}
                  onChange={(e) => sim.setRecorderSensor(e.target.value)}
                >
                  {world.sensors.map((s) => (
                    <option key={s.id} value={s.id} disabled={!s.online || !s.enabled}>
                      {s.name} · {s.roomName}{!s.online || !s.enabled ? " (offline)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="lbl">Category</span>
                <select
                  className="select mt-1 w-full"
                  value={rec.category}
                  onChange={(e) => sim.setRecorderCategory(e.target.value as DatasetCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* subject + notes */}
            <label className="block">
              <span className="lbl">Subject / activity</span>
              <input
                type="text"
                className="mt-1 w-full"
                placeholder="e.g. Subject A — walking loop"
                value={subject}
                disabled={rec.active}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="lbl">Notes</span>
              <input
                type="text"
                className="mt-1 w-full"
                placeholder="Optional context (distance, orientation…)"
                value={notes}
                disabled={rec.active}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            {/* label marker */}
            <div>
              <span className="lbl">Label marker (timestamped while recording)</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  className="flex-1"
                  placeholder="e.g. subject started waving"
                  value={labelText}
                  disabled={!rec.active || rec.paused}
                  onChange={(e) => setLabelText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAddLabel()}
                />
                <button className="btn btn-amber" onClick={onAddLabel} disabled={!rec.active || rec.paused}>
                  <Icon name="tag" size={13} /> Mark
                </button>
              </div>
              {rec.active && sim.getRecordingLabels().length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sim.getRecordingLabels().map((l, i) => (
                    <span key={i} className="mono rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-[10px] text-amber">
                      {(l.t - (rec.startedAtSim ?? 0)).toFixed(1)}s · {l.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* live capture preview */}
        <section className="panel col-span-12 xl:col-span-7">
          <div className="panel-head">
            <span className="panel-title">Live Capture Preview</span>
            <span className="mono ml-auto text-[10px] text-faint">
              {rec.active ? `${rec.frames} FRAMES BUFFERED` : "RECORDER IDLE"}
            </span>
          </div>
          <CaptureChart
            height={320}
            sourceLabel={rec.active ? srcLabel : "IDLE"}
            emptyText={rec.active ? "AWAITING SAMPLES" : "START A RECORDING TO PREVIEW CAPTURE"}
            samples={() => sim.getRecordingSamples()}
            labels={() => sim.getRecordingLabels()}
          />
          <p className="mono border-t border-line px-4 py-2 text-[10px] text-faint">
            {isSim
              ? "PREVIEW SHOWS SYNTHETIC TELEMETRY — RECORDED FRAMES ARE WRITTEN TO THE LOCAL REPOSITORY ON STOP"
              : "NO DATA SOURCE ATTACHED"}
          </p>
        </section>
      </div>

      {/* ------------------------ dataset browser ----------------------- */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Dataset Browser</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="w-44"
              placeholder="Search name, subject…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="select" value={catFilter} onChange={(e) => setCatFilter(e.target.value as "all" | DatasetCategory)}>
              <option value="all">all categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="newest">newest</option>
              <option value="oldest">oldest</option>
              <option value="frames">most frames</option>
              <option value="size">largest</option>
            </select>
          </div>
        </div>

        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="sticky top-0 bg-panel2">
              <tr className="border-b border-line">
                {["Dataset", "Category", "Sensor", "Room", "Frames", "Size", "Captured", ""].map((h, i) => (
                  <th key={h || i} className="lbl whitespace-nowrap px-3.5 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="event-row border-b border-line/60">
                  <td className="px-3.5 py-2.5">
                    <div className="mono text-[12px] text-txt">{d.name}</div>
                    <div className="truncate text-[10.5px] text-faint">{d.subject || "—"}</div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <Chip tone={CAT_TONE[d.category]}>{d.category}</Chip>
                  </td>
                  <td className="mono whitespace-nowrap px-3.5 py-2.5 text-[11.5px] text-dim">{d.sensorName}</td>
                  <td className="mono whitespace-nowrap px-3.5 py-2.5 text-[11.5px] text-dim">{d.roomName || "—"}</td>
                  <td className="mono whitespace-nowrap px-3.5 py-2.5 text-[11.5px] text-txt">{d.frames.toLocaleString()}</td>
                  <td className="mono whitespace-nowrap px-3.5 py-2.5 text-[11.5px] text-dim">{formatBytes(d.sizeBytes)}</td>
                  <td className="mono whitespace-nowrap px-3.5 py-2.5 text-[10.5px] text-faint">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn !px-2 !py-1" title="View" onClick={() => setViewId(d.id)}>
                        <Icon name="wave" size={12} />
                      </button>
                      <button className="btn !px-2 !py-1" title="Export CSV" onClick={() => exportDataset(d, "csv")}>
                        <Icon name="download" size={12} />
                      </button>
                      <button
                        className="btn !px-2 !py-1 hover:!border-red/60 hover:!text-red"
                        title="Delete"
                        onClick={() => setConfirmDelete(d.id)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="mono px-4 py-10 text-center text-[11px] text-faint">
                    {sim.datasets.length === 0
                      ? "NO DATASETS RECORDED YET — USE THE RECORDER ABOVE"
                      : "NO DATASETS MATCH THE CURRENT FILTERS"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mono text-[10.5px] text-faint">
        PROVENANCE: all recorded frames are tagged with their source ({isSim ? "simulation" : "live"}) and seed. Exports carry an explicit provenance block.
      </p>

      {/* viewer */}
      {viewId && <DatasetViewer id={viewId} onClose={() => setViewId(null)} onDelete={(id) => { setViewId(null); setConfirmDelete(id); }} />}

      {/* delete confirm */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete dataset"
          confirmLabel="Delete"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            sim.deleteDataset(confirmDelete);
            setConfirmDelete(null);
            setFlash("Dataset deleted");
          }}
          body={
            <>
              The dataset <span className="mono text-txt">{confirmDelete}</span> and all of its frames will be permanently
              removed from the local repository. This cannot be undone.
            </>
          }
        />
      )}
    </div>
  );
}

function Counter({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-line bg-raise/50 px-3 py-2">
      <div className="lbl">{label}</div>
      <div className={`mono mt-0.5 text-[15px] font-semibold ${accent ? "text-acc" : "text-txt"}`}>{value}</div>
    </div>
  );
}

function exportDataset(d: DatasetMeta, kind: "csv" | "json") {
  const rec = sim.getDataset(d.id);
  if (!rec) return;
  const base = sanitizeFilename(d.name);
  if (kind === "csv") downloadText(`${base}.csv`, datasetToCSV(rec.meta, rec.samples), "text/csv");
  else downloadText(`${base}.json`, datasetToJSON(rec.meta, rec.samples), "application/json");
}

/* ------------------------- dataset viewer ------------------------- */

function DatasetViewer({ id, onClose, onDelete }: { id: string; onClose: () => void; onDelete: (id: string) => void }) {
  const rec = sim.getDataset(id);
  if (!rec) return null;
  const d = rec.meta;
  const ampSpark = rec.samples.filter((_, i) => i % Math.max(1, Math.floor(rec.samples.length / 120)) === 0).map((s) => s.amp);

  return (
    <ModalShell title={d.name} subtitle={`Recorded ${new Date(d.createdAt).toLocaleString()}`} onClose={onClose} width={760}>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={CAT_TONE[d.category]}>{d.category}</Chip>
          <Chip tone={d.source === "simulation" ? "amber" : "acc"}>
            <Dot tone={d.source === "simulation" ? "amber" : "acc"} size={5} /> {d.source}
          </Chip>
          <Chip tone="dim">seed {d.seed}</Chip>
          <div className="ml-auto flex gap-2">
            <button className="btn !py-1.5" onClick={() => exportDataset(d, "csv")}>
              <Icon name="download" size={12} /> CSV
            </button>
            <button className="btn !py-1.5" onClick={() => exportDataset(d, "json")}>
              <Icon name="download" size={12} /> JSON
            </button>
            <button className="btn !py-1.5 hover:!border-red/60 hover:!text-red" onClick={() => onDelete(d.id)}>
              <Icon name="x" size={12} /> Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded border border-line bg-raise/40 p-3.5 md:grid-cols-4">
          <Meta k="Sensor" v={d.sensorName} />
          <Meta k="Room" v={d.roomName || "—"} />
          <Meta k="Frames" v={d.frames.toLocaleString()} />
          <Meta k="Size" v={formatBytes(d.sizeBytes)} />
          <Meta k="Subject" v={d.subject || "—"} />
          <Meta k="Sample rate" v={`${d.sampleRateHz} Hz`} />
          <Meta k="Duration" v={`${((d.stoppedAtSim ?? d.startedAtSim) - d.startedAtSim).toFixed(1)}s`} />
          <Meta k="Labels" v={String(d.labels.length)} />
        </div>
        {d.notes && (
          <p className="rounded border border-line bg-raise/40 px-3 py-2 text-[11.5px] text-dim">
            <span className="lbl mr-2">Notes</span>{d.notes}
          </p>
        )}

        <div>
          <div className="lbl mb-1">Amplitude trace · {d.frames} frames</div>
          <CaptureChart
            height={220}
            sourceLabel={d.source === "simulation" ? `SIMULATED · SEED ${d.seed}` : "LIVE"}
            emptyText="NO FRAMES"
            samples={() => rec.samples}
            labels={() => rec.meta.labels}
          />
        </div>

        {d.labels.length > 0 && (
          <div>
            <div className="lbl mb-1.5">Label markers</div>
            <div className="flex flex-wrap gap-1.5">
              {d.labels.map((l, i) => (
                <span key={i} className="mono rounded border border-amber/40 bg-amber/10 px-2 py-1 text-[10.5px] text-amber">
                  +{(l.t - d.startedAtSim).toFixed(1)}s · {l.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {ampSpark.length > 1 && (
          <div>
            <div className="lbl mb-1">Downsampled amplitude</div>
            <Sparkline data={ampSpark} color="#3ce6a4" height={40} />
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="lbl">{k}</div>
      <div className="mono mt-0.5 break-all text-[12px] text-txt">{v}</div>
    </div>
  );
}
