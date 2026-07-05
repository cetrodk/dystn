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
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        ── {da.pickGame} ──
      </p>

      <div
        ref={emblaRef}
        className="w-full overflow-hidden py-2"
        style={{ mask: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)", WebkitMask: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
      >
        <div className="flex gap-4 px-2">
          {GAMES.map((game, i) => {
            const active = i === activeIndex;
            return (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 200 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSelect(game.id)}
                className="nb-press shrink-0 w-[230px] flex flex-col items-start gap-3 rounded-2xl border-[3px] border-[var(--color-ink)] p-5 cursor-pointer"
                style={{
                  background: active ? game.color : "var(--color-paper)",
                  color: active ? game.textColor : "var(--color-ink)",
                  boxShadow: active ? "6px 6px 0 var(--color-ink)" : "4px 4px 0 var(--color-ink)",
                  transform: active ? "translateY(-4px)" : "none",
                }}
              >
                <div
                  className="grid h-14 w-14 place-items-center rounded-xl border-[3px]"
                  style={{
                    background: active ? "rgba(255,255,255,0.2)" : game.color,
                    borderColor: active ? game.textColor : "var(--color-ink)",
                  }}
                >
                  <game.Icon className="h-7 w-7" style={{ color: "#fff" }} />
                </div>
                <span className="font-display text-2xl leading-none">{game.name}</span>
                <span
                  className="text-xs leading-relaxed text-left"
                  style={{ color: active ? game.textColor : "var(--color-text-muted)", opacity: active ? 0.9 : 1 }}
                >
                  {game.description}
                </span>
              </motion.button>
            );
          })}

          {showExternalGames && (
            <motion.a
              href="https://quizmaster.cetropolis.dk/"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + GAMES.length * 0.06, type: "spring", stiffness: 200 }}
              whileTap={{ scale: 0.96 }}
              className="nb-press shrink-0 w-[230px] flex flex-col items-start gap-3 rounded-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 cursor-pointer"
              style={{ boxShadow: "4px 4px 0 var(--color-ink)" }}
            >
              <div
                className="grid h-14 w-14 place-items-center rounded-xl border-[3px] border-[var(--color-ink)]"
                style={{ background: "var(--color-pris)" }}
              >
                <Tag className="h-7 w-7" style={{ color: "#fff" }} />
              </div>
              <span className="font-display text-2xl leading-none" style={{ color: "var(--color-pris)" }}>
                {da.pris.name}
              </span>
              <span className="text-xs leading-relaxed text-left text-[var(--color-text-muted)]">
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
            className="h-2 rounded-full border-2 border-[var(--color-ink)] transition-all duration-300 cursor-pointer"
            style={{
              width: i === activeIndex ? 22 : 8,
              backgroundColor: i === activeIndex ? "var(--color-primary)" : "var(--color-paper)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
