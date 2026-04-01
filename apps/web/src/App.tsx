import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";
import { JoinPage } from "@/pages/JoinPage";
import { HostView } from "@/pages/HostView";
import { HostSettingsPage } from "@/pages/HostSettings";
import { PlayerView } from "@/pages/PlayerView";
import { ConfettiBackground } from "@/components/ConfettiBackground";

const SimulatorPage = lazy(() =>
  import("@/pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage })),
);

export default function App() {
  return (
    <BrowserRouter>
      <ConfettiBackground />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/play/:code" element={<PlayerView />} />
        <Route path="/host/:code" element={<HostView />} />
        <Route path="/host/:code/settings" element={<HostSettingsPage />} />
        <Route
          path="/simulator"
          element={
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)]">Indlæser simulator...</div>}>
              <SimulatorPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
