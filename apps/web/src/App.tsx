import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";
import { JoinPage } from "@/pages/JoinPage";
import { HostView } from "@/pages/HostView";
import { HostSettingsPage } from "@/pages/HostSettings";
import { PlayerView } from "@/pages/PlayerView";
import { ConfettiBackground } from "@/components/ConfettiBackground";

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
      </Routes>
    </BrowserRouter>
  );
}
