import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfettiBackground } from "@/components/ConfettiBackground";

const LandingPage = lazy(() => import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const JoinPage = lazy(() => import("@/pages/JoinPage").then((m) => ({ default: m.JoinPage })));
const HostView = lazy(() => import("@/pages/HostView").then((m) => ({ default: m.HostView })));
const HostSettingsPage = lazy(() => import("@/pages/HostSettings").then((m) => ({ default: m.HostSettingsPage })));
const PlayerView = lazy(() => import("@/pages/PlayerView").then((m) => ({ default: m.PlayerView })));
const SimulatorPage = import.meta.env.DEV
  ? lazy(() => import("@/pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage })))
  : () => null;

const PageFallback = (
  <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)] animate-gentle-pulse">
    Indlæser...
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <ConfettiBackground />
      <Suspense fallback={PageFallback}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/play" element={<JoinPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/play/:code" element={<PlayerView />} />
          <Route path="/host/:code" element={<HostView />} />
          <Route path="/host/:code/settings" element={<HostSettingsPage />} />
          {import.meta.env.DEV && (
            <Route path="/simulator" element={<SimulatorPage />} />
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
