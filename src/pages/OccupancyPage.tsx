import { useEffect, useState } from "react";
import LineChart from "../charts/LineChart";
import { Chip, Icon, Meter, type Tone } from "../components/ui";
import { OCC_THRESHOLDS, PRESENCE_STATES, type OccupancyState } from "../processing/occupancy";
import { sim, useSim } from "../state/store";
import { fmtClock } from "../utils/format";

const STATE_TONE: Record<OccupancyState, Tone> = {
  EMPTY: "dim",
  OCCUPIED: "acc",
  MOTION: "amber",
  STATIONARY: "blue",
  UNKNOWN: "red",
};

function RoomCard({ roomId, onChart }: { roomId: string; onChart: (id: string) => void }) {
  const world = useSim();
  const room = world.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const a = sim.assessmentFor(roomId);
  const baseline = sim.baselineFor(roomId);
  const presence = PRESENCE_STATES.includes(a.state);

  return (
    <section className="panel col-span-12 md:col-span-6 xl:col-span-3">
      <div className="panel-head">
        <span className="font-disp text-[13px] font-semibold tracking-wide text-txt">{room.name}</span>
        <Chip tone={STATE_TONE[a.state]}>{a.state}</Chip>
      </div>
      <div className="space-y-3 p-3.5">
        <div>
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="lbl">Confidence · algorithmic estimate</span>
            <span className="mono text-[13px] font-semibold text-txt">{a.confidence}%</span>
          </div>
          <Meter value={a.confidence / 100} tone={a.confidence > 66 ? "acc" : a.confidence > 33 ? "amber" : "red"} />
        </div>
        <div>
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="lbl">Spectral Deviation</span>
            <span className="mono text-[12px] text-txt">{a.deviation.toFixed(3)}</span>
          </div>
          <Meter value={a.deviation} tone={a.deviation > OCC_THRESHOLDS.occupied ? "amber" : "acc"} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-line bg-raise/40 px-2.5 py-1.5">
            <div className="lbl">Motion</div>
            <div className={`font-disp text-[13px] font-semibold ${a.motionScore >= sim.motionCfg.threshold ? "text-amber" : "text-dim"}`}>
              {a.motionScore >= sim.motionCfg.threshold ? "YES" : "NO"}
            </div>
          </div>
          <div className="rounded border border-line bg-raise/40 px-2.5 py-1.5">
            <div className="lbl">Baseline</div>
            <div className={`font-disp text-[13px] font-semibold ${baseline ? "text-acc" : "text-red"}`}>
              {baseline ? "SET" : "NONE"}
            </div>
          </div>
        </div>
        <p className="text-[10.5px] leading-snug text-faint">{a.reason}</p>
        <button
          className="btn w-full !py-1.5"
          onClick={() => onChart(roomId)}
          title="Show this room's deviation chart"
        >
          <Icon name="wave" size={13} /> Deviation Trace
        </button>
      </div>
    </section>
  );
}

