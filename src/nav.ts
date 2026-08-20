import type { IconName } from "./components/ui";

export type PageId =
  | "dashboard"
  | "sensors"
  | "live-csi"
  | "motion"
  | "occupancy"
  | "activity"
  | "datasets"
  | "analysis"
  | "ml"
  | "room-map"
  | "hardware"
  | "serial"
  | "respiration"
  | "docs"
  | "events"
  | "logs"
  | "settings";

export interface NavItem {
  id: PageId;
  label: string;
  icon: IconName;
  /** Implementation phase per the roadmap. `1` = available now. */
  phase: number;
  group: "Operations" | "Sensing" | "Data" | "System";
}

export const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid", phase: 1, group: "Operations" },
  { id: "sensors", label: "Sensors", icon: "chip", phase: 2, group: "Operations" },
  { id: "live-csi", label: "Live CSI", icon: "wave", phase: 3, group: "Sensing" },
  { id: "motion", label: "Motion", icon: "zap", phase: 5, group: "Sensing" },
  { id: "occupancy", label: "Occupancy", icon: "user", phase: 6, group: "Sensing" },
  { id: "activity", label: "Activity", icon: "pulse", phase: 8, group: "Sensing" },
  { id: "datasets", label: "Datasets", icon: "database", phase: 7, group: "Data" },
  { id: "analysis", label: "Signal Analysis", icon: "sliders", phase: 4, group: "Data" },
  { id: "ml", label: "Machine Learning", icon: "cpu", phase: 8, group: "Data" },
  { id: "room-map", label: "Room Map", icon: "map", phase: 13, group: "Operations" },
  { id: "respiration", label: "Respiration", icon: "pulse", phase: 15, group: "Sensing" },
  { id: "events", label: "Events", icon: "list", phase: 1, group: "System" },
  { id: "hardware", label: "Hardware", icon: "plug", phase: 10, group: "System" },
  { id: "serial", label: "Serial Monitor", icon: "terminal", phase: 11, group: "System" },
  { id: "docs", label: "Docs", icon: "book", phase: 9, group: "System" },
  { id: "logs", label: "System Logs", icon: "terminal", phase: 1, group: "System" },
  { id: "settings", label: "Settings", icon: "gear", phase: 1, group: "System" },
];
