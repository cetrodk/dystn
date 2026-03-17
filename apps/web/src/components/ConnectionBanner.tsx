import { useConvex } from "convex/react";
import { useState, useEffect, useRef } from "react";
import { da } from "@/lib/da";

export function ConnectionBanner() {
  const convex = useConvex();
  const [show, setShow] = useState(false);
  const hasConnected = useRef(false);

  useEffect(() => {
    return convex.subscribeToConnectionState((state) => {
      if (state.isWebSocketConnected) {
        hasConnected.current = true;
        setShow(false);
      } else if (hasConnected.current) {
        setShow(true);
      }
    });
  }, [convex]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-[var(--color-danger)] px-4 py-2 text-center text-sm font-bold text-white animate-gentle-pulse">
      {da.connectionLost}
    </div>
  );
}
