import { motion } from "framer-motion";
import { da } from "@/lib/da";
import type { PhaseComponentProps } from "../registry";

export default function PlayerPresent(_props: PhaseComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="text-6xl"
      >
        👀
      </motion.div>
      <p className="font-display text-2xl font-bold text-center">
        {da.duel.lookAtScreenForAnswers}
      </p>
    </div>
  );
}
