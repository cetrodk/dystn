import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Swords, Drama, Paintbrush, Phone, Tag, ExternalLink, Scale, SlidersHorizontal } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { da } from "@/lib/da";

export const GAMES = [
  {
    id: "blitz",
    ...da.blitz,
    Icon: Swords,
    color: "var(--color-blitz)",
    glow: "var(--color-blitz-glow)",
    textColor: "#fff",
  },
  {
    id: "fusk",
    ...da.fusk,
    Icon: Drama,
    color: "var(--color-fusk)",
    glow: "var(--color-fusk-glow)",
    textColor: "#0d0b1a",
  },
  {
    id: "scrawl",
    ...da.scrawl,
    Icon: Paintbrush,
    color: "var(--color-scrawl)",
    glow: "var(--color-scrawl-glow)",
    textColor: "#fff",
  },
  {
    id: "morph",
    ...da.morph,
    Icon: Phone,
    color: "var(--color-morph)",
    glow: "var(--color-morph-glow)",
    textColor: "#0d0b1a",
  },
  {
    id: "surge",
    ...da.surge,
    Icon: Scale,
    color: "var(--color-surge)",
    glow: "var(--color-surge-glow)",
    textColor: "#fff",
  },
  {
    id: "hunch",
    ...da.hunch,
    Icon: SlidersHorizontal,
    color: "var(--color-hunch)",
    glow: "var(--color-hunch-glow)",
    textColor: "#0d0b1a",
  },
] as const;

export type GameMeta = (typeof GAMES)[number];

export const GAME_ICONS = { blitz: Swords, fusk: Drama, scrawl: Paintbrush, morph: Phone, surge: Scale, hunch: SlidersHorizontal } as const;

/**
 * Game picker carousel. Clicking a card directly selects the game.
 */
export function GamePicker({
  onSelect,
  showExternalGames = false,
}: {
  onSelect: (gameId: string) => void;
  showExternalGames?: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: true,
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex w-full flex-col items-center gap-4"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {da.pickGame}
      </p>

      <div
        ref={emblaRef}
        className="w-full overflow-hidden"
        style={{ mask: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)", WebkitMask: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
      >
        <div className="flex gap-4">
          {GAMES.map((game, i) => (
            <motion.button
              key={game.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 200 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(game.id)}
              className="card-glow shrink-0 w-[240px] flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-surface)] p-6 cursor-pointer transition-shadow hover:shadow-lg"
              style={{ "--tw-shadow-color": game.glow } as any}
            >
              <game.Icon className="h-12 w-12" style={{ color: game.color }} />
              <span className="font-display text-xl font-bold" style={{ color: game.color }}>
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
              className="card-glow shrink-0 w-[240px] flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-surface)] p-6 cursor-pointer transition-shadow hover:shadow-lg"
              style={{ "--tw-shadow-color": "var(--color-pris-glow)" } as any}
            >
              <Tag className="h-12 w-12" style={{ color: "var(--color-pris)" }} />
              <span className="font-display text-xl font-bold" style={{ color: "var(--color-pris)" }}>
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
