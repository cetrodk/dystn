import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { isGateActive } from "@/lib/gate";

const LandingPage = lazy(() => import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const OmPage = lazy(() => import("@/pages/OmPage").then((m) => ({ default: m.OmPage })));
const JoinPage = lazy(() => import("@/pages/JoinPage").then((m) => ({ default: m.JoinPage })));
const HostLayout = lazy(() => import("@/pages/HostLayout").then((m) => ({ default: m.HostLayout })));
const HostView = lazy(() => import("@/pages/HostView").then((m) => ({ default: m.HostView })));
const HostSettingsPage = lazy(() => import("@/pages/HostSettings").then((m) => ({ default: m.HostSettingsPage })));
const PlayerView = lazy(() => import("@/pages/PlayerView").then((m) => ({ default: m.PlayerView })));
const TakPage = lazy(() => import("@/pages/TakPage").then((m) => ({ default: m.TakPage })));
const SimulatorPage = import.meta.env.DEV
  ? lazy(() => import("@/pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage })))
  : () => null;

const PageFallback = (
  <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)] animate-gentle-pulse">
    Indlæser...
  </div>
);

export default function App() {
  // Midlertidig launch-gate: kun infosiden er tilgængelig (se lib/gate.ts)
  if (isGateActive()) {
    return (
      <BrowserRouter>
        <ConfettiBackground />
        <Suspense fallback={PageFallback}>
          <Routes>
            <Route path="*" element={<OmPage gate />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <ConfettiBackground />
      <Suspense fallback={PageFallback}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/om" element={<OmPage />} />
          <Route path="/play" element={<JoinPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/play/:code" element={<PlayerView />} />
          <Route path="/tak" element={<TakPage />} />
          <Route path="/host/:code" element={<HostLayout />}>
            <Route index element={<HostView />} />
            <Route path="settings" element={<HostSettingsPage />} />
          </Route>
          {import.meta.env.DEV && (
            <Route path="/simulator" element={<SimulatorPage />} />
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
