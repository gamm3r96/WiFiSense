/* ------------------------------------------------------------------ */
/* Sensor repository (Phase 2)                                         */
/*                                                                     */
/* Persistence boundary for sensor configuration rows. The interface   */
/* is storage-agnostic so the SQLite/PostgreSQL repository behind the  */
/* Node API (Phase 19–20: GET/POST/PUT/DELETE /api/sensors) can        */
/* replace the local adapter without touching the store or UI.         */
/* ------------------------------------------------------------------ */

import type { SensorConfig } from "../types";

export interface SensorRepository {
  load(): SensorConfig[] | null;
  save(configs: SensorConfig[]): void;
}

const LS_KEY = "wifisense.sensors.v1";

export class LocalStorageSensorRepo implements SensorRepository {
  load(): SensorConfig[] | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      // Defensive validation: drop malformed rows rather than crashing.
      return parsed.filter(
        (c): c is SensorConfig =>
          !!c &&
          typeof (c as SensorConfig).id === "string" &&
          typeof (c as SensorConfig).name === "string" &&
          typeof (c as SensorConfig).roomId === "string",
      );
    } catch {
      return null;
    }
  }

  save(configs: SensorConfig[]): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(configs));
    } catch {
      /* storage full or unavailable — configs remain in memory */
    }
  }
}

export const sensorRepo: SensorRepository = new LocalStorageSensorRepo();
