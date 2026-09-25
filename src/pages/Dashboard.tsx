import { useMemo, useState } from "react";
import LineChart, { type SeriesDef } from "../charts/LineChart";
import SpectrumChart from "../charts/SpectrumChart";
import { Dot, Icon, Meter, Sparkline, Chip, severityTone } from "../components/ui";
import type { PageId } from "../nav";
import { isPresence } from "../processing/occupancy";
import { sim, useSim } from "../state/store";
import { fmtAgo, fmtClock, fmtDbm, fmtUptime } from "../utils/format";

/* ------------------------------ KPI strip ------------------------- */

function Kpi({
  label,
  value,
  sub,
  tone = "txt",
  alert = false,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "txt" | "acc" | "amber" | "red" | "blue";
  alert?: boolean;
}) {
  const color =
    tone === "acc" ? "text-acc" : tone === "amber" ? "text-amber" : tone === "red" ? "text-red" : tone === "blue" ? "text-blue" : "text-txt";
  return (
    <div className="relative px-4 py-3.5">
      {alert && <span className="absolute inset-y-0 left-0 w-[3px] bg-red/80" />}
      <div className="lbl">{label}</div>
      <div className={`mono mt-1.5 text-[26px] font-semibold leading-none ${color}`}>{value}</div>
      <div className="mono mt-1.5 text-[10.5px] text-faint">{sub}</div>
    </div>
  );
}

/* ------------------------------ dashboard ------------------------- */

