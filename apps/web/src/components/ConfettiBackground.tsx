import { useSyncExternalStore } from "react";

const DOTS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 3 + Math.random() * 5,
  color: ["#8b6eff", "#f472b6", "#fbbf24", "#60a5fa", "#34d399"][i % 5],
  delay: -(Math.random() * 6),
  duration: 3 + Math.random() * 3,
}));

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function ConfettiBackground() {
  // Komponenten er mountet globalt hele sessionen — pausér de evige
  // animationer i skjulte faner, så de ikke æder CPU/batteri i baggrunden.
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {DOTS.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-full animate-confetti-float"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            background: dot.color,
            animationDuration: `${dot.duration}s`,
            animationDelay: `${dot.delay}s`,
            animationPlayState: visible ? undefined : "paused",
          }}
        />
      ))}
    </div>
  );
}
