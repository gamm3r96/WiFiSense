import { useMemo, useState } from "react";
import { Chip, Dot, Icon, Toggle, type Tone } from "../components/ui";
import { ConfirmModal, SensorFormModal } from "../components/sensorModals";
import SensorDetailPage from "./SensorDetailPage";
import { sim, useSim } from "../state/store";
import type { SensorSim } from "../types";
import { fmtAgo, fmtDbm } from "../utils/format";

type StatusFilter = "ALL" | "ONLINE" | "OFFLINE" | "DISABLED";
type TestState = { kind: "testing" } | { kind: "ok"; ms: number } | { kind: "fail"; reason: string };

function sensorStatus(s: SensorSim): { label: string; tone: Tone; pulse: boolean } {
  if (!s.enabled) return { label: "DISABLED", tone: "dim", pulse: false };
  if (s.online) return { label: "ONLINE", tone: "acc", pulse: true };
  return { label: "OFFLINE", tone: "red", pulse: false };
}

export default function SensorsPage() {
  const world = useSim();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [roomFilter, setRoomFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState<null | { edit?: SensorSim }>(null);
  const [deleting, setDeleting] = useState<SensorSim | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const sensors = world.sensors;
  const online = sensors.filter((s) => s.online).length;
  const disabled = sensors.filter((s) => !s.enabled).length;
  const offline = sensors.length - online - disabled;

  const filtered = useMemo(
    () =>
      sensors.filter((s) => {
        if (status === "ONLINE" && !(s.enabled && s.online)) return false;
        if (status === "OFFLINE" && !(s.enabled && !s.online)) return false;
        if (status === "DISABLED" && s.enabled) return false;
        if (roomFilter !== "ALL" && s.roomId !== roomFilter) return false;
        const q = search.trim().toLowerCase();
        if (q && !`${s.name} ${s.id} ${s.ip} ${s.mac}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensors, status, roomFilter, search, world.tickIndex],
  );

  const runTest = async (s: SensorSim) => {
    setTests((t) => ({ ...t, [s.id]: { kind: "testing" } }));
    const res = await sim.testConnection(s.id);
    setTests((t) => ({
      ...t,
      [s.id]: res.ok ? { kind: "ok", ms: res.latencyMs ?? 0 } : { kind: "fail", reason: res.reason ?? "failed" },
    }));
    window.setTimeout(() => {
      setTests((t) => {
        const next = { ...t };
        delete next[s.id];
        return next;
      });
    }, 4000);
  };

  if (detailId) {
    return <SensorDetailPage id={detailId} onBack={() => setDetailId(null)} />;
  }

  const fBtn = (active: boolean) =>
    `mono rounded border px-2.5 py-1 text-[10.5px] tracking-wider transition-colors ${
      active ? "border-acc/60 bg-acc/10 text-acc" : "border-line2 bg-raise text-dim hover:border-acc-dim hover:text-txt"
    }`;

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-disp text-[20px] font-bold tracking-wide text-txt">Sensors</h1>
          <p className="text-[12px] text-dim">
            Fleet configuration · rows persist in the sensor repository{sim.mode === "simulation" ? " · telemetry is simulated" : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone="acc"><Dot tone="acc" size={6} pulse />{online} online</Chip>
          <Chip tone="red"><Dot tone="red" size={6} />{offline} offline</Chip>
          <Chip tone="dim"><Dot tone="dim" size={6} />{disabled} disabled</Chip>
          <button className="btn btn-acc" onClick={() => setFormOpen({})}>
            <Icon name="plug" size={13} /> Add Sensor
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "ONLINE", "OFFLINE", "DISABLED"] as StatusFilter[]).map((st) => (
          <button key={st} className={fBtn(status === st)} onClick={() => setStatus(st)}>
            {st}
          </button>
        ))}
        <select className="select" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} aria-label="Filter by room">
          <option value="ALL">All rooms</option>
          {world.rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search name / id / ip / mac…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[220px]"
        />
        <span className="mono ml-auto text-[11px] text-faint">{filtered.length} NODES</span>
      </div>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-line bg-panel2">
                {["Status", "Sensor", "Room", "CH / Band", "IP / MAC", "Firmware", "Rate", "RSSI", "Loss", "Last pkt", "Uptime", "Actions"].map((h) => (
                  <th key={h} className="lbl whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const st = sensorStatus(s);
                const test = tests[s.id];
                return (
                  <tr
                    key={s.id}
                    onClick={() => setDetailId(s.id)}
                    className="event-row cursor-pointer border-b border-line/60 hover:bg-raise/70"
                  >
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <Dot tone={st.tone} pulse={st.pulse} />
                        <span
                          className={`mono text-[10.5px] tracking-wider ${
                            st.tone === "acc" ? "text-acc" : st.tone === "red" ? "text-red" : "text-faint"
                          }`}
                        >
                          {st.label}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon name="chip" size={15} className="text-cyan" />
                        <div>
                          <div className="text-[13px] font-semibold leading-tight text-txt">{s.name}</div>
                          <div className="mono text-[10px] text-faint">
                            {s.id}{s.custom && <span className="ml-1.5 rounded border border-cyan/40 bg-cyan/10 px-1 text-cyan">CUSTOM</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-dim">{s.roomName}</td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11.5px] text-dim">
                      {s.channel} <span className="text-faint">· {s.band}</span>
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11px] leading-snug text-dim">
                      {s.ip}
                      <br />
                      <span className="text-faint">{s.mac}</span>
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11px] text-dim">{s.firmware}</td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11.5px] text-dim">{s.sampleRate} Hz</td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11.5px]">
                      <span className={s.rssi < -80 ? "text-red" : s.rssi < -65 ? "text-amber" : "text-acc"}>
                        {s.online ? fmtDbm(s.rssi) : "—"}
                      </span>
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11.5px]">
                      <span className={s.packetLoss > 6 ? "text-red" : s.packetLoss > 3 ? "text-amber" : "text-dim"}>
                        {s.online ? `${s.packetLoss.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11px] text-faint">
                      {s.online ? fmtAgo(world.simTime - s.lastPacketS) : "—"}
                    </td>
                    <td className="mono whitespace-nowrap px-3 py-2.5 text-[11px] text-dim">{s.online ? fmtUptimeShort(s.uptimeS) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {test?.kind === "testing" ? (
                          <span className="mono flex items-center gap-1.5 text-[10.5px] text-blue">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue border-t-transparent" />
                            probing
                          </span>
                        ) : test?.kind === "ok" ? (
                          <span className="mono text-[10.5px] text-acc">OK {test.ms} ms</span>
                        ) : test?.kind === "fail" ? (
                          <span className="mono text-[10.5px] text-red" title={test.reason}>FAIL</span>
                        ) : (
                          <button className="btn !px-2 !py-1 text-[10px]" title="Test connection" onClick={() => runTest(s)}>
                            <Icon name="zap" size={11} />
                          </button>
                        )}
                        <Toggle
                          checked={s.enabled}
                          onChange={(v) => sim.setEnabled(s.id, v)}
                        />
                        <button className="btn !px-2 !py-1 text-[10px]" title="Edit sensor" onClick={() => setFormOpen({ edit: s })}>
                          <Icon name="gear" size={11} />
                        </button>
                        <button
                          className="btn !px-2 !py-1 text-[10px] hover:!border-red/60 hover:!text-red"
                          title="Remove sensor"
                          onClick={() => setDeleting(s)}
                        >
                          <Icon name="x" size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="mono px-4 py-10 text-center text-[11px] text-faint">
                    NO NODES MATCH THE CURRENT FILTER
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mono text-[10.5px] text-faint">
        SOURCE: {sim.mode === "simulation" ? "SIMULATION (synthetic links)" : "LIVE HARDWARE (no adapter attached)"} ·
        CONFIG REPOSITORY: localStorage → REST /api/sensors (Phase 20) · click a row for the node console
      </p>

      {formOpen && <SensorFormModal initial={formOpen.edit} onClose={() => setFormOpen(null)} onSaved={(id) => setDetailId(id)} />}
      {deleting && (
        <ConfirmModal
          title="Remove sensor from fleet"
          confirmLabel="Remove Node"
          onClose={() => setDeleting(null)}
          onConfirm={() => sim.removeSensor(deleting.id)}
          body={
            <>
              <span className="font-semibold text-txt">{deleting.name}</span> ({deleting.id}) will be decommissioned.
              Its telemetry buffers are discarded and the config row is deleted from the repository. This action is logged.
            </>
          }
        />
      )}
    </div>
  );
}

function fmtUptimeShort(s: number): string {
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
