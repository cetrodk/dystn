import type { ReactNode } from "react";

/* Tile accent colours, cycled across room-code characters. */
const TILE_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-fusk)",
  "var(--color-morph)",
];

/* -- Logo (F tile + wordmark) ------------------------------------- */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--color-ink)] font-display text-[1.75rem] leading-none text-[var(--color-paper)] -rotate-[4deg]"
        style={{ boxShadow: "4px 4px 0 var(--color-primary)" }}
      >
        F
      </div>
      <div>
        <div className="font-display text-[1.4rem] leading-none">Festspil</div>
        <div className="mt-[3px] font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-muted)]">
          PARTY PACK
        </div>
      </div>
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

/* -- Room code as rotated accent tiles ---------------------------- */

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
  const pad = size === "sm" ? "0 8px" : "0 12px";
  const border = size === "sm" ? "3px" : "4px";
  const shadow = size === "sm" ? "3px 3px 0" : "5px 5px 0";

  return (
    <div
      className="flex flex-wrap font-display leading-[0.85] text-[var(--color-paper)]"
      style={{ fontSize, gap: 4 }}
    >
      {code.split("").map((ch, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            background: TILE_COLORS[i % TILE_COLORS.length],
            padding: pad,
            border: `${border} solid var(--color-ink)`,
            borderRadius: 10,
            transform: `rotate(${(i % 2 ? 1 : -1) * 1.5}deg)`,
            boxShadow: `${shadow} var(--color-ink)`,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
