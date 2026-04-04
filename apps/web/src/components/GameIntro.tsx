import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GAMES } from "@/components/GamePicker";

const INTRO_DURATION = 6000;

interface GameIntroProps {
  gameType: string;
  /** "host" shows large TV-friendly layout, "player" shows compact phone layout */
  variant: "host" | "player";
  onDone: () => void;
}

export function GameIntro({ gameType, variant, onDone }: GameIntroProps) {
  const [visible, setVisible] = useState(true);
  const game = useMemo(() => GAMES.find((g) => g.id === gameType) ?? GAMES[0], [gameType]);
  const Icon = game.Icon;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), INTRO_DURATION);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className={`flex flex-col items-center gap-6 text-center px-8 ${
              variant === "host" ? "max-w-2xl" : "max-w-sm"
            }`}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Icon
                className={variant === "host" ? "h-20 w-20" : "h-12 w-12"}
                style={{ color: game.color }}
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`font-display font-bold ${
                variant === "host" ? "text-6xl" : "text-3xl"
              }`}
              style={{ color: game.color }}
            >
              {game.name}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`leading-relaxed text-[var(--color-text-muted)] ${
                variant === "host" ? "text-2xl" : "text-base"
              }`}
            >
              {game.howToPlay}
            </motion.p>

            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: (INTRO_DURATION + 400) / 1000, ease: "linear" }}
              className="h-1 w-48 rounded-full origin-left"
              style={{ backgroundColor: game.color }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
