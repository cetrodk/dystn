import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Drama, Paintbrush, Phone, Tag, ExternalLink } from "lucide-react";
import { da } from "@/lib/da";

export const GAMES = [
  {
    id: "duel",
    ...da.duel,
    Icon: Swords,
    color: "var(--color-duel)",
    glow: "var(--color-duel-glow)",
    textColor: "#fff",
  },
  {
    id: "bluff",
    ...da.bluff,
    Icon: Drama,
    color: "var(--color-bluff)",
    glow: "var(--color-bluff-glow)",
    textColor: "#0d0b1a",
  },
  {
    id: "tegn",
    ...da.tegn,
    Icon: Paintbrush,
    color: "var(--color-tegn)",
    glow: "var(--color-tegn-glow)",
    textColor: "#fff",
  },
  {
    id: "telefon",
    ...da.telefon,
    Icon: Phone,
    color: "var(--color-telefon)",
    glow: "var(--color-telefon-glow)",
    textColor: "#0d0b1a",
  },
] as const;

export type GameMeta = (typeof GAMES)[number];

export const GAME_ICONS = { duel: Swords, bluff: Drama, tegn: Paintbrush, telefon: Phone } as const;

/**
 * Game picker with 2x2 grid and detail splash.
 * Used in both the landing page and the host lobby.
 */
export function GamePicker({
  onSelect,
  showExternalGames = false,
}: {
  onSelect: (gameId: string) => void;
  showExternalGames?: boolean;
}) {
  const [selectedGame, setSelectedGame] = useState<GameMeta | null>(null);

  return (
    <AnimatePresence mode="wait">
      {selectedGame ? (
        <GameDetailSplash
          key="detail"
          game={selectedGame}
          onBack={() => setSelectedGame(null)}
          onStart={() => onSelect(selectedGame.id)}
        />
      ) : (
        <GameGrid
          key="grid"
          onSelect={setSelectedGame}
          showExternalGames={showExternalGames}
        />
      )}
    </AnimatePresence>
  );
}

/* ── Game Grid ─────────────────────────────────────────── */

function GameGrid({
  onSelect,
  showExternalGames,
}: {
  onSelect: (game: GameMeta) => void;
  showExternalGames: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="flex w-full max-w-lg flex-col items-center gap-6"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.pickGame}
      </p>

      <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
        {GAMES.map((game, i) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.07, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(game)}
            className="card-glow group relative flex flex-col items-center gap-2 rounded-2xl bg-[var(--color-surface)] p-5 sm:p-6 cursor-pointer transition-shadow hover:shadow-lg"
            style={{ "--tw-shadow-color": game.glow } as any}
          >
            <game.Icon className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: game.color }} />
            <span
              className="font-display text-lg font-bold sm:text-xl"
              style={{ color: game.color }}
            >
              {game.name}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] leading-relaxed sm:text-sm">
              {game.description}
            </span>
          </motion.button>
        ))}
      </div>

      {showExternalGames && (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {da.externalGames}
          </p>
          <motion.a
            href="https://quizmaster.cetropolis.dk/"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + GAMES.length * 0.07, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="card-glow flex w-full items-center gap-4 rounded-2xl bg-[var(--color-surface)] p-4 sm:p-5 cursor-pointer transition-shadow hover:shadow-lg"
            style={{ "--tw-shadow-color": "var(--color-pris-glow)" } as any}
          >
            <Tag className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" style={{ color: "var(--color-pris)" }} />
            <div className="flex flex-col gap-0.5 text-left">
              <span className="font-display text-lg font-bold sm:text-xl" style={{ color: "var(--color-pris)" }}>
                {da.pris.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] leading-relaxed sm:text-sm">
                {da.pris.description}
              </span>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </motion.a>
        </>
      )}
    </motion.div>
  );
}

/* ── Game Detail Splash ────────────────────────────────── */

function GameDetailSplash({
  game,
  onBack,
  onStart,
}: {
  game: GameMeta;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25 }}
      className="flex w-full max-w-sm flex-col items-center gap-6"
    >
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="self-start flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
      >
        ← {da.back}
      </motion.button>

      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="flex flex-col items-center gap-2"
      >
        <game.Icon className="h-16 w-16" style={{ color: game.color }} />
        <h2 className="font-display text-4xl font-bold" style={{ color: game.color }}>
          {game.name}
        </h2>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center text-lg text-[var(--color-text-muted)]"
      >
        {game.description}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full rounded-2xl bg-[var(--color-surface)] p-5"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          {da.howToPlay}
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-text)]">
          {game.howToPlay}
        </p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xs font-medium text-[var(--color-text-muted)]"
      >
        {game.expects}
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
        className="w-full rounded-2xl py-4 text-xl font-bold cursor-pointer"
        style={{
          backgroundColor: game.color,
          color: game.textColor,
          boxShadow: `0 0 30px ${game.glow}, 0 4px 20px ${game.glow}`,
        }}
      >
        {da.startGame}
      </motion.button>
    </motion.div>
  );
}
