/* ------------------------------------------------------------------ */
/* Room map persistence (Phase 13).                                    */
/* One building / one floor for v1 — the schema keeps `building` and   */
/* `floor` as separate documents so multiple floors/sites can be       */
/* added later without migration. Coordinates are normalized (0..1).   */
/* ------------------------------------------------------------------ */

export interface PlanRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorPlan {
  id: string;
  name: string;
  widthM: number;
  heightM: number;
  rooms: PlanRoom[];
}

export interface SensorPlacement {
  x: number;
  y: number;
}

export interface MapData {
  building: string;
  floor: FloorPlan;
  placements: Record<string, SensorPlacement>;
}

const LS_KEY = "wifisense.map.v1";

/** Deterministic default layout derived from the live room list. */
export function defaultMapData(rooms: Array<{ id: string; name: string }>, sensorRooms: Record<string, string>): MapData {
  const plan: PlanRoom[] = rooms.map((r, i) => {
    // 2-column grid with deterministic slots.
    const col = i % 2;
    const row = Math.floor(i / 2);
    return {
      id: r.id,
      name: r.name,
      x: 0.03 + col * 0.485,
      y: 0.06 + row * 0.46,
      w: 0.455,
      h: 0.4,
    };
  });
  const placements: Record<string, SensorPlacement> = {};
  Object.entries(sensorRooms).forEach(([sensorId, roomId], idx) => {
    const room = plan.find((p) => p.id === roomId) ?? plan[idx % Math.max(1, plan.length)];
    if (!room) return;
    placements[sensorId] = {
      x: room.x + room.w * (0.18 + 0.64 * ((idx * 37) % 10) / 10),
      y: room.y + room.h * (0.2 + 0.6 * ((idx * 53) % 10) / 10),
    };
  });
  return {
    building: "WiFiSense HQ",
    floor: { id: "floor-1", name: "Ground Floor", widthM: 16, heightM: 10, rooms: plan },
    placements,
  };
}

export const mapRepo = {
  load(): MapData | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MapData;
      if (!parsed?.floor?.rooms?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  save(data: MapData): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      /* non-fatal */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* non-fatal */
    }
  },
};
