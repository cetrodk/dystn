import { motion } from "framer-motion";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerCountdown(_props: PhaseComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className="text-6xl"
      >
        🏁
      </motion.div>
      <p className="font-display text-2xl font-bold">{da.sandhed.getReady}</p>
      <p className="text-[var(--color-text-muted)]">{da.lookAtScreen}</p>
    </div>
  );
}
