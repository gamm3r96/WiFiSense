import { useMemo, useState } from "react";
import { Chip, Dot, severityTone } from "../components/ui";
import { useSim } from "../state/store";
import type { EventType } from "../types";
import { fmtClock } from "../utils/format";

const TYPES: (EventType | "ALL")[] = [
  "ALL",
  "MOTION_DETECTED",
  "PERSON_PRESENT",
  "PERSON_LEFT",
  "MODEL_PREDICTION",
  "SENSOR_ONLINE",
  "SENSOR_OFFLINE",
  "HIGH_PACKET_LOSS",
  "LOW_RSSI",
  "CONFIG_CHANGE",
  "BASELINE_CAPTURED",
  "SYSTEM",
];

export default function EventsPage() {
  const world = useSim();
  const [filter, setFilter] = useState<EventType | "ALL">("ALL");

  const events = useMemo(
    () => (filter === "ALL" ? [...world.events] : world.events.filter((e) => e.type === filter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.events, filter, world.tickIndex],
  );

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Event Feed</h1>
          <p className="text-[12px] text-dim">
            Detection and transport events emitted by the engine. Full event-engine persistence ships in Phase 14.
          </p>
        </div>
        <Chip tone="amber" >SRC: SIMULATION</Chip>
        <span className="mono ml-auto text-[11px] text-faint">{events.length} EVENTS SHOWN</span>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`mono rounded border px-2.5 py-1 text-[10.5px] tracking-wider transition-colors ${
              filter === t
                ? "border-acc/60 bg-acc/10 text-acc"
                : "border-line2 bg-raise text-dim hover:border-acc-dim hover:text-txt"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line bg-panel2/60">
                {["Timestamp", "Event", "Sensor", "Room", "Message", "Conf. (est.)", "Status"].map((h) => (
                  <th key={h} className="lbl whitespace-nowrap px-3.5 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="event-row border-b border-line/60">
                  <td className="mono whitespace-nowrap px-3.5 py-2 text-[11.5px] text-dim">{fmtClock(e.t)}</td>
                  <td className="whitespace-nowrap px-3.5 py-2">
                    <span className="mono text-[11px] font-semibold tracking-wider text-txt">{e.type}</span>
                  </td>
                  <td className="mono whitespace-nowrap px-3.5 py-2 text-[11.5px] text-dim">{e.sensorId ?? "—"}</td>
                  <td className="whitespace-nowrap px-3.5 py-2 text-[12px] text-dim">{e.roomName ?? "—"}</td>
                  <td className="max-w-[340px] truncate px-3.5 py-2 text-[12px] text-txt">{e.message}</td>
                  <td className="mono whitespace-nowrap px-3.5 py-2 text-[11.5px] text-dim">
                    {e.confidence !== undefined ? `${(e.confidence * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2">
                    <span className="flex items-center gap-1.5">
                      <Dot tone={severityTone(e.severity)} size={6} />
                      <span className="mono text-[10.5px] uppercase tracking-wider text-dim">{e.severity}</span>
                    </span>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="mono px-4 py-8 text-center text-[11px] text-faint">
                    NO EVENTS MATCH THE CURRENT FILTER
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mono text-[10px] text-faint">
        Confidence values are algorithmic estimates from the baseline detector — not guaranteed physical truth.
      </p>
    </div>
  );
}
