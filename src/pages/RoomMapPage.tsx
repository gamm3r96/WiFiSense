import { useMemo, useRef, useState } from "react";
import { Chip, Dot, Icon } from "../components/ui";
import { defaultMapData, mapRepo, type MapData } from "../services/mapRepo";
import { isPresence } from "../processing/occupancy";
import { sim, useSim } from "../state/store";

const W = 100;
const H = 62;

const STATE_FILL: Record<string, string> = {
  EMPTY: "rgba(91,108,130,0.08)",
  OCCUPIED: "rgba(60,230,164,0.16)",
  MOTION: "rgba(242,179,76,0.20)",
  STATIONARY: "rgba(69,216,208,0.16)",
  UNKNOWN: "rgba(42,59,82,0.10)",
};

/**
 * Room map (Phase 13). Sensor placement is user-editable; occupancy and
 * person markers are algorithmic estimates. Person positions are
 * APPROXIMATE — no localization model exists yet.
 */
export default function RoomMapPage() {
  const world = useSim();
  const [map, setMap] = useState<MapData>(() => {
    const stored = mapRepo.load();
    if (stored) return stored;
    const rooms = sim.world.rooms.map((r) => ({ id: r.id, name: r.name }));
    const sensorRooms: Record<string, string> = {};
    sim.world.sensors.forEach((s) => (sensorRooms[s.id] = s.roomId));
    return defaultMapData(rooms, sensorRooms);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<string | null>(null);

  const persist = (next: MapData) => {
    setMap(next);
    mapRepo.save(next);
  };

  const toNorm = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(0.99, Math.max(0.01, ((e.clientX - rect.left) / rect.width) * W)) ,
      y: Math.min(0.99, Math.max(0.02, ((e.clientY - rect.top) / rect.height) * H)),
    };
  };

  const moveSensor = (id: string, e: { clientX: number; clientY: number }) => {
    const p = toNorm(e);
    persist({ ...map, placements: { ...map.placements, [id]: { x: p.x / W, y: p.y / H } } });
  };

  const addRoom = () => {
    const name = newRoomName.trim().slice(0, 24);
    if (!name) return;
    const idx = map.floor.rooms.length;
    const room = {
      id: `plan_${Date.now().toString(36)}`,
      name,
      x: 0.03 + (idx % 2) * 0.485,
      y: 0.06 + Math.floor(idx / 2) * 0.46,
      w: 0.455,
      h: 0.4,
    };
    persist({ ...map, floor: { ...map.floor, rooms: [...map.floor.rooms, room] } });
    setNewRoomName("");
    sim.logPublic("INFO", "map", `Plan room added: ${name}`);
  };

  const resetLayout = () => {
    mapRepo.clear();
    const rooms = sim.world.rooms.map((r) => ({ id: r.id, name: r.name }));
    const sensorRooms: Record<string, string> = {};
    sim.world.sensors.forEach((s) => (sensorRooms[s.id] = s.roomId));
    persist(defaultMapData(rooms, sensorRooms));
  };

  const selRoom = map.floor.rooms.find((r) => r.id === selected) ?? null;
  const selAssessment = selRoom ? sim.assessmentFor(selRoom.id) : null;

  const occupiedRooms = useMemo(
    () => world.rooms.filter((r) => isPresence(sim.assessmentFor(r.id).state)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.rooms, world.tickIndex],
  );

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Room Map</h1>
          <p className="text-[12px] text-dim">
            {map.building} · {map.floor.name} — drag nodes to place them; occupancy is estimated.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input type="text" placeholder="New room name" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} />
          <button className="btn !py-1.5" onClick={addRoom}>
            <Icon name="map" size={13} /> Add Room
          </button>
          <button className="btn !py-1.5" onClick={resetLayout}>
            <Icon name="seed" size={13} /> Reset Layout
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* ---------------- floor plan ---------------- */}
        <section className="panel col-span-12 xl:col-span-8">
          <div className="panel-head">
            <span className="panel-title">Floor Plan</span>
            <span className="mono ml-auto text-[10px] text-faint">
              {map.floor.widthM} m × {map.floor.heightM} m · POSITIONS APPROXIMATE
            </span>
          </div>
          <div className="p-3">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full select-none rounded border border-line bg-bg2/70"
              style={{ aspectRatio: `${W}/${H}` }}
              onPointerMove={(e) => dragRef.current && moveSensor(dragRef.current, e)}
              onPointerUp={() => (dragRef.current = null)}
              onPointerLeave={() => (dragRef.current = null)}
            >
              {/* grid */}
              {Array.from({ length: 19 }, (_, i) => (
                <line key={`v${i}`} x1={(i + 1) * 5} y1={0} x2={(i + 1) * 5} y2={H} stroke="rgba(42,59,82,0.25)" strokeWidth={0.15} />
              ))}
              {Array.from({ length: 11 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={(i + 1) * 5.5} x2={W} y2={(i + 1) * 5.5} stroke="rgba(42,59,82,0.25)" strokeWidth={0.15} />
              ))}

              {/* rooms */}
              {map.floor.rooms.map((room) => {
                const eng = world.rooms.find((r) => r.id === room.id);
                const a = eng ? sim.assessmentFor(room.id) : null;
                const state = a?.state ?? "UNKNOWN";
                const fill = STATE_FILL[state];
                const isSel = selected === room.id;
                return (
                  <g key={room.id} onClick={() => setSelected(room.id)} className="cursor-pointer">
                    <rect
                      x={room.x * W}
                      y={room.y * H}
                      width={room.w * W}
                      height={room.h * H}
                      rx={1}
                      fill={fill}
                      stroke={isSel ? "#3ce6a4" : "#2a3b52"}
                      strokeWidth={isSel ? 0.5 : 0.3}
                      strokeDasharray={eng ? undefined : "1.2 0.8"}
                    />
                    <text x={room.x * W + 1.6} y={room.y * H + 3.4} fontSize={2.6} fill="#e6edf6" fontFamily="Chakra Petch, sans-serif" fontWeight={600}>
                      {room.name}
                    </text>
                    <text x={room.x * W + 1.6} y={room.y * H + 6.4} fontSize={1.9} fill={a && isPresence(a.state) ? "#3ce6a4" : "#5b6c82"} fontFamily="IBM Plex Mono, monospace">
                      {state}
                      {a && isPresence(a.state) ? ` · ${a.confidence}%` : ""}
                    </text>
                  </g>
                );
              })}

              {/* approximate person markers */}
              {occupiedRooms.map((r, i) => {
                const plan = map.floor.rooms.find((p) => p.id === r.id);
                if (!plan) return null;
                const cx = (plan.x + plan.w / 2) * W + (i % 2 === 0 ? -4 : 4);
                const cy = (plan.y + plan.h / 2) * H + 2;
                return (
                  <g key={`p-${r.id}`} opacity={0.95}>
                    <circle cx={cx} cy={cy} r={2.6} fill="none" stroke="#f2b34c" strokeWidth={0.35}>
                      <animate attributeName="r" values="2.2;3.4;2.2" dur="2.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0.25;0.9" dur="2.2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy - 0.8} r={0.85} fill="#f2b34c" />
                    <path d={`M ${cx - 1.3} ${cy + 1.6} q 1.3 -2 2.6 0`} stroke="#f2b34c" strokeWidth={0.45} fill="none" strokeLinecap="round" />
                    <text x={cx + 3.4} y={cy + 0.8} fontSize={1.7} fill="#f2b34c" fontFamily="IBM Plex Mono, monospace">
                      ≈ person
                    </text>
                  </g>
                );
              })}

              {/* sensors */}
              {world.sensors.map((s) => {
                const p = map.placements[s.id] ?? { x: 0.5, y: 0.5 };
                const x = p.x * W;
                const y = p.y * H;
                const online = s.online && s.enabled;
                const motion = online && s.motionScore > 0.45;
                const color = sim.isUpdating(s.id) ? "#5ab9ff" : !s.enabled ? "#5b6c82" : online ? "#3ce6a4" : "#f2695c";
                return (
                  <g
                    key={s.id}
                    transform={`translate(${x} ${y})`}
                    className="cursor-grab"
                    onPointerDown={(e) => {
                      dragRef.current = s.id;
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    }}
                  >
                    {motion && (
                      <circle r={3.4} fill="none" stroke="#f2b34c" strokeWidth={0.3}>
                        <animate attributeName="r" values="2.4;4.4" dur="1.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r={1.9} fill="#101722" stroke={color} strokeWidth={0.45} />
                    <path d="M -0.9 0.2 a 1.25 1.25 0 0 1 1.8 0 M -0.5 -0.35 a 0.75 0.75 0 0 1 1 0" stroke={color} strokeWidth={0.3} fill="none" strokeLinecap="round" />
                    <circle cy={0.75} r={0.28} fill={color} />
                    <text y={4.4} textAnchor="middle" fontSize={1.8} fill="#8fa1b6" fontFamily="IBM Plex Mono, monospace">
                      {s.name.replace("ESP32-S3-", "S3-")}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
              <Legend color="#3ce6a4" label="node online" />
              <Legend color="#f2695c" label="node offline" />
              <Legend color="#5ab9ff" label="updating" />
              <Legend color="#f2b34c" label="motion / ≈ person" />
              <span className="mono ml-auto text-[9.5px] text-faint">≈ APPROXIMATE POSITION — NOT LOCALIZATION</span>
            </div>
          </div>
        </section>

        {/* ---------------- side panel ---------------- */}
        <div className="col-span-12 space-y-3 xl:col-span-4">
          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">{selRoom ? selRoom.name : "Room Inspector"}</span>
              {selAssessment && (
                <Chip
                  tone={
                    selAssessment.state === "OCCUPIED"
                      ? "acc"
                      : selAssessment.state === "MOTION"
                        ? "amber"
                        : selAssessment.state === "STATIONARY"
                          ? "cyan"
                          : "dim"
                  }
                >
                  {selAssessment.state}
                </Chip>
              )}
            </div>
            <div className="p-4">
              {!selRoom && <p className="mono pt-4 text-center text-[10.5px] text-faint">SELECT A ROOM ON THE PLAN</p>}
              {selRoom && selAssessment && (
                <div className="space-y-2.5">
                  <Row k="Occupancy" v={selAssessment.state} />
                  <Row k="Confidence (est.)" v={`${selAssessment.confidence}%`} />
                  <Row k="Baseline" v={sim.baselineFor(selRoom.id) ? "captured" : "none — UNKNOWN until captured"} />
                  <Row k="Sensors" v={`${world.sensors.filter((s) => s.roomId === selRoom.id).length} assigned`} />
                  <p className="pt-1 text-[10.5px] leading-relaxed text-faint">
                    Estimates compare live CSI against the captured empty-room baseline. They are algorithmic — not guaranteed physical truth.
                  </p>
                </div>
              )}
              {selRoom && !selAssessment && (
                <p className="text-[11.5px] leading-relaxed text-dim">
                  Plan-only room — no sensing node reports into it, so no occupancy estimate exists.
                </p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Nodes on Map</span>
              <span className="mono ml-auto text-[10px] text-faint">{world.sensors.length}</span>
            </div>
            <ul className="max-h-[240px] divide-y divide-line/60 overflow-y-auto">
              {world.sensors.map((s) => {
                const a = sim.assessmentFor(s.roomId);
                return (
                  <li key={s.id} className="event-row flex items-center gap-2.5 px-3.5 py-2">
                    <Dot tone={sim.isUpdating(s.id) ? "blue" : !s.enabled ? "dim" : s.online ? "acc" : "red"} size={7} pulse={s.online && s.enabled} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-txt">{s.name}</div>
                      <div className="mono text-[9.5px] text-faint">{s.roomName}</div>
                    </div>
                    <Chip tone={a && isPresence(a.state) ? "acc" : "dim"}>{a?.state ?? "UNKNOWN"}</Chip>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="mono text-[10px] leading-relaxed text-faint">
            NOTE: person markers show the room with presence evidence, not a tracked position. Exact localization requires a validated model
            that does not exist in this platform yet.
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="mono text-[9.5px] text-dim">{label}</span>
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="lbl">{k}</span>
      <span className="mono text-[12px] text-txt">{v}</span>
    </div>
  );
}
