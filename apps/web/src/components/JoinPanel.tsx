import { Suspense, lazy } from "react";
import { RoomCodeTiles } from "@/components/Brand";
import { da } from "@/lib/da";

// Lazy-load QR code — samme wrapper som resten af appen bruger
const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);

interface JoinPanelProps {
  code: string;
  /** hero: stor rumkode (lobbyens midte). overlay: mellemstor (modal under spil,
   *  hvor lg-fliserne ville wrappe). compact: lille kort (sidekolonnen). */
  size?: "hero" | "overlay" | "compact";
  /** Ekstra linje under panelet — fx den ærlige besked under et igangværende spil */
  note?: string;
}

/**
 * Rumkode + QR + join-link i ét panel. Bruges i begge lobby-layouts og i
 * rumkode-overlayet under spil, så koden altid kan findes. QR'en skjules
 * ALDRIG på smalle skærme — en vært kan sagtens sidde med en iPad.
 */
export function JoinPanel({ code, size = "hero", note }: JoinPanelProps) {
  const hero = size === "hero";
  const joinUrl = `${window.location.origin}/join/${code}`;
  const qrSize = size === "compact" ? 96 : 120;
  const tileSize = hero ? "lg" : size === "overlay" ? "md" : "sm";

  return (
    <div className={`flex flex-col items-center text-center ${hero ? "gap-4" : "gap-3"}`}>
      {hero && (
        <div className="font-mono text-xs tracking-[0.18em] text-[var(--color-text-muted)]">
          ── {da.joinPanel.stepOne} ──&nbsp;&nbsp;{da.joinPanel.joinTheRoom}
        </div>
      )}
      {/* Linket indeholder koden — QR'en og linket skal føre samme sted hen */}
      <div className={`font-semibold uppercase tracking-[0.12em] ${size === "compact" ? "text-xs" : "text-sm"}`}>
        {da.joinPanel.goTo}{" "}
        <span className="text-[var(--color-primary)]">
          {window.location.host}/join/{code}
        </span>
      </div>
      <RoomCodeTiles code={code} size={tileSize} />
      <Suspense
        fallback={
          <div
            className="rounded-xl bg-[var(--color-surface-light)]"
            style={{ height: qrSize + 16, width: qrSize + 16 }}
          />
        }
      >
        <div
          className="rounded-xl border-[3px] border-[var(--color-ink)] bg-white p-2"
          style={{ boxShadow: "5px 5px 0 var(--color-ink)" }}
        >
          <QRCodeSVG value={joinUrl} size={qrSize} fgColor="#1a1714" bgColor="white" />
        </div>
      </Suspense>
      <div className="font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-muted)]">
        {da.joinPanel.scanToJoin}
      </div>
      {note && (
        <p className="max-w-xs text-sm text-[var(--color-text-muted)]">{note}</p>
      )}
    </div>
  );
}
