/* ------------------------------------------------------------------ */
/* Dataset repository (Phase 7)                                        */
/*                                                                     */
/* Persistence boundary for recorded CSI datasets. Two-tier layout:    */
/*   · index  — a small array of DatasetMeta (no sample payloads) so   */
/*              the browser table loads instantly                      */
/*   · blob   — one entry per dataset holding meta + samples + labels, */
/*              fetched on demand for viewing / export                 */
/*                                                                     */
/* The interface is storage-agnostic: the Node/SQLite repository       */
/* behind `GET/POST /api/datasets` (Phase 19–20) can replace the       */
/* localStorage adapter without touching the store or UI.              */
/* ------------------------------------------------------------------ */

import type { DatasetMeta, DatasetSample } from "../types";

export interface DatasetRecord {
  meta: DatasetMeta;
  samples: DatasetSample[];
}

export interface DatasetRepository {
  /** Metadata index (newest first). */
  loadIndex(): DatasetMeta[];
  /** Full record for one dataset, or null when missing/corrupt. */
  load(id: string): DatasetRecord | null;
  /** Upsert a dataset record and refresh the index. */
  save(record: DatasetRecord): void;
  remove(id: string): void;
}

const INDEX_KEY = "wifisense.datasets.index.v1";
const blobKey = (id: string) => `wifisense.datasets.${id}.v1`;

function isMeta(m: unknown): m is DatasetMeta {
  if (!m || typeof m !== "object") return false;
  const x = m as DatasetMeta;
  return typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.labels);
}

export class LocalStorageDatasetRepo implements DatasetRepository {
  private memoryIndex: DatasetMeta[] | null = null;
  private memoryBlobs = new Map<string, DatasetRecord>();

  loadIndex(): DatasetMeta[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (!raw) return this.memoryIndex ?? [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const metas = parsed.filter(isMeta);
      // Newest first by creation time.
      return metas.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return this.memoryIndex ?? [];
    }
  }

  load(id: string): DatasetRecord | null {
    // Memory-first so in-session recordings are always retrievable even if
    // a quota error prevented the earlier persist.
    const mem = this.memoryBlobs.get(id);
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(blobKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DatasetRecord;
      if (!parsed || !isMeta(parsed.meta) || !Array.isArray(parsed.samples)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save(record: DatasetRecord): void {
    this.memoryBlobs.set(record.meta.id, record);
    // Maintain the in-memory index as the source of truth ordering.
    this.memoryIndex = [
      record.meta,
      ...(this.memoryIndex ?? this.loadIndex()).filter((m) => m.id !== record.meta.id),
    ];
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(this.memoryIndex));
      localStorage.setItem(blobKey(record.meta.id), JSON.stringify(record));
    } catch {
      /* quota exceeded — record remains available in memory this session */
    }
  }

  remove(id: string): void {
    this.memoryBlobs.delete(id);
    this.memoryIndex = (this.memoryIndex ?? this.loadIndex()).filter((m) => m.id !== id);
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(this.memoryIndex));
      localStorage.removeItem(blobKey(id));
    } catch {
      /* best effort */
    }
  }
}

export const datasetRepo: DatasetRepository = new LocalStorageDatasetRepo();
