import { useEffect, useRef, useState } from "react";
import { Chip, Dot, Icon } from "../components/ui";
import { jsonLineParser, webSerialAvailable } from "../services/transport";
import { sim } from "../state/store";
import { downloadText } from "../utils/exporter";

interface SerialLine {
  id: number;
  t: number;
  raw: string;
  parsed: boolean;
  error?: boolean;
}

const BAUDS = [115200, 230400, 460800, 921600];

/**
 * Serial Monitor (Phase 11). Uses the Web Serial API when the browser
 * provides it (Chromium, user gesture required). Elsewhere the external
 * Python bridge is the supported path — arbitrary host serial devices
 * are never assumed reachable from the browser.
 */
export default function SerialMonitorPage() {
  const supported = webSerialAvailable();
  const [baud, setBaud] = useState(921600);
  const [connected, setConnected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lines, setLines] = useState<SerialLine[]>([]);
  const [showParsed, setShowParsed] = useState(true);
  const [portName, setPortName] = useState("");
  const portRef = useRef<{ port?: unknown; reader?: ReadableStreamDefaultReader<Uint8Array>; keep: boolean }>({ keep: false });
  const nextId = useRef(1);
  const parsedCount = useRef(0);
  const errorCount = useRef(0);
  const startedAt = useRef(0);
  const bufRef = useRef("");

  const append = (raw: string) => {
    const frame = jsonLineParser.canParse(raw) ? jsonLineParser.parse(raw) : null;
    if (frame) parsedCount.current++;
    const bad = raw.trim().length > 0 && !frame && raw.includes("ERR");
    if (bad) errorCount.current++;
    setLines((ls) => [...ls.slice(-399), { id: nextId.current++, t: Date.now(), raw, parsed: !!frame, error: bad }]);
  };

  const connect = async () => {
    if (!supported) return;
    try {
      const nav = navigator as unknown as { serial: { requestPort(): Promise<unknown> } };
      const port = (await nav.serial.requestPort()) as {
        open(o: { baudRate: number }): Promise<void>;
        readable: ReadableStream<Uint8Array> | null;
        getInfo(): { usbVendorId?: number };
      };
      await port.open({ baudRate: baud });
      portRef.current.port = port;
      portRef.current.keep = true;
      startedAt.current = Date.now();
      parsedCount.current = 0;
      errorCount.current = 0;
      setConnected(true);
      setPortName(`serial port (VID ${port.getInfo().usbVendorId ?? "n/a"})`);
      sim.logPublic("INFO", "serial", `Web Serial attached at ${baud} baud`);
      const reader = port.readable?.getReader();
      if (!reader) return;
      portRef.current.reader = reader;
      const dec = new TextDecoder();
      const pump = async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || !portRef.current.keep) break;
          bufRef.current += dec.decode(value, { stream: true });
          const parts = bufRef.current.split("\n");
          bufRef.current = parts.pop() ?? "";
          for (const p of parts) if (capturingRef.current) append(p.replace(/\r$/, ""));
        }
      };
      pump().catch(() => {
        errorCount.current++;
      });
    } catch (e) {
      sim.logPublic("WARNING", "serial", `Serial attach failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const capturingRef = useRef(capturing);
  capturingRef.current = capturing;

  const disconnect = async () => {
    portRef.current.keep = false;
    try {
      await portRef.current.reader?.cancel();
      const p = portRef.current.port as { close?(): Promise<void> } | undefined;
      await p?.close?.();
    } catch {
      /* already closed */
    }
    portRef.current = { keep: false };
    setConnected(false);
    setPortName("");
    sim.logPublic("INFO", "serial", "Serial port released");
  };

  useEffect(() => () => void disconnect(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = connected && startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
  const rate = elapsed > 1 ? parsedCount.current / elapsed : 0;

  const downloadLog = () => {
    const body = lines.map((l) => `${new Date(l.t).toISOString()}${l.parsed ? " [PARSED]" : ""}${l.error ? " [ERR]" : ""} ${l.raw}`).join("\n");
    downloadText(`serial_capture_${Date.now()}.log`, body, "text/plain");
  };

  const visible = (showParsed ? lines.filter((l) => l.parsed) : lines).slice(-160);

  return (
    <div className="fade-up space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-disp text-[19px] font-bold tracking-wide text-txt">Serial Monitor</h1>
          <p className="text-[12px] text-dim">Attach an ESP32-S3 over USB and watch raw / parsed CSI lines.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={connected ? "acc" : "dim"}>
            <Dot tone={connected ? "acc" : "dim"} size={6} pulse={connected} />
            {connected ? portName || "connected" : "detached"}
          </Chip>
          <Chip tone={supported ? "cyan" : "amber"}>{supported ? "web serial api" : "api unavailable"}</Chip>
        </div>
      </header>

      {/* transport deck */}
      <section className="panel">
        <div className="flex flex-wrap items-center gap-2.5 p-3.5">
          <select className="select" value={baud} onChange={(e) => setBaud(Number(e.target.value))} disabled={connected}>
            {BAUDS.map((b) => (
              <option key={b} value={b}>{b} baud</option>
            ))}
          </select>
          {!connected ? (
            <button className="btn btn-acc" onClick={connect} disabled={!supported}>
              <Icon name="plug" size={13} /> Connect Port
            </button>
          ) : (
            <button className="btn btn-amber" onClick={disconnect}>
              <Icon name="x" size={13} /> Disconnect
            </button>
          )}
          <button className={`btn ${capturing ? "btn-amber" : ""}`} onClick={() => setCapturing((v) => !v)} disabled={!connected}>
            <Icon name={capturing ? "pause" : "record"} size={12} /> {capturing ? "Stop Capture" : "Start Capture"}
          </button>
          <button className="btn" onClick={() => setLines([])}>
            <Icon name="x" size={12} /> Clear
          </button>
          <button className="btn" onClick={downloadLog} disabled={lines.length === 0}>
            <Icon name="download" size={13} /> Download Log
          </button>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="lbl">Parsed rate</div>
              <div className="mono text-[13px] text-acc">{connected ? rate.toFixed(1) : "0.0"} pkt/s</div>
            </div>
            <div className="text-right">
              <div className="lbl">Lines</div>
              <div className="mono text-[13px] text-txt">{lines.length}</div>
            </div>
            <div className="text-right">
              <div className="lbl">Errors</div>
              <div className={`mono text-[13px] ${errorCount.current ? "text-red" : "text-dim"}`}>{errorCount.current}</div>
            </div>
          </div>
        </div>
      </section>

      {!supported && (
        <section className="panel border-amber/40">
          <div className="p-4">
            <div className="flex items-center gap-2 text-amber">
              <Icon name="alert" size={15} />
              <span className="font-disp text-[13px] font-semibold tracking-wide">Web Serial unavailable in this browser</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The browser cannot reach arbitrary host serial devices here. Use the external Python bridge instead — it forwards
              <span className="mono"> /dev/ttyUSB0</span> or <span className="mono">/dev/ttyACM0</span> to the gateway:
            </p>
            <pre className="mono mt-2 overflow-x-auto rounded border border-line bg-bg2 p-3 text-[11px] text-cyan">
{`# on the host attached to the ESP32-S3
python -m wifisense.serial_bridge \\
    --port /dev/ttyUSB0 --baud 921600 \\
    --ws ws://localhost:8080/ws/serial`}
            </pre>
            <p className="mt-2 text-[10.5px] text-faint">
              Chromium-based browsers expose Web Serial behind a user gesture; Firefox/Safari do not.
            </p>
          </div>
        </section>
      )}

      {/* monitor */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">Capture Output</span>
          <label className="mono ml-auto flex items-center gap-2 text-[10.5px] text-dim">
            <input type="checkbox" checked={showParsed} onChange={(e) => setShowParsed(e.target.checked)} className="accent-[#3ce6a4]" />
            parsed frames only
          </label>
        </div>
        <div className="mono h-[340px] overflow-y-auto bg-bg2/80 p-3 text-[11px] leading-relaxed">
          {visible.length === 0 && (
            <div className="pt-24 text-center text-faint">
              {connected ? (capturing ? "LISTENING — no lines yet" : "CAPTURE PAUSED") : "NO PORT ATTACHED"}
            </div>
          )}
          {visible.map((l) => (
            <div key={l.id} className="flex gap-2 whitespace-pre-wrap break-all">
              <span className="shrink-0 text-faint">{new Date(l.t).toLocaleTimeString("en-GB", { hour12: false })}.{String(l.t % 1000).padStart(3, "0")}</span>
              {l.parsed && <span className="shrink-0 text-acc">[CSI]</span>}
              {l.error && <span className="shrink-0 text-red">[ERR]</span>}
              <span className={l.parsed ? "text-txt" : "text-dim"}>{l.raw || "·"}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="mono text-[10.5px] text-faint">
        Lines are shown as received — no packet format is assumed. The JSON debug parser marks frames it can decode; everything else passes through untouched.
      </p>
    </div>
  );
}
