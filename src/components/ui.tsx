import type { ReactNode } from "react";
import type { RoomState, Severity } from "../types";
import { clamp01 } from "../utils/format";

/* ------------------------------ icons ------------------------------ */

export type IconName =
  | "grid" | "chip" | "wave" | "zap" | "user" | "pulse" | "database"
  | "sliders" | "cpu" | "map" | "list" | "terminal" | "gear" | "alert"
  | "play" | "pause" | "antenna" | "chevron" | "download" | "flask"
  | "x" | "plug" | "seed";

const ICONS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </>
  ),
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
    </>
  ),
  wave: <path d="M2 13c2.2-6.5 4.3-6.5 6.5 0s4.3 6.5 6.5 0 4.3-6.5 6.5 0" />,
  zap: <path d="M13 2 4.5 13.5h5.5L11 22l8.5-11.5H14L13 2z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.6-4.2 4.6-6.2 8-6.2s6.4 2 8 6.2" />
    </>
  ),
  pulse: <path d="M2 12h4l3-8 4.5 16 3-8H22" />,
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5V18.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0.01" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  cpu: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  map: (
    <>
      <path d="M9 3.5 3 5.5v15l6-2 6 2 6-2v-15l-6 2-6-2z" />
      <path d="M9 3.5v15M15 5.5v15" />
    </>
  ),
  list: (
    <>
      <path d="M8.5 6h12M8.5 12h12M8.5 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <path d="M7 9.5l3 3-3 3M12.5 15.5H17" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 19.5h19L12 3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  play: <path d="M7 4.5 19 12 7 19.5v-15z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  antenna: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  flask: (
    <>
      <path d="M9.5 3h5M10.5 3v5.5L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L13.5 8.5V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plug: (
    <>
      <path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8zM12 16.5V21" />
    </>
  ),
  seed: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className = "",
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* --------------------------- status bits --------------------------- */

export type Tone = "acc" | "amber" | "red" | "blue" | "cyan" | "dim";

export const TONE_TEXT: Record<Tone, string> = {
  acc: "text-acc",
  amber: "text-amber",
  red: "text-red",
  blue: "text-blue",
  cyan: "text-cyan",
  dim: "text-dim",
};

export const TONE_BG: Record<Tone, string> = {
  acc: "bg-acc",
  amber: "bg-amber",
  red: "bg-red",
  blue: "bg-blue",
  cyan: "bg-cyan",
  dim: "bg-faint",
};

export function Dot({ tone, pulse = false, size = 7 }: { tone: Tone; pulse?: boolean; size?: number }) {
  return (
    <span
      className={`inline-block rounded-full ${TONE_BG[tone]} ${pulse ? "led-live" : ""}`}
      style={{ width: size, height: size }}
    />
  );
}

const CHIP_STYLE: Record<Tone, string> = {
  acc: "text-acc border-acc/40 bg-acc/10",
  amber: "text-amber border-amber/40 bg-amber/10",
  red: "text-red border-red/40 bg-red/10",
  blue: "text-blue border-blue/40 bg-blue/10",
  cyan: "text-cyan border-cyan/40 bg-cyan/10",
  dim: "text-dim border-line2 bg-raise/60",
};

export function Chip({ tone = "dim", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${CHIP_STYLE[tone]}`}>{children}</span>;
}

export function severityTone(s: Severity): Tone {
  return s === "error" ? "red" : s === "warn" ? "amber" : "blue";
}

export function stateTone(st: RoomState): Tone {
  switch (st) {
    case "EMPTY": return "dim";
    case "ENTERING": return "blue";
    case "WALKING": return "acc";
    case "STANDING": return "amber";
    case "SITTING": return "cyan";
    case "LEAVING": return "red";
  }
}

/* --------------------------- data visuals -------------------------- */

export function Sparkline({
  data,
  color = "#3ce6a4",
  height = 26,
  className = "",
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const w = 120;
  if (data.length < 2) {
    return <svg width="100%" height={height} className={className} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Meter({ value, tone = "acc", label }: { value: number; tone?: Tone; label?: string }) {
  const pct = Math.round(clamp01(value) * 100);
  const bar: Record<Tone, string> = {
    acc: "bg-acc",
    amber: "bg-amber",
    red: "bg-red",
    blue: "bg-blue",
    cyan: "bg-cyan",
    dim: "bg-faint",
  };
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between">
          <span className="lbl">{label}</span>
          <span className="mono text-[11px] text-dim">{pct}%</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-sm bg-raise">
        <div
          className={`h-full rounded-sm ${bar[tone]} transition-[width] duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[42px] rounded-full border transition-colors duration-200 ${
        checked ? "border-acc/60 bg-acc/25" : "border-line2 bg-raise"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all duration-200 ${
          checked ? "left-[22px] bg-acc" : "left-[3px] bg-faint"
        }`}
      />
    </button>
  );
}