export default function Dashboard({ go }: { go: (p: PageId) => void }) {
  const world = useSim();
  const [selId, setSelId] = useState<string>(sim.world.sensors[0]?.id ?? "");
  const [windowSec, setWindowSec] = useState(30);

  const series: SeriesDef[] = useMemo(
    () => [
      {
        label: "amplitude",
        color: "#45d8d0",
        fill: true,
        data: () => {
          const s = sim.world.sensors.find((x) => x.id === selId) ?? sim.world.sensors[0];
          return s ? s.buffer.map((p) => ({ t: p.t, v: p.amp })) : [];
        },
      },
      {
        label: "motion score",
        color: "#f2b34c",
        width: 1.2,
        domain: [0, 1],
        data: () => {
          const s = sim.world.sensors.find((x) => x.id === selId) ?? sim.world.sensors[0];
          return s ? s.buffer.map((p) => ({ t: p.t, v: p.score })) : [];
        },
      },
    ],
    [selId],
  );

  const sensor = world.sensors.find((s) => s.id === selId) ?? world.sensors[0];
  const latest = sensor?.buffer[sensor.buffer.length - 1];
  const online = world.sensors.filter((s) => s.online);
  const offline = world.sensors.length - online.length;
  const activeRooms = world.rooms.filter((r) => r.anyOnline).length;
  const occupied = world.rooms.filter((r) => isPresence(sim.assessmentFor(r.id).state)).length;
  const motionWindow = world.motionStamps.filter((t) => world.simTime - t < 300).length;
  const srcLabel = `SIM ENGINE · SEED ${sim.cfg.seed}`;
  const halted = sim.mode === "live" || !sim.cfg.running;

  return (
    <div className="fade-up space-y-3 p-4">
      {/* ---- mode / halt banners ---- */}
      {sim.mode === "live" ? (
        <div className="panel flex flex-wrap items-center gap-3 border-red/40 px-4 py-3">
          <Icon name="alert" size={17} className="text-red" />
          <div className="flex-1">
            <div className="font-disp text-[13px] font-semibold tracking-wide text-red">
              LIVE HARDWARE SELECTED — NO LIVE CSI SOURCE CONNECTED.
            </div>
            <div className="mt-0.5 text-[12px] text-dim">
              The stream is halted. WiFiSense Lab never fabricates readings and presents them as hardware data.
              Hardware adapters (ESP32-S3 · esp-csi) arrive in Phase 10.
            </div>
          </div>
          <button className="btn" disabled title="Hardware integration — Phase 10">
            <Icon name="plug" size={14} /> Connect Sensor
          </button>
          <button className="btn btn-acc" onClick={() => sim.setMode("simulation")}>
            Return to Simulation
          </button>
        </div>
      ) : !sim.cfg.running ? (
        <div className="panel flex flex-wrap items-center gap-3 border-amber/40 px-4 py-3">
          <Icon name="pause" size={16} className="text-amber" />
          <div className="flex-1 text-[12.5px] text-dim">
            <span className="font-disp font-semibold tracking-wide text-amber">SIMULATION PAUSED</span>
            {" — telemetry stream halted. Buffered data remains visible; nothing is being generated."}
          </div>
          <button className="btn btn-acc" onClick={() => sim.setRunning(true)}>
            <Icon name="play" size={13} /> Resume Stream
          </button>
        </div>
      ) : null}

      {/* ---- KPI strip ---- */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 xl:grid-cols-6 [&>div]:bg-panel">
        <Kpi label="Sensors Online" value={`${online.length}`} sub={`of ${world.sensors.length} nodes in fleet`} tone="acc" />
        <Kpi
          label="Sensors Offline"
          value={`${offline}`}
          sub={offline > 0 ? "link down — see health table" : "all links nominal"}
          tone={offline > 0 ? "red" : "txt"}
          alert={offline > 0}
        />
        <Kpi label="Active Rooms" value={`${activeRooms}`} sub={`${world.rooms.length} rooms monitored`} tone="blue" />
        <Kpi label="Occupied Rooms" value={`${occupied}`} sub="scenario-state estimate" />
        <Kpi label="Motion Events" value={`${motionWindow}`} sub="trailing 5 min · all nodes" tone={motionWindow > 0 ? "amber" : "txt"} />
        <Kpi
          label="CSI Samples / sec"
          value={`${sim.samplesPerSec}`}
          sub={halted ? "stream halted" : `target ${sim.cfg.sampleRate} Hz × ${online.length} nodes`}
          tone={halted ? "txt" : "acc"}
        />
      </section>

      {/* ---- live scope + spectrum ---- */}
      <div className="grid grid-cols-12 gap-3">
        <section className="panel col-span-12 xl:col-span-8">
          <div className="panel-head">
            <Dot tone={halted ? "dim" : "acc"} pulse={!halted} />
            <h2 className="panel-title">Live Activity — CSI Amplitude Scope</h2>
            <div className="ml-auto flex items-center gap-2">
              <select className="select" value={sensor?.id ?? ""} onChange={(e) => setSelId(e.target.value)} aria-label="Sensor">
                {world.sensors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.roomName}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={windowSec}
                onChange={(e) => setWindowSec(Number(e.target.value))}
                aria-label="Time window"
              >
                <option value={15}>15 s</option>
                <option value={30}>30 s</option>
                <option value={60}>60 s</option>
              </select>
            </div>
          </div>
          <div className="p-2">
            <LineChart
              series={series}
              unit="amplitude (norm) / score"
              sourceLabel={`${srcLabel} · ${sensor?.name ?? "—"}`}
              windowSec={windowSec}
              height={252}
              tLabel={(t) => fmtClock(world.wallStart + t * 1000)}
            />
          </div>
          <div className="flex items-center gap-4 border-t border-line px-4 py-2">
            <span className="mono text-[10px] text-faint">
              CH {sensor?.channel} · {sensor?.band} · {sim.cfg.subcarriers} SC · DECIMATED TO 10 Hz DISPLAY
            </span>
            <span className="mono ml-auto text-[10px] text-faint">
              LAST FRAME {latest ? fmtClock(world.wallStart + latest.t * 1000) : "—"}
            </span>
          </div>
        </section>

        <div className="col-span-12 space-y-3 xl:col-span-4">
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Subcarrier Spectrum</h2>
              <Chip tone="dim">{sensor?.name ?? "—"}</Chip>
            </div>
            <div className="p-2">
              <SpectrumChart
                data={() => Array.from((sim.world.sensors.find((x) => x.id === selId) ?? sim.world.sensors[0])?.spectrum ?? [])}
                baseline={() => Array.from((sim.world.sensors.find((x) => x.id === selId) ?? sim.world.sensors[0])?.baseAmp ?? [])}
                height={180}
                sourceLabel={srcLabel}
              />
            </div>
          </section>

          <section className="panel px-4 py-3">
            <div className="lbl mb-2">RF Snapshot — {sensor?.roomName ?? "—"}</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="lbl">RSSI</div>
                <div className="mono mt-1 text-[20px] font-semibold leading-none text-txt">
                  {latest ? latest.rssi.toFixed(0) : "--"}
                  <span className="ml-1 text-[10px] text-faint">dBm</span>
                </div>
              </div>
              <div>
                <div className="lbl">Pkt Rate</div>
                <div className="mono mt-1 text-[20px] font-semibold leading-none text-txt">
                  {sim.streaming ? sim.cfg.sampleRate : 0}
                  <span className="ml-1 text-[10px] text-faint">Hz</span>
                </div>
              </div>
              <div>
                <div className="lbl">Variance</div>
                <div className="mono mt-1 text-[20px] font-semibold leading-none text-txt">
                  {latest ? latest.variance.toFixed(4) : "--"}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Meter
                label="Motion Score (heuristic)"
                value={latest?.score ?? 0}
                tone={(latest?.score ?? 0) > 0.45 ? "amber" : "acc"}
              />
            </div>
          </section>
        </div>
      </div>

      {/* ---- rooms / events / health ---- */}
      <div className="grid grid-cols-12 gap-3">
        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <h2 className="panel-title">Room Overview</h2>
            <span className="mono ml-auto text-[10px] text-faint">ALGORITHMIC ESTIMATES</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {world.rooms.map((r) => {
              const a = sim.assessmentFor(r.id);
              const pres = isPresence(a.state);
              const motion = a.motionScore >= sim.motionCfg.threshold;
              return (
                <div key={r.id} className="rounded-md border border-line bg-panel px-3 py-2.5 transition-colors hover:border-line2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-disp text-[13px] font-semibold tracking-wide text-txt">{r.name}</span>
                    <Chip tone={pres ? "acc" : a.state === "UNKNOWN" ? "red" : "dim"}>{a.state}</Chip>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <div className="lbl">Occupancy</div>
                      <div className={`font-disp mt-0.5 text-[13px] font-semibold ${pres ? "text-acc" : "text-dim"}`}>
                        {pres ? "PRESENT" : a.state === "UNKNOWN" ? "UNKNOWN" : "VACANT"}
                      </div>
                    </div>
                    <div>
                      <div className="lbl">Motion</div>
                      <div className={`font-disp mt-0.5 text-[13px] font-semibold ${motion ? "text-amber" : "text-dim"}`}>
                        {motion ? "YES" : "NO"}
                      </div>
                    </div>
                    <div>
                      <div className="lbl">Conf. (est.)</div>
                      <div className="mono mt-0.5 text-[13px] font-semibold text-txt">{a.confidence}%</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <Sparkline data={a.history.map((p) => p.v)} color={pres ? "#3ce6a4" : "#5b6c82"} height={22} />
                    </div>
                    <span className="mono text-[9.5px] text-faint">{r.sensorIds.length} node{r.sensorIds.length > 1 ? "s" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <h2 className="panel-title">Recent Events</h2>
            <span className="mono ml-auto text-[10px] text-faint">{world.events.length} IN BUFFER</span>
          </div>
          <div className="max-h-[338px] overflow-y-auto">
            {world.events.slice(0, 12).map((e) => (
              <div key={e.id} className="event-row flex items-start gap-2.5 border-b border-line/60 px-3.5 py-2">
                <Dot tone={severityTone(e.severity)} size={6} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px] font-semibold tracking-wider text-dim">{e.type}</span>
                    {e.confidence !== undefined && (
                      <span className="mono text-[9.5px] text-faint">est. {(e.confidence * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-dim">{e.message}</div>
                </div>
                <span className="mono shrink-0 text-[10px] text-faint">{fmtClock(e.t)}</span>
              </div>
            ))}
          </div>
          <button className="btn w-full !rounded-none !border-x-0 !border-b-0 !py-2.5" onClick={() => go("events")}>
            Open Events Feed <Icon name="chevron" size={13} />
          </button>
        </section>

        <section className="panel col-span-12 lg:col-span-4">
          <div className="panel-head">
            <h2 className="panel-title">System Health</h2>
            <span className="mono ml-auto text-[10px] text-faint">NODE TELEMETRY</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Node", "Room", "RSSI", "Loss", "Lat", "Last Pkt"].map((h) => (
                    <th key={h} className="lbl px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {world.sensors.map((s) => (
                  <tr key={s.id} className="event-row border-b border-line/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Dot tone={s.online ? "acc" : "red"} pulse={s.online} size={6} />
                        <div>
                          <div className="mono text-[11.5px] text-txt">{s.name}</div>
                          <div className="mono text-[9.5px] text-faint">
                            {s.online ? `up ${fmtUptime(s.uptimeS)}` : "LINK DOWN"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-dim">{s.roomName}</td>
                    <td className="mono px-3 py-2 text-[11.5px] text-txt">{s.online ? fmtDbm(s.rssi) : "--"}</td>
                    <td className={`mono px-3 py-2 text-[11.5px] ${s.packetLoss > 6 ? "text-amber" : "text-txt"}`}>
                      {s.online ? `${s.packetLoss.toFixed(1)}%` : "--"}
                    </td>
                    <td className="mono px-3 py-2 text-[11.5px] text-txt">{s.online ? `${s.latencyMs.toFixed(0)}ms` : "--"}</td>
                    <td className="mono px-3 py-2 text-[11.5px] text-faint">
                      {s.online ? fmtAgo(world.simTime - s.lastPacketS) : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---- provenance ---- */}
      <footer className="panel flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5">
        <span className="flex items-center gap-2">
          <Icon name="flask" size={13} className="text-amber" />
          <span className="mono text-[10.5px] tracking-wide text-dim">
            DATA PROVENANCE: all telemetry above is synthesized by the local deterministic simulation engine
            (seed {sim.cfg.seed}). It is not derived from physical Wi-Fi hardware.
          </span>
        </span>
        <span className="mono ml-auto text-[10.5px] text-faint">
          ENGINE TICK 100 ms · {sim.cfg.subcarriers} SUBCARRIERS · DISPLAY DECIMATION 10 Hz
        </span>
      </footer>
    </div>
  );
}