export default function OccupancyPage() {
  const world = useSim();
  const [chartRoom, setChartRoom] = useState(() => world.rooms[0]?.id ?? "");
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!world.rooms.some((r) => r.id === chartRoom)) setChartRoom(world.rooms[0]?.id ?? "");
  }, [world.rooms.length, chartRoom]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(id);
  }, [flash]);

  const room = world.rooms.find((r) => r.id === chartRoom);
  const assessment = sim.assessmentFor(chartRoom);
  const baseline = sim.baselineFor(chartRoom);

  const doCapture = () => {
    const res = sim.captureRoomBaseline(chartRoom);
    if (res.ok) {
      setFlash({
        ok: !res.warned,
        msg: res.warned
          ? `Baseline captured (${res.frames} frames) — but motion was present; estimates may be biased.`
          : `Baseline captured from ${res.frames} frames.`,
      });
    } else {
      setFlash({ ok: false, msg: res.error });
    }
  };

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Occupancy</h1>
          <p className="text-[12px] text-dim">Presence detection against an operator-captured empty-room baseline.</p>
        </div>
        <Chip tone="amber">
          <Icon name="alert" size={12} /> ESTIMATES · NOT GROUND TRUTH
        </Chip>
      </header>

      {/* ------------ baseline capture ------------ */}
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Empty-Room Baseline</span>
          <span className="mono ml-auto text-[10px] text-faint">REFERENCE FOR DEVIATION</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="lbl">Room</span>
            <select className="select" value={chartRoom} onChange={(e) => setChartRoom(e.target.value)} aria-label="Room">
              {world.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-acc" onClick={doCapture} title="Capture the current (empty) room as the baseline">
            <Icon name="seed" size={13} /> Capture Empty-Room Baseline
          </button>
          <button
            className="btn"
            onClick={() => sim.clearRoomBaseline(chartRoom)}
            disabled={!baseline}
            title="Remove this room's baseline (returns it to UNKNOWN)"
          >
            <Icon name="x" size={12} /> Clear
          </button>
          {baseline && (
            <span className="mono text-[10.5px] text-faint">
              captured {fmtClock(baseline.capturedAt)} · {Object.keys(baseline.sensors).length} node(s) · rssi {baseline.rssiMean.toFixed(0)} dBm
            </span>
          )}
        </div>
        {flash && (
          <div
            className={`mx-4 mb-3 rounded border px-3 py-2 text-[12px] ${
              flash.ok ? "border-acc/40 bg-acc/10 text-acc" : "border-amber/40 bg-amber/10 text-amber"
            }`}
          >
            {flash.msg}
          </div>
        )}
        <div className="border-t border-line px-4 py-2.5">
          <p className="text-[10.5px] leading-relaxed text-faint">
            Ensure the room is genuinely empty for several seconds before capturing. The baseline stores per-subcarrier
            amplitude mean/σ per node; live frames are scored by how far they deviate from it. Confidence is an
            algorithmic estimate of signal evidence — never guaranteed physical truth.
          </p>
        </div>
      </section>

      {/* ------------ room cards ------------ */}
      <div className="grid grid-cols-12 gap-3">
        {world.rooms.map((r) => (
          <RoomCard key={r.id} roomId={r.id} onChart={setChartRoom} />
        ))}
      </div>

      {/* ------------ deviation trace ------------ */}
      {room && (
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">{room.name} · Spectral Deviation</span>
            <span className="mono ml-auto text-[10px] text-faint">
              OCC ≥ {OCC_THRESHOLDS.occupied} · EMPTY ≤ {OCC_THRESHOLDS.empty}
            </span>
          </div>
          <LineChart
            windowSec={60}
            height={220}
            unit="dev"
            sourceLabel={sim.mode === "simulation" ? `SIMULATED CSI · SEED ${sim.cfg.seed}` : "NO SOURCE · LIVE MODE"}
            idleText={assessment.hasBaseline ? "AWAITING SAMPLES" : "NO BASELINE — CAPTURE AN EMPTY ROOM FIRST"}
            series={[
              {
                label: "deviation",
                color: "#5ab9ff",
                fill: true,
                domain: [0, 1],
                data: () => assessment.history,
              },
              {
                label: "occupied th",
                color: "#f2b34c",
                width: 1.2,
                domain: [0, 1],
                data: () => assessment.history.map((p) => ({ t: p.t, v: OCC_THRESHOLDS.occupied })),
              },
              {
                label: "empty th",
                color: "#3ce6a4",
                width: 1.2,
                domain: [0, 1],
                data: () => assessment.history.map((p) => ({ t: p.t, v: OCC_THRESHOLDS.empty })),
              },
            ]}
          />
        </section>
      )}

      <p className="mono text-[10.5px] text-faint">
        STATES: EMPTY · OCCUPIED · MOTION · STATIONARY · UNKNOWN — derived from baseline deviation + motion score with
        hysteresis. Estimates, not physical truth.
      </p>
    </div>
  );
}
