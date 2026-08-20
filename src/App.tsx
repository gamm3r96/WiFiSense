import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import type { PageId } from "./nav";
import Dashboard from "./pages/Dashboard";
import DatasetsPage from "./pages/DatasetsPage";
import EventsPage from "./pages/EventsPage";
import LiveCSIPage from "./pages/LiveCSIPage";
import LogsPage from "./pages/LogsPage";
import MotionPage from "./pages/MotionPage";
import OccupancyPage from "./pages/OccupancyPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import SensorsPage from "./pages/SensorsPage";
import SettingsPage from "./pages/SettingsPage";
import SignalAnalysisPage from "./pages/SignalAnalysisPage";
import { sim } from "./state/store";

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");

  useEffect(() => {
    sim.init();
    return () => sim.destroy();
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopNav page={page} go={setPage} />
      <div className="flex min-h-0 flex-1">
        <Sidebar page={page} go={setPage} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {page === "dashboard" && <Dashboard go={setPage} />}
          {page === "sensors" && <SensorsPage />}
          {page === "live-csi" && <LiveCSIPage />}
          {page === "analysis" && <SignalAnalysisPage />}
          {page === "motion" && <MotionPage />}
          {page === "occupancy" && <OccupancyPage />}
          {page === "datasets" && <DatasetsPage />}
          {page === "events" && <EventsPage />}
          {page === "logs" && <LogsPage />}
          {page === "settings" && <SettingsPage />}
          {page !== "dashboard" &&
            page !== "sensors" &&
            page !== "live-csi" &&
            page !== "analysis" &&
            page !== "motion" &&
            page !== "occupancy" &&
            page !== "datasets" &&
            page !== "events" &&
            page !== "logs" &&
            page !== "settings" && <PlaceholderPage page={page} />}
        </main>
      </div>
    </div>
  );
}
