import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CHANNELS } from "../simulation/engine";
import { isValidIp, isValidMac, randomMac, sim, useSim } from "../state/store";
import type { SensorConfig, TransportKind } from "../types";
import { Icon, Toggle } from "./ui";

/* ------------------------------ shell ------------------------------ */

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  width = 520,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080d]/75 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="panel fade-up max-h-[90vh] w-full overflow-y-auto"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="panel-head">
          <div className="flex-1">
            <div className="panel-title">{title}</div>
            {subtitle && <div className="mt-0.5 text-[11px] text-faint">{subtitle}</div>}
          </div>
          <button className="btn !px-2 !py-1" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={13} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------- sensor form --------------------------- */

const HARDWARES = ["ESP32-S3 · esp-csi", "ESP32-S3 · DevKitC-1", "ESP32-C6 (planned)"];
const RATES = [10, 25, 50, 100];
const TRANSPORTS: { v: TransportKind; label: string }[] = [
  { v: "udp", label: "UDP (recommended)" },
  { v: "tcp", label: "TCP" },
  { v: "serial", label: "USB Serial" },
];

export function SensorFormModal({
  initial,
  onClose,
  onSaved,
}: {
  /** When set ⇒ edit mode. */
  initial?: SensorConfig;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  useSim();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? `ESP32-S3-C${String(sim.configs.filter((c) => c.custom).length + 1).padStart(2, "0")}`);
  const [roomId, setRoomId] = useState(initial?.roomId ?? sim.world.rooms[0]?.id ?? "room-1");
  const [band, setBand] = useState<SensorConfig["band"]>(initial?.band ?? "2.4 GHz");
  const [channel, setChannel] = useState(initial?.channel ?? 6);
  const [hardware, setHardware] = useState(initial?.hardware ?? HARDWARES[0]);
  const [firmware, setFirmware] = useState(initial?.firmware ?? "v0.9.2-sim");
  const [transport, setTransport] = useState<TransportKind>(initial?.transport ?? "udp");
  const [sampleRate, setSampleRate] = useState(initial?.sampleRate ?? 100);
  const [ip, setIp] = useState(initial?.ip ?? sim.suggestIp());
  const [mac, setMac] = useState(initial?.mac ?? randomMac());
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  const channels = useMemo(() => CHANNELS.filter((c) => c.band === band).map((c) => c.ch), [band]);

  const changeBand = (b: SensorConfig["band"]) => {
    setBand(b);
    const first = CHANNELS.find((c) => c.band === b);
    if (first) setChannel(first.ch);
  };

  const submit = () => {
    setError(null);
    const payload = {
      name,
      roomId,
      band,
      channel,
      hardware,
      firmware,
      transport,
      sampleRate,
      ip: ip.trim(),
      mac: mac.trim(),
      enabled,
    };
    const res = editing ? sim.updateSensor(initial!.id, payload) : sim.addSensor(payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved(res.id);
    onClose();
  };

  const field = "flex flex-col gap-1.5";

  return (
    <ModalShell
      title={editing ? `Edit ${initial!.name}` : "Provision Sensor"}
      subtitle={
        editing
          ? `Configuration row ${initial!.id} · changes apply to the gateway immediately`
          : "Registers a node in the fleet config (repository) and provisions a gateway link"
      }
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div className={`${field} sm:col-span-2`}>
          <label className="lbl" htmlFor="sf-name">Sensor name</label>
          <input id="sf-name" type="text" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="ESP32-S3-C01" autoFocus />
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-room">Room assignment</label>
          <select id="sf-room" className="select" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {sim.world.rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-hw">Hardware</label>
          <select id="sf-hw" className="select" value={hardware} onChange={(e) => setHardware(e.target.value)}>
            {HARDWARES.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-band">Band</label>
          <select id="sf-band" className="select" value={band} onChange={(e) => changeBand(e.target.value as SensorConfig["band"])}>
            <option value="2.4 GHz">2.4 GHz</option>
            <option value="5 GHz">5 GHz</option>
          </select>
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-ch">Channel</label>
          <select id="sf-ch" className="select" value={channel} onChange={(e) => setChannel(Number(e.target.value))}>
            {channels.map((ch) => (
              <option key={ch} value={ch}>CH {ch}</option>
            ))}
          </select>
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-rate">CSI sample rate</label>
          <select id="sf-rate" className="select" value={sampleRate} onChange={(e) => setSampleRate(Number(e.target.value))}>
            {RATES.map((r) => (
              <option key={r} value={r}>{r} samples/s</option>
            ))}
          </select>
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-transport">Transport (Phase 10)</label>
          <select id="sf-transport" className="select" value={transport} onChange={(e) => setTransport(e.target.value as TransportKind)}>
            {TRANSPORTS.map((t) => (
              <option key={t.v} value={t.v}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-fw">Firmware</label>
          <input id="sf-fw" type="text" value={firmware} maxLength={20} onChange={(e) => setFirmware(e.target.value)} />
        </div>

        <div className={field}>
          <label className="lbl" htmlFor="sf-ip">IP address</label>
          <div className="flex gap-1.5">
            <input
              id="sf-ip"
              type="text"
              className="flex-1"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              style={!isValidIp(ip.trim()) ? { borderColor: "#f2695c" } : undefined}
            />
            <button type="button" className="btn !px-2.5 !py-1 text-[10px]" onClick={() => setIp(sim.suggestIp())} title="Suggest next free address">
              Auto
            </button>
          </div>
        </div>

        <div className={`${field} sm:col-span-2`}>
          <label className="lbl" htmlFor="sf-mac">MAC address</label>
          <div className="flex gap-1.5">
            <input
              id="sf-mac"
              type="text"
              className="mono flex-1 uppercase"
              value={mac}
              maxLength={17}
              onChange={(e) => setMac(e.target.value)}
              style={!isValidMac(mac.trim()) ? { borderColor: "#f2695c" } : undefined}
            />
            <button type="button" className="btn !px-2.5 !py-1 text-[10px]" onClick={() => setMac(randomMac())} title="Generate locally-administered MAC">
              Random
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded border border-line bg-raise/50 px-3 py-2.5 sm:col-span-2">
          <div>
            <div className="text-[12.5px] font-medium text-txt">Node enabled</div>
            <div className="text-[10.5px] text-faint">Disabled nodes are held offline by the gateway</div>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded border border-red/40 bg-red/10 px-3 py-2 text-[12px] text-red sm:col-span-2">
            <Icon name="alert" size={14} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" onClick={submit}>
            <Icon name={editing ? "gear" : "plug"} size={13} />
            {editing ? "Apply Changes" : "Provision Node"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------------------- confirm ------------------------------ */

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title={title} onClose={onClose} width={420}>
      <div className="p-4">
        <div className="text-[13px] leading-relaxed text-dim">{body}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn !border-red/50 !bg-red/10 !text-red hover:!border-red"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Icon name="x" size={13} /> {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
