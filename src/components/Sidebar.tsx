import { NAV, type PageId } from "../nav";
import { sim, useSimVersion } from "../state/store";
import { Dot, Icon } from "./ui";

export default function Sidebar({ page, go }: { page: PageId; go: (p: PageId) => void }) {
  useSimVersion();
  const groups = ["Operations", "Sensing", "Data", "System"] as const;
  const online = sim.world.sensors.filter((s) => s.online).length;
  const total = sim.world.sensors.length;

  return (
    <aside className="flex w-[52px] shrink-0 flex-col border-r border-line bg-bg2/80 md:w-[218px]">
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <div className="lbl mb-1.5 hidden px-2.5 md:block">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = page === n.id;
              const ready = n.phase === 1;
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  title={ready ? n.label : `${n.label} — Phase ${n.phase}`}
                  className={`nav-item group relative mb-0.5 flex w-full items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-left text-[13px] ${
                    active ? "bg-raise text-txt" : "text-dim"
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-acc" />}
                  <Icon name={n.icon} size={16} className={active ? "text-acc" : "text-faint group-hover:text-dim"} />
                  <span className="hidden flex-1 truncate font-medium md:block">{n.label}</span>
                  {!ready && (
                    <span className="mono hidden rounded border border-line2 px-1 text-[9px] text-faint md:block">
                      P{n.phase}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-line p-3 md:block">
        <div className="flex items-center justify-between">
          <span className="lbl">Fleet</span>
          <span className="mono text-[11px] text-dim">
            <span className={online === total ? "text-acc" : "text-amber"}>{online}</span>/{total} online
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Dot tone={sim.streaming ? "acc" : "dim"} pulse={sim.streaming} size={6} />
          <span className="mono text-[10px] tracking-wider text-faint">
            {sim.mode === "simulation" ? (sim.streaming ? "SIM ENGINE RUNNING" : "SIM ENGINE PAUSED") : "AWAITING HARDWARE"}
          </span>
        </div>
      </div>
    </aside>
  );
}
