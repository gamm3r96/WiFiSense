import { useState } from "react";
import { Chip, Dot, Icon } from "../components/ui";
import { ESP32_ADAPTERS, jsonLineParser, webSerialAvailable } from "../services/transport";
import { sim, useSim } from "../state/store";
import { fmtAgo, fmtDbm, fmtUptime } from "../utils/format";

const FLOW = `ESP32-S3 (esp-csi firmware)
   │  CSI frames (vendor format — not yet supplied)
   ▼
Transport adapter            serial / udp / tcp
   │  raw lines / datagrams
   ▼
CSIPacketParser              placeholder until protocol is provided
   │  CSIFrame { seq, rssi, amp[], phase[] }
   ▼
CSI data pipeline            validation → amplitude/phase → filters
   │
   ▼
Detection engine             motion · occupancy · activity`;

/**
 * Hardware integration console (Phase 10/11) + fleet network health
 * (Phase 12). No protocol is invented: adapters are explicit
 * placeholders until the esp-csi frame layout is supplied.
 */
export default function HardwarePage() {
  const world = useSim();
  const [line, setLine] = useState('{"seq": 7, "rssi": -51, "amp": [0.82, 0.91, 0.77]}');
  const parsed = jsonLineParser.canParse(line) ? jsonLineParser.parse(line) : null;

  const online = world.sensors.filter((s) => s.online);
  const avgLatency = online.length ? online.reduce((a, s) => a + s.latencyMs, 0) / online.length : 0;
  const avgLoss = online.length ? online.reduce((a, s) => a + s.packetLoss, 0) / online.length : 0;

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Hardware Integration</h1>
          <p className="text-[12px] text-dim">
            ESP32-S3 · ESP-IDF · esp-csi — transport adapters, parser stage, and fleet network health.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={webSerialAvailable() ? "acc" : "amber"}>
            <Dot tone={webSerialAvailable() ? "acc" : "amber"} size={6} />
            web serial {webSerialAvailable() ? "available" : "unavailable"}
          </Chip>
          <Chip tone="dim">protocol: not supplied</Chip>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <section className="panel col-span-12 lg:col-span-5">
          <div className="panel-head">
            <span className="panel-title">Integration Flow</span>
            <span className="mono ml-auto text-[10px] text-faint">MODULAR · SWAPPABLE</span>
          </div>
          <pre className="mono overflow-x-auto whitespace-pre p-4 text-[11px] leading-relaxed text-cyan">{FLOW}</pre>
          <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-relaxed text-faint">
            A browser is <span className="text-amber">not</span> an automatic CSI receiver — CSI needs supported hardware/firmware.
            This platform consumes frames from adapters only, and never fabricates hardware data.
          </p>
        </section>

        <section className="panel col-span-12 lg:col-span-7">
          <div className="panel-head">
            <span className="panel-title">Transport Adapters</span>
            <span className="mono ml-auto text-[10px] text-faint">{ESP32_ADAPTERS.length} DEFINED</span>
          </div>
          <div className="divide-y divide-line/60">
            {ESP32_ADAPTERS.map((a) => (
              <div key={a.kind} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded border border-line2 bg-raise text-blue">
                  <Icon name={a.kind === "serial" ? "terminal" : "antenna"} size={15} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-disp text-[13px] font-semibold text-txt">{a.name}</span>
                    <Chip tone="amber">{a.status}</Chip>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-dim">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel col-span-12 lg:col-span-5">
          <div className="panel-head">
            <span className="panel-title">Parser Bench</span>
            <Chip tone="cyan">json-line debug format</Chip>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <div className="lbl mb-1">raw line</div>
              <input type="text" className="w-full" value={line} onChange={(e) => setLine(e.target.value)} />
            </div>
            <div>
              <div className="lbl mb-1">parsed frame</div>
              {parsed ? (
                <pre className="mono rounded border border-acc/30 bg-acc/5 p-3 text-[10.5px] leading-relaxed text-acc">
{JSON.stringify({ seq: parsed.seq, rssi: parsed.rssi, amp: parsed.amplitudes?.length ?? 0, phase: parsed.phases?.length ?? 0 }, null, 1)}
                </pre>
              ) : (
                <div className="mono rounded border border-line bg-raise/40 p-3 text-[10.5px] text-faint">
                  REJECTED — format not recognized (the parser never guesses)
                </div>
              )}
            </div>
            <p className="text-[10.5px] leading-relaxed text-faint">
              This explicit JSON debug format exists so firmware bring-up can start today. The binary esp-csi layout will plug into the
              same <span className="mono">CSIPacketParser</span> interface when supplied.
            </p>
          </div>
        </section>

        {/* ---------------- fleet network health (Phase 12) ---------------- */}
        <section className="panel col-span-12 lg:col-span-7">
          <div className="panel-head">
            <span className="panel-title">Fleet Network Health</span>
            <span className="mono ml-auto text-[10px] text-faint">
              {online.length}/{world.sensors.length} ONLINE · {sim.mode === "simulation" ? "SIMULATED TRANSPORT" : "NO SOURCE"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 border-b border-line p-4">
            <div>
              <div className="lbl">Avg latency</div>
              <div className="mono text-[17px] font-semibold text-txt">{avgLatency.toFixed(1)} ms</div>
            </div>
            <div>
              <div className="lbl">Avg packet loss</div>
              <div className={`mono text-[17px] font-semibold ${avgLoss > 5 ? "text-red" : avgLoss > 2 ? "text-amber" : "text-acc"}`}>
                {avgLoss.toFixed(2)} %
              </div>
            </div>
            <div>
              <div className="lbl">Aggregate rate</div>
              <div className="mono text-[17px] font-semibold text-txt">{sim.samplesPerSec} s/s</div>
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-panel2">
                <tr className="border-b border-line">
                  {["Node", "State", "RSSI", "Loss", "Latency", "Last seen", "Uptime"].map((h) => (
                    <th key={h} className="lbl whitespace-nowrap px-3.5 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {world.sensors.map((s) => {
                  const updating = sim.isUpdating(s.id);
                  const state = updating ? "UPDATING" : !s.enabled ? "DISABLED" : s.online ? "ONLINE" : "OFFLINE";
                  const tone = updating ? "blue" : !s.enabled ? "dim" : s.online ? "acc" : "red";
                  return (
                    <tr key={s.id} className="border-b border-line/60">
                      <td className="mono whitespace-nowrap px-3.5 py-1.5 text-[11.5px] text-txt">{s.name}</td>
                      <td className="px-3.5 py-1.5">
                        <Chip tone={tone as never}>
                          <Dot tone={tone as never} size={6} pulse={state === "ONLINE"} /> {state}
                        </Chip>
                      </td>
                      <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">{s.online ? fmtDbm(s.rssi) : "—"}</td>
                      <td className={`mono px-3.5 py-1.5 text-[11.5px] ${s.packetLoss > 5 ? "text-red" : s.packetLoss > 2 ? "text-amber" : "text-dim"}`}>
                        {s.online ? `${s.packetLoss.toFixed(2)}%` : "—"}
                      </td>
                      <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">{s.online ? `${s.latencyMs.toFixed(0)} ms` : "—"}</td>
                      <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">{s.online ? fmtAgo(world.simTime - s.lastPacketS) : "—"}</td>
                      <td className="mono px-3.5 py-1.5 text-[11.5px] text-dim">{fmtUptime(s.uptimeS)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
