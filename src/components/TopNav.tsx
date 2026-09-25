import { useEffect, useState } from "react";
import { APP_VERSION, PHASE, sim, useSimVersion } from "../state/store";
import type { PageId } from "../nav";
import { fmtClockUTC } from "../utils/format";
import { Chip, Dot, Icon } from "./ui";

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-md border border-acc/40 bg-acc/10 text-acc">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <circle cx="12" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
          <path d="M8.2 11a5.4 5.4 0 0 1 7.6 0" />
          <path d="M5.4 8a9.4 9.4 0 0 1 13.2 0" />
          <path d="M2.8 5a13.2 13.2 0 0 1 18.4 0" />
          <path d="M12 16.5V21" />
        </svg>
      </span>
      <div className="leading-none">
        <div className="font-disp text-[15px] font-bold tracking-wide text-txt">
          WiFiSense<span className="text-acc"> Lab</span>
        </div>
        <div className="mono mt-0.5 text-[9px] tracking-[0.18em] text-faint">
          CSI SENSING PLATFORM · v{APP_VERSION} · PHASE {PHASE}
        </div>
      </div>
    </div>
  );
}

export default function TopNav({
  page,
  go,
  onMenuClick,
}: {
  page: PageId;
  go: (p: PageId) => void;
  onMenuClick?: () => void;
}) {
  useSimVersion();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const live = sim.streaming;
  const isSim = sim.mode === "simulation";
  const label = NAV_LABEL[page];

  return (
    <header className="flex h-[54px] shrink-0 items-center gap-4 border-b border-line bg-bg2/90 px-4 backdrop-blur-sm">
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn btn !px-2 !py-1.5 md:hidden"
        onClick={onMenuClick}
        aria-label="Toggle navigation menu"
      >
        <Icon name="menu" size={18} />
      </button>

      <Wordmark />

      <span className="mx-1 hidden h-6 w-px bg-line md:block" />

      <nav className="mono hidden items-center gap-1.5 text-[11px] text-faint md:flex">
        <span>WiFiSense Lab</span>
        <Icon name="chevron" size={11} />
        <span className="text-dim">{label}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        {isSim ? (
          <Chip tone="amber">
            <Dot tone="amber" size={6} pulse={live} />
            Simulation Mode
          </Chip>
        ) : (
          <Chip tone="red">
            <Dot tone="red" size={6} />
            Live · No Source
          </Chip>
        )}

        <Chip tone={live ? "acc" : "dim"}>
          <Dot tone={live ? "acc" : "dim"} size={6} pulse={live} />
          {live ? "Streaming" : "Halted"}
        </Chip>

        <Chip tone="dim">seed {sim.cfg.seed}</Chip>

        <span className="mono hidden text-[11.5px] text-dim lg:block">{fmtClockUTC(now)}</span>

        <button
          className="btn !px-2.5 !py-1.5"
          onClick={() => go("settings")}
          title="Simulation & system settings"
          aria-label="Settings"
        >
          <Icon name="gear" size={15} />
        </button>
      </div>
    </header>
  );
}

const NAV_LABEL: Record<PageId, string> = {
  dashboard: "Dashboard",
  sensors: "Sensors",
  "live-csi": "Live CSI",
  motion: "Motion",
  occupancy: "Occupancy",
  activity: "Activity",
  datasets: "Datasets",
  analysis: "Signal Analysis",
  ml: "Machine Learning",
  "room-map": "Room Map",
  hardware: "Hardware",
  serial: "Serial Monitor",
  respiration: "Respiration",
  docs: "Docs",
  events: "Events",
  logs: "System Logs",
  settings: "Settings",
};
