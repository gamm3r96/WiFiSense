/* ------------------------------------------------------------------ */
/* WiFiSense Lab — Hardware transport layer (Phase 10/11).             */
/*                                                                     */
/* Expected flow per the platform architecture:                        */
/*                                                                     */
/*   ESP32-S3 → CSI packet → Transport adapter → Parser → CSI object   */
/*            → Signal pipeline                                        */
/*                                                                     */
/* IMPORTANT honesty rule: the binary/line protocol of the esp-csi     */
/* firmware build has NOT been supplied. Until it is, only documented  */
/* placeholder adapters exist. The JSON-line parser below supports a   */
/* simple, explicitly-defined debug format so firmware bring-up can    */
/* start immediately — no undocumented formats are invented.           */
/* ------------------------------------------------------------------ */

export interface CSIFrame {
  seq: number;
  timestampMs: number;
  rssi?: number;
  amplitudes?: number[];
  phases?: number[];
  raw: string;
}

export interface CSIPacketParser {
  readonly name: string;
  /** True when this parser claims the line. */
  canParse(line: string): boolean;
  /** Returns null for lines it cannot decode (never throws). */
  parse(line: string): CSIFrame | null;
}

export interface CSITransportAdapter {
  kind: "serial" | "udp" | "tcp";
  name: string;
  description: string;
  /** Placeholder until real protocol integration. */
  status: "placeholder";
}

/** Placeholder: refuses every line. Keeps the pipeline safe until the
    real esp-csi packet format is supplied. */
export class PlaceholderParser implements CSIPacketParser {
  readonly name = "placeholder — protocol not supplied";
  canParse(): boolean {
    return false;
  }
  parse(): CSIFrame | null {
    return null;
  }
}

/**
 * Explicitly-defined debug format for firmware bring-up:
 *   {"seq":12,"rssi":-52,"amp":[0.8,...],"phase":[0.1,...]}
 * Anything else is rejected — the parser never guesses.
 */
export class JsonLineParser implements CSIPacketParser {
  readonly name = "json-line debug parser";
  canParse(line: string): boolean {
    const t = line.trim();
    return t.startsWith("{") && t.includes('"seq"');
  }
  parse(line: string): CSIFrame | null {
    try {
      const o = JSON.parse(line) as {
        seq?: number;
        rssi?: number;
        amp?: number[];
        phase?: number[];
      };
      if (typeof o.seq !== "number") return null;
      return {
        seq: o.seq,
        timestampMs: Date.now(),
        rssi: typeof o.rssi === "number" ? o.rssi : undefined,
        amplitudes: Array.isArray(o.amp) ? o.amp.filter((v) => typeof v === "number") : undefined,
        phases: Array.isArray(o.phase) ? o.phase.filter((v) => typeof v === "number") : undefined,
        raw: line,
      };
    } catch {
      return null;
    }
  }
}

export const jsonLineParser = new JsonLineParser();
export const placeholderParser = new PlaceholderParser();

export const ESP32_ADAPTERS: CSITransportAdapter[] = [
  {
    kind: "serial",
    name: "USB Serial (pyserial / Web Serial)",
    description:
      "ESP32-S3 USB-JTAG/CDC or CP2102 bridge. Device appears as /dev/ttyUSB0 or /dev/ttyACM0 on Linux. The Serial Monitor (Phase 11) can attach via Web Serial in Chromium, or via the Python bridge otherwise.",
    status: "placeholder",
  },
  {
    kind: "udp",
    name: "UDP stream (esp-csi default)",
    description:
      "Node broadcasts CSI frames to a gateway port. Adapter binds the socket and forwards raw datagrams to the parser. Requires the firmware's frame layout before decoding.",
    status: "placeholder",
  },
  {
    kind: "tcp",
    name: "TCP client (reliable transport)",
    description:
      "Optional reliable transport for loss-sensitive captures. Same parser stage; transport only guarantees ordering.",
    status: "placeholder",
  },
];

/** True when the browser exposes the Web Serial API (Chromium only). */
export function webSerialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}
