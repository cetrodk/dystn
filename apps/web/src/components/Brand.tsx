import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* -- Bouncing letter tile (shared by AnimatedLogo + RoomCodeTiles) --
   Tiles drop in from above with a back-out overshoot and squash-and-
   stretch on landing, then settle into an endless sway: y bobs on a
   sine wave while the tile leans into the rise (rotation in phase with
   the bob, alternating direction per tile). Neighbouring tiles are
   phase-offset so the row reads as a travelling wave rather than a
   synchronised hop. The sine is densely sampled and played with linear
   easing so the loop has no visible easing seams. All visual dimensions
   are em-based so the tile scales with the container's font-size. */

const IDLE_DURATION = 2.1;
const IDLE_STAGGER = 0.15;
const IDLE_SAMPLES = 25; // first == last, so the loop closes seamlessly

const idlePhase = Array.from(
  { length: IDLE_SAMPLES },
  (_, k) => (k / (IDLE_SAMPLES - 1)) * Math.PI * 2,
);
const idleBob = idlePhase.map((t) => `${(-Math.sin(t) * 0.055).toFixed(4)}em`);
const idleSway = idlePhase.map((t) => +(Math.sin(t) * 2.4).toFixed(3));
const idleSwayInverted = idleSway.map((v) => -v);

function DanceTile({
  ch,
  i,
  tileStyle,
  delayBase = 0.3,
}: {
  ch: string;
  i: number;
  tileStyle: CSSProperties;
  delayBase?: number;
}) {
  const reduceMotion = useReducedMotion();
  const delay = delayBase + i * 0.16;
  const danceDelay = delayBase + 1.6 + i * IDLE_STAGGER;
  const baseTilt = i % 2 === 0 ? -2 : 2;
  const staticTile = (
    <span
      className="inline-block"
      style={{ transform: `rotate(${baseTilt}deg)`, ...tileStyle }}
    >
      {ch}
    </span>
  );

  if (reduceMotion) {
    return (
      <motion.span
        className="inline-block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.3 }}
      >
        {staticTile}
      </motion.span>
    );
  }

  return (
    <motion.span
      className="inline-block"
      initial={{ y: "-3.2em", opacity: 0 }}
      animate={{
        y: "0em",
        opacity: 1,
        scaleY: [1, 1, 0.84, 1.05, 1],
        scaleX: [1, 1, 1.1, 0.97, 1],
      }}
      transition={{
        y: { delay, duration: 0.55, ease: "backOut" },
        opacity: { delay, duration: 0.12 },
        scaleY: { delay, duration: 0.85, times: [0, 0.58, 0.72, 0.87, 1], ease: "easeOut" },
        scaleX: { delay, duration: 0.85, times: [0, 0.58, 0.72, 0.87, 1], ease: "easeOut" },
      }}
      style={{ transformOrigin: "50% 100%" }}
    >
      <motion.span
        className="inline-block"
        animate={{
          y: idleBob,
          rotate: i % 2 === 0 ? idleSway : idleSwayInverted,
        }}
        transition={{
          delay: danceDelay,
          duration: IDLE_DURATION,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {staticTile}
      </motion.span>
    </motion.span>
  );
}

/* -- Animated logo (versal letter tiles; only the D tile is coloured) */

const LOGO_LETTERS = ["D", "Y", "S", "T", "N"];

export function AnimatedLogo({
  className = "",
  fontSize = "clamp(44px, 11vw, 84px)",
}: {
  className?: string;
  fontSize?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex font-display leading-none ${className}`}
      style={{ fontSize, gap: "0.18em" }}
    >
      {LOGO_LETTERS.map((ch, i) => (
        <DanceTile
          key={i}
          ch={ch}
          i={i}
          tileStyle={{
            width: "1.5em",
            height: "1.5em",
            display: "grid",
            placeItems: "center",
            background: i === 0 ? "var(--color-primary)" : "var(--color-surface)",
            color: i === 0 ? "var(--color-paper)" : "var(--color-ink)",
            border: "0.05em solid var(--color-ink)",
            borderRadius: "0.16em",
            boxShadow: "0.09em 0.09em 0 var(--color-ink)",
          }}
        />
      ))}
    </div>
  );
}

/* -- Logo (D tile + wordmark) ------------------------------------- */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--color-ink)] font-display text-[1.75rem] leading-none text-[var(--color-paper)] -rotate-[4deg]"
        style={{ boxShadow: "4px 4px 0 var(--color-primary)" }}
      >
        D
      </div>
      <div className="font-display text-[1.4rem] leading-none">Dystn</div>
    </div>
  );
}

/* -- Chip (mono pill) --------------------------------------------- */

export function Chip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2 font-mono text-[11px] font-bold tracking-[0.16em] text-[var(--color-ink)]">
      {children}
    </div>
  );
}

/* -- Section header (faded number + title) ------------------------ */

export function SectionHeader({
  n,
  title,
  sub,
  actions,
}: {
  n: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-end gap-3.5">
        <div className="shrink-0 font-display text-[3.5rem] leading-[0.85] text-[var(--color-ink)] opacity-[0.15]">
          {n}
        </div>
        <div className="min-w-0">
          <div className="whitespace-nowrap text-sm font-bold uppercase tracking-[0.16em]">
            {title}
          </div>
          {sub && (
            <div className="mt-[3px] font-mono text-[11px] tracking-[0.12em] text-[var(--color-text-muted)]">
              {sub}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

/* -- Room code as bouncing monochrome tiles ------------------------ */

export function RoomCodeTiles({
  code,
  size = "lg",
}: {
  code: string;
  size?: "lg" | "md" | "sm";
}) {
  const fontSize =
    size === "lg"
      ? "clamp(56px, 9vw, 130px)"
      : size === "md"
        ? "clamp(44px, 6vw, 72px)"
        : "clamp(34px, 8vw, 48px)";

  return (
    <div
      className="flex flex-wrap font-display leading-[0.85] text-[var(--color-ink)]"
      style={{ fontSize, gap: 4 }}
    >
      {code.split("").map((ch, i) => (
        <DanceTile
          key={`${code}-${i}`}
          ch={ch}
          i={i}
          delayBase={0.15}
          tileStyle={{
            background: "var(--color-paper)",
            padding: size === "sm" ? "0.06em 0.18em" : "0.08em 0.22em",
            border: "0.07em solid var(--color-ink)",
            borderRadius: "0.14em",
            boxShadow: "0.08em 0.08em 0 var(--color-ink)",
          }}
        />
      ))}
    </div>
  );
}
