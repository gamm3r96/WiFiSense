import { useState } from "react";
import { Chip, Icon, type Tone } from "../components/ui";
import { sim, useSim } from "../state/store";
import type { LogLevel } from "../types";
import { fmtClock } from "../utils/format";

const LEVELS: (LogLevel | "ALL")[] = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

const LEVEL_TONE: Record<LogLevel, Tone> = {
  DEBUG: "dim",
  INFO: "blue",
  WARNING: "amber",
  ERROR: "red",
  CRITICAL: "red",
};

export default function LogsPage() {
  const world = useSim();
  const [level, setLevel] = useState<LogLevel | "ALL">("ALL");
  const logs = level === "ALL" ? world.logs : world.logs.filter((l) => l.level === level);

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">System Logs</h1>
          <p className="text-[12px] text-dim">Structured engine, gateway and pipeline logs (in-memory buffer).</p>
        </div>
        <button className="btn ml-auto !py-1.5" onClick={() => sim.clearLogs()}>
          <Icon name="x" size={12} /> Clear Buffer
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`mono rounded border px-2.5 py-1 text-[10.5px] tracking-wider transition-colors ${
              level === l
                ? "border-acc/60 bg-acc/10 text-acc"
                : "border-line2 bg-raise text-dim hover:border-acc-dim hover:text-txt"
            }`}
          >
            {l}
          </button>
        ))}
        <span className="mono ml-auto self-center text-[11px] text-faint">{logs.length} ENTRIES</span>
      </div>

      <section className="panel overflow-hidden">
        <div className="max-h-[calc(100vh-240px)] overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-panel2">
              <tr className="border-b border-line">
                {["Timestamp", "Level", "Component", "Message", "Metadata"].map((h) => (
                  <th key={h} className="lbl px-3.5 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="event-row border-b border-line/60 align-top">
                  <td className="mono whitespace-nowrap px-3.5 py-2 text-[11px] text-dim">{fmtClock(l.t)}</td>
                  <td className="whitespace-nowrap px-3.5 py-2">
                    <Chip tone={LEVEL_TONE[l.level]}>{l.level}</Chip>
                  </td>
                  <td className="mono whitespace-nowrap px-3.5 py-2 text-[11.5px] text-acc">{l.component}</td>
                  <td className="px-3.5 py-2 text-[12px] text-txt">{l.message}</td>
                  <td className="mono whitespace-nowrap px-3.5 py-2 text-[10.5px] text-faint">
                    {l.meta ? JSON.stringify(l.meta) : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="mono px-4 py-8 text-center text-[11px] text-faint">
                    LOG BUFFER EMPTY
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
