/* ------------------------------------------------------------------ */
/* Empty-room baseline repository (Phase 6).                           */
/*                                                                     */
/* Persists per-room baselines so captures survive reloads. Storage    */
/* shape is plain JSON (Float64Array → number[]) — the same rows will  */
/* live in the `room_baselines` table behind /api/baselines once the   */
/* Node backend lands; swap the adapter, keep the interface.           */
/* ------------------------------------------------------------------ */

import type { RoomBaseline } from "../processing/occupancy";

export interface BaselineRepository {
  load(): Record<string, RoomBaseline> | null;
  save(baselines: Record<string, RoomBaseline>): void;
}

const LS_KEY = "wifisense.baselines.v1";

export class LocalStorageBaselineRepo implements BaselineRepository {
  load(): Record<string, RoomBaseline> | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      // Defensive: drop rows that lost their statistics.
      const out: Record<string, RoomBaseline> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const b = v as RoomBaseline;
        if (b && typeof b.roomId === "string" && b.sensors && typeof b.sensors === "object") out[k] = b;
      }
      return out;
    } catch {
      return null;
    }
  }

  save(baselines: Record<string, RoomBaseline>): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(baselines));
    } catch {
      /* storage unavailable — baselines remain in memory */
    }
  }
}

export const baselineRepo: BaselineRepository = new LocalStorageBaselineRepo();
