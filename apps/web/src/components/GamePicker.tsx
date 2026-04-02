import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Drama, Paintbrush, Phone, Tag, ExternalLink, Scale, SlidersHorizontal } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
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
  {
    id: "sandhed",
    ...da.sandhed,
    Icon: Scale,
    color: "var(--color-sandhed)",
    glow: "var(--color-sandhed-glow)",
    textColor: "#fff",
  },
  {
    id: "ordklap",
    ...da.ordklap,
    Icon: SlidersHorizontal,
    color: "var(--color-ordklap)",
    glow: "var(--color-ordklap-glow)",
    textColor: "#0d0b1a",
  },
] as const;

export type GameMeta = (typeof GAMES)[number];

export const GAME_ICONS = { duel: Swords, bluff: Drama, tegn: Paintbrush, telefon: Phone, sandhed: Scale, ordklap: SlidersHorizontal } as const;

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

/* ── Game Carousel (Embla) ────────────────────────────── */

function GameGrid({
  onSelect,
  showExternalGames,
}: {
  onSelect: (game: GameMeta) => void;
  showExternalGames: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    startIndex: 2,
  });
  const [activeIndex, setActiveIndex] = useState(2);

  const totalItems = showExternalGames ? GAMES.length + 1 : GAMES.length;

  const onSelectSlide = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelectSlide);
    onSelectSlide();
    return () => { emblaApi.off("select", onSelectSlide); };
  }, [emblaApi, onSelectSlide]);

  // Vertical wheel → horizontal scroll
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      if (e.deltaY > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [emblaApi]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="flex w-full flex-col items-center gap-4"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.pickGame}
      </p>

      <div
        ref={emblaRef}
        className="w-full overflow-hidden"
        style={{ mask: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)", WebkitMask: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)" }}
      >
        <div className="flex gap-3">
          {GAMES.map((game, i) => (
            <motion.button
              key={game.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 200 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(game)}
              className="card-glow shrink-0 w-[200px] flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-surface)] p-5 cursor-pointer transition-shadow hover:shadow-lg"
              style={{ "--tw-shadow-color": game.glow } as any}
            >
              <game.Icon className="h-10 w-10" style={{ color: game.color }} />
              <span className="font-display text-lg font-bold" style={{ color: game.color }}>
                {game.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] leading-relaxed text-center">
                {game.description}
              </span>
            </motion.button>
          ))}

          {showExternalGames && (
            <motion.a
              href="https://quizmaster.cetropolis.dk/"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + GAMES.length * 0.06, type: "spring", stiffness: 200 }}
              whileTap={{ scale: 0.95 }}
              className="card-glow shrink-0 w-[200px] flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-surface)] p-5 cursor-pointer transition-shadow hover:shadow-lg"
              style={{ "--tw-shadow-color": "var(--color-pris-glow)" } as any}
            >
              <Tag className="h-10 w-10" style={{ color: "var(--color-pris)" }} />
              <span className="font-display text-lg font-bold" style={{ color: "var(--color-pris)" }}>
                {da.pris.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] leading-relaxed text-center">
                {da.pris.description}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            </motion.a>
          )}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalItems }).map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
            style={{
              width: i === activeIndex ? 16 : 6,
              backgroundColor: i === activeIndex ? "var(--color-primary)" : "var(--color-surface-light)",
            }}
          />
        ))}
      </div>
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
