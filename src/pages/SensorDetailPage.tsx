import { useEffect, useState } from "react";
import LineChart from "../charts/LineChart";
import SpectrumChart from "../charts/SpectrumChart";
import { Chip, Dot, Icon, Meter, severityTone, Toggle, type Tone } from "../components/ui";
import { ConfirmModal, SensorFormModal } from "../components/sensorModals";
import { sim, useSim, type ConnTestResult } from "../state/store";
import { fmtAgo, fmtClock, fmtDbm, fmtUptime } from "../utils/format";

export default function SensorDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const world = useSim();
  const s = world.sensors.find((x) => x.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [test, setTest] = useState<null | "testing" | ConnTestResult>(null);

  useEffect(() => {
    if (!s) onBack();
  }, [s, onBack]);
  if (!s) return null;

  const statusTone: Tone = !s.enabled ? "dim" : s.online ? "acc" : "red";
  const statusLabel = !s.enabled ? "DISABLED" : s.online ? "ONLINE" : "OFFLINE";

  const runTest = async () => {
    setTest("testing");
    const res = await sim.testConnection(s.id);
    setTest(res);
  };

  const events = world.events.filter((e) => e.sensorId === s.id).slice(0, 10);
  const frames = s.buffer.slice(-8).reverse();

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <button className="btn !px-2.5" onClick={onBack} aria-label="Back to fleet">
          <Icon name="chevron" size={14} className="rotate-180" />
        </button>
        <div className="flex items-center gap-2.5">
          <Icon name="chip" size={22} className="text-cyan" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-disp text-[20px] font-bold tracking-wide text-txt">{s.name}</h1>
              <Chip tone={statusTone}>
                <Dot tone={statusTone} pulse={s.online && s.enabled} size={6} /> {statusLabel}
              </Chip>
              {s.custom && <Chip tone="cyan">custom node</Chip>}
            </div>
            <div className="mono text-[10.5px] text-faint">
              {s.id} · {s.hardware} · {s.roomName}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn" onClick={runTest} disabled={test === "testing"}>
            {test === "testing" ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-blue border-t-transparent" />
                Probing…
              </span>
            ) : (
              <>
                <Icon name="zap" size={13} /> Test Connection
              </>
            )}
          </button>
          <button className="btn" onClick={() => setEditOpen(true)}>
            <Icon name="gear" size={13} /> Edit
          </button>
          <button
            className="btn hover:!border-red/60 hover:!text-red"
            onClick={() => setConfirmDelete(true)}
          >
            <Icon name="x" size={13} /> Remove
          </button>
        </div>
      </header>

      {test && test !== "testing" && (
        <div
          className={`flex items-center gap-2 rounded border px-3 py-2 text-[12.5px] ${
            test.ok ? "border-acc/40 bg-acc/10 text-acc" : "border-red/40 bg-red/10 text-red"
          }`}
        >
          <Icon name={test.ok ? "zap" : "alert"} size={14} />
          {test.ok
            ? `Link probe succeeded — round trip ${test.latencyMs} ms (synthetic transport)`
            : `Link probe failed: ${test.reason}`}
        </div>
      )}

      <div className="grid grid-cols-12 gap-3">
        {/* Identity + RF config */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Node Configuration</span>
            <span className="mono ml-auto text-[10px] text-faint">REPO ROW {s.id}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <Field k="Sensor ID" v={s.id} />
            <Field k="Room" v={s.roomName} />
            <Field k="IP address" v={s.ip} />
            <Field k="MAC address" v={s.mac} />
            <Field k="Hardware" v={s.hardware} />
            <Field k="Firmware" v={s.firmware} />
            <Field k="Channel" v={`CH ${s.channel}`} />
            <Field k="Band" v={s.band} />
            <Field k="CSI rate" v={`${s.sampleRate} samples/s`} />
            <Field k="Transport" v={s.transport.toUpperCase()} />
          </dl>
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div>
              <div className="text-[12.5px] font-medium text-txt">Node enabled</div>
              <div className="text-[10.5px] text-faint">Gateway holds disabled nodes offline</div>
            </div>
            <Toggle checked={s.enabled} onChange={(v) => sim.setEnabled(s.id, v)} />
          </div>
        </section>

        {/* Health */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Link Health</span>
            <span className="mono ml-auto text-[10px] text-faint">SIMULATED TRANSPORT</span>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="lbl">RSSI</span>
                <span className="mono text-[12px] text-txt">{s.online ? fmtDbm(s.rssi) : "—"}</span>
              </div>
              <Meter value={s.online ? (s.rssi + 95) / 60 : 0} tone={s.rssi < -80 ? "red" : s.rssi < -65 ? "amber" : "acc"} />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="lbl">Packet loss</span>
                <span className="mono text-[12px] text-txt">{s.online ? `${s.packetLoss.toFixed(2)} %` : "—"}</span>
              </div>
              <Meter value={s.online ? s.packetLoss / 10 : 0} tone={s.packetLoss > 6 ? "red" : s.packetLoss > 3 ? "amber" : "acc"} />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <MiniStat k="Latency" v={s.online ? `${s.latencyMs.toFixed(0)} ms` : "—"} />
              <MiniStat k="Uptime" v={fmtUptime(s.uptimeS)} />
              <MiniStat k="Last packet" v={s.online ? fmtAgo(world.simTime - s.lastPacketS) : "—"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat k="Motion score" v={s.online ? s.motionScore.toFixed(2) : "—"} accent />
              <MiniStat k="Frames buffered" v={String(s.buffer.length)} />
            </div>
          </div>
        </section>

        {/* Recent events */}
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <span className="panel-title">Node Events</span>
            <span className="mono ml-auto text-[10px] text-faint">LAST {events.length}</span>
          </div>
          <ul className="max-h-[280px] divide-y divide-line/60 overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="event-row flex items-start gap-2.5 px-3.5 py-2">
                <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(severityTone(e.severity))}`} />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-txt">{e.message}</div>
                  <div className="mono text-[10px] text-faint">{fmtClock(e.t)} · {e.type}</div>
                </div>
              </li>
            ))}
            {events.length === 0 && (
              <li className="mono px-4 py-8 text-center text-[11px] text-faint">NO EVENTS FOR THIS NODE</li>
            )}
          </ul>
        </section>

        {/* Amplitude scope */}
        <section className="panel col-span-12 xl:col-span-7">
          <div className="panel-head">
            <span className="panel-title">CSI Amplitude Scope</span>
            <span className="mono ml-auto text-[10px] text-faint">WINDOW 30 s · MEAN OVER {sim.cfg.subcarriers} SC</span>
          </div>
          <LineChart
            windowSec={30}
            height={230}
            unit="norm"
            sourceLabel={sim.mode === "simulation" ? "SIMULATED CSI" : "NO SOURCE"}
            series={[
              {
                label: "amplitude",
                color: "#3ce6a4",
                fill: true,
                data: () => s.buffer.map((p) => ({ t: p.t, v: p.amp })),
              },
              {
                label: "motion score",
                color: "#f2b34c",
                width: 1.2,
                domain: [0, 1],
                data: () => s.buffer.map((p) => ({ t: p.t, v: p.score })),
              },
            ]}
            idleText={s.enabled ? "AWAITING SAMPLES" : "NODE DISABLED — TELEMETRY WITHHELD"}
          />
        </section>

        {/* Spectrum */}
        <section className="panel col-span-12 xl:col-span-5">
          <div className="panel-head">
            <span className="panel-title">Subcarrier Spectrum</span>
            <span className="mono ml-auto text-[10px] text-faint">{sim.cfg.subcarriers} SC</span>
          </div>
          <SpectrumChart
            height={230}
            sourceLabel={sim.mode === "simulation" ? "SIMULATED CSI" : "NO SOURCE"}
            data={() => Array.from(s.spectrum)}
            baseline={() => Array.from(s.baseAmp)}
          />
        </section>

        {/* Recent frames */}
        <section className="panel col-span-12">
          <div className="panel-head">
            <span className="panel-title">Recent Frames</span>
            <span className="mono ml-auto text-[10px] text-faint">
              {sim.mode === "simulation" ? "SYNTHETIC TELEMETRY · NOT HARDWARE CSI" : "NO SOURCE"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-panel2">
                  {["T (sim)", "Amplitude", "Phase (rad)", "RSSI", "Variance", "Motion score"].map((h) => (
                    <th key={h} className="lbl whitespace-nowrap px-3.5 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {frames.map((p) => (
                  <tr key={p.t} className="border-b border-line/60">
                    <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">T+{p.t.toFixed(1)}s</td>
                    <td className="mono px-3.5 py-1.5 text-[11.5px] text-acc">{p.amp.toFixed(4)}</td>
                    <td className="mono px-3.5 py-1.5 text-[11.5px] text-cyan">{p.phase.toFixed(3)}</td>
                    <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">{p.rssi.toFixed(1)} dBm</td>
                    <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">{p.variance.toExponential(2)}</td>
                    <td className="px-3.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-raise">
                          <div
                            className={`h-full rounded-sm ${p.score > 0.6 ? "bg-red" : p.score > 0.35 ? "bg-amber" : "bg-acc"}`}
                            style={{ width: `${Math.round(p.score * 100)}%` }}
                          />
                        </div>
                        <span className="mono text-[11px] text-dim">{p.score.toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {frames.length === 0 && (
                  <tr>
                    <td colSpan={6} className="mono px-4 py-8 text-center text-[11px] text-faint">
                      {s.enabled ? "BUFFER EMPTY" : "NODE DISABLED — TELEMETRY WITHHELD"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="mono text-[10.5px] text-faint">
        PROVENANCE: {sim.mode === "simulation" ? "all telemetry on this console is generated by the simulation engine" : "live mode — no adapter attached, no data displayed"}
      </p>

      {editOpen && <SensorFormModal initial={s} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} />}
      {confirmDelete && (
        <ConfirmModal
          title="Remove sensor from fleet"
          confirmLabel="Remove Node"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            sim.removeSensor(s.id);
            onBack();
          }}
          body={
            <>
              <span className="font-semibold text-txt">{s.name}</span> ({s.id}) will be decommissioned. Telemetry buffers are
              discarded and the config row is deleted from the repository. This action is logged.
            </>
          }
        />
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="lbl">{k}</dt>
      <dd className="mono mt-0.5 break-all text-[12px] text-txt">{v}</dd>
    </div>
  );
}

function MiniStat({ k, v, accent = false }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded border border-line bg-raise/50 px-3 py-2">
      <div className="lbl">{k}</div>
      <div className={`mono mt-0.5 text-[13px] ${accent ? "text-acc" : "text-txt"}`}>{v}</div>
    </div>
  );
}

function dotClass(tone: Tone): string {
  const map: Record<Tone, string> = {
    acc: "bg-acc",
    amber: "bg-amber",
    red: "bg-red",
    blue: "bg-blue",
    cyan: "bg-cyan",
    dim: "bg-faint",
  };
  return map[tone];
}
