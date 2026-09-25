import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
// import { InstallPrompt } from "./components/InstallPrompt";
import type { PageId } from "./nav";
import Dashboard from "./pages/Dashboard";
import DatasetsPage from "./pages/DatasetsPage";
import EventsPage from "./pages/EventsPage";
import LiveCSIPage from "./pages/LiveCSIPage";
import LogsPage from "./pages/LogsPage";
import MotionPage from "./pages/MotionPage";
import OccupancyPage from "./pages/OccupancyPage";
import ActivityPage from "./pages/ActivityPage";
import DocsPage from "./pages/DocsPage";
import HardwarePage from "./pages/HardwarePage";
import MachineLearningPage from "./pages/MachineLearningPage";
import RespirationPage from "./pages/RespirationPage";
import RoomMapPage from "./pages/RoomMapPage";
import SensorsPage from "./pages/SensorsPage";
import SerialMonitorPage from "./pages/SerialMonitorPage";
import SettingsPage from "./pages/SettingsPage";
import SignalAnalysisPage from "./pages/SignalAnalysisPage";
import { sim } from "./state/store";

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    sim.init();
    return () => sim.destroy();
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopNav page={page} go={setPage} onMenuClick={toggleMobileMenu} />
      
      {/* Mobile backdrop */}
      <div
        className={`mobile-backdrop md:hidden ${mobileMenuOpen ? "active" : ""}`}
        onClick={closeMobileMenu}
      />
      
      <div className="flex min-h-0 flex-1">
        <Sidebar page={page} go={setPage} mobileOpen={mobileMenuOpen} onClose={closeMobileMenu} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {page === "dashboard" && <Dashboard go={setPage} />}
          {page === "sensors" && <SensorsPage />}
          {page === "live-csi" && <LiveCSIPage />}
          {page === "analysis" && <SignalAnalysisPage />}
          {page === "motion" && <MotionPage />}
          {page === "occupancy" && <OccupancyPage />}
          {page === "datasets" && <DatasetsPage />}
          {page === "ml" && <MachineLearningPage />}
          {page === "activity" && <ActivityPage go={setPage} />}
          {page === "room-map" && <RoomMapPage />}
          {page === "hardware" && <HardwarePage />}
          {page === "serial" && <SerialMonitorPage />}
          {page === "respiration" && <RespirationPage />}
          {page === "docs" && <DocsPage />}
          {page === "events" && <EventsPage />}
          {page === "logs" && <LogsPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
      
      {/* PWA Install Prompt - Temporarily disabled for preview */}
      {/* <InstallPrompt /> */}
    </div>
  );
}
