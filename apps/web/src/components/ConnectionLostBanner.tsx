import { WifiOff } from "lucide-react";
import { da } from "@/lib/da";

/** Diskret bundbanner mens PartySocket genopretter forbindelsen. */
export function ConnectionLostBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-[var(--color-warning)]/15 py-2 text-xs font-semibold text-[var(--color-warning)] backdrop-blur-md">
      <WifiOff className="h-4 w-4" />
      {da.connectionLost}
    </div>
  );
}
