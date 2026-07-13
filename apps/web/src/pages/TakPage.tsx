import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Copy, Sparkles } from "lucide-react";
import { da } from "@/lib/da";
import { getHostSession } from "@/lib/session";
import { clearStoredLicense, redeemViaHttp, setStoredLicense } from "@/lib/license";

const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);

const PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined;

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 30; // 30 × 3 s = 90 s

type TakState =
  | { kind: "loading" }
  | { kind: "paid"; code: string }
  | { kind: "pending" }
  | { kind: "pendingTimeout" }
  | { kind: "not_completed" }
  | { kind: "error" };

/**
 * /tak — landing efter Stripe Payment Link-redirect. Viser koden, gemmer den
 * lokalt, og tilbyder cross-device-indløsning via rumkode (TV-scenariet).
 * URL'en med session_id er en hemmelighed: no-store, no-referrer, logges aldrig.
 */
export function TakPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<TakState>(
    sessionId ? { kind: "loading" } : { kind: "error" },
  );
  const pollCount = useRef(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/license?session_id=${encodeURIComponent(sessionId!)}`);
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const body = (await res.json()) as
          | { status: "paid"; code: string; packs: string[] }
          | { status: "pending" }
          | { status: "not_completed" };
        if (cancelled) return;
        if (body.status === "paid") {
          setState({ kind: "paid", code: body.code });
        } else if (body.status === "not_completed") {
          setState({ kind: "not_completed" });
        } else {
          pollCount.current += 1;
          if (pollCount.current >= POLL_MAX_ATTEMPTS) {
            setState({ kind: "pendingTimeout" });
          } else {
            setState({ kind: "pending" });
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg flex flex-col gap-5"
      >
        {state.kind === "loading" && <PendingCard text={da.license.tak.pending} />}
        {state.kind === "pending" && <PendingCard text={da.license.tak.pending} />}
        {state.kind === "paid" && <PaidCard code={state.code} />}
        {state.kind === "pendingTimeout" && (
          <ErrorCard
            title={da.license.tak.pending}
            body={da.license.tak.pendingTimeout}
            sessionId={sessionId}
          />
        )}
        {state.kind === "not_completed" && <NotCompletedCard />}
        {state.kind === "error" && (
          <ErrorCard
            title={da.license.tak.errorTitle}
            body={da.license.tak.errorBody}
            sessionId={sessionId}
          />
        )}
      </motion.div>
    </div>
  );
}

function PendingCard({ text }: { text: string }) {
  return (
    <div className="card-glow rounded-2xl bg-[var(--color-surface)] p-8 text-center">
      <p className="animate-gentle-pulse text-[var(--color-text-muted)]">{text}</p>
    </div>
  );
}

function PaidCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [remembered, setRemembered] = useState(true);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hostSession = getHostSession();

  // Auto-gem med synlig bekræftelse + "Glem igen"-undo. Skrivningen trigger
  // storage-eventet i en evt. åben rum-fane, som så selv indløser live.
  useEffect(() => {
    setStoredLicense(code);
  }, [code]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard nægtet — koden står stadig på skærmen
    }
  }

  async function handleRoomRedeem(e: React.FormEvent) {
    e.preventDefault();
    const roomCode = roomCodeInput.trim();
    if (!/^[a-zA-Z]{4}$/.test(roomCode)) {
      setRedeemMsg({ ok: false, text: da.license.errors.roomNotFound });
      return;
    }
    setRedeemBusy(true);
    setRedeemMsg(null);
    const result = await redeemViaHttp(roomCode, code);
    setRedeemBusy(false);
    if (result.ok) {
      setRedeemMsg({ ok: true, text: da.license.tak.unlocked });
    } else {
      setRedeemMsg({ ok: false, text: da.license.errors[result.reason] });
    }
  }

  return (
    <>
      {/* Koden */}
      <div className="card-glow rounded-2xl bg-[var(--color-surface)] p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-primary)]/15">
          <Sparkles className="h-6 w-6 text-[var(--color-primary)]" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">{da.license.tak.title}</h1>
        <div className="w-full">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-2">
            {da.license.tak.yourCode}
          </p>
          <p className="font-mono text-lg sm:text-xl font-bold break-all select-all" data-testid="license-code">
            {code}
          </p>
        </div>
        <button
          onClick={copyCode}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold cursor-pointer"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? da.license.tak.copied : da.license.tak.copy}
        </button>
        <p className="text-xs text-[var(--color-text-muted)]">{da.license.tak.mailHint}</p>
        <p className="text-sm">
          {remembered ? (
            <>
              <span className="text-[var(--color-text-muted)]">{da.license.tak.savedHere}</span>{" "}
              <button
                onClick={() => { clearStoredLicense(); setRemembered(false); }}
                className="underline underline-offset-2 text-[var(--color-text-muted)] cursor-pointer"
              >
                {da.license.tak.forget}
              </button>
            </>
          ) : (
            <button
              onClick={() => { setStoredLicense(code); setRemembered(true); }}
              className="underline underline-offset-2 text-[var(--color-text-muted)] cursor-pointer"
            >
              {da.license.modal.remember}
            </button>
          )}
        </p>
      </div>

      {/* Anden skærm: QR + rumkode-indløsning */}
      <div className="rounded-2xl bg-[var(--color-surface)] p-6 flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
          {da.license.tak.otherScreen}
        </p>
        <div className="flex justify-center">
          <Suspense fallback={<div className="h-[120px] w-[120px]" />}>
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={window.location.href} size={108} />
            </div>
          </Suspense>
        </div>
        <form onSubmit={handleRoomRedeem} className="flex flex-col gap-2">
          <label className="text-sm font-semibold">{da.license.tak.roomCodeLabel}</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => { setRoomCodeInput(e.target.value.toUpperCase()); setRedeemMsg(null); }}
              placeholder={da.license.tak.roomCodePlaceholder}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="w-28 rounded-xl bg-[var(--color-bg)] px-4 py-3 text-center font-mono text-lg tracking-[0.2em] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={redeemBusy}
              className="flex-1 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {da.license.tak.unlock}
            </button>
          </div>
          {redeemMsg && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold"
              style={{ color: redeemMsg.ok ? "var(--color-primary)" : "var(--color-danger)" }}
            >
              {redeemMsg.text}
            </motion.p>
          )}
        </form>
      </div>

      {/* Videre */}
      <Link
        to={hostSession ? `/host/${hostSession.roomCode}` : "/"}
        className="rounded-xl bg-[var(--color-surface-light)] px-6 py-3 text-center font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        {hostSession ? da.license.tak.backToRoom : da.license.tak.backToStart}
      </Link>
    </>
  );
}

function NotCompletedCard() {
  return (
    <div className="card-glow rounded-2xl bg-[var(--color-surface)] p-8 flex flex-col items-center gap-4 text-center">
      <h1 className="font-display text-2xl font-bold">{da.license.tak.notCompleted}</h1>
      {PAYMENT_LINK && (
        <a
          href={PAYMENT_LINK}
          className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold"
        >
          {da.license.tak.buyAgain}
        </a>
      )}
      <Link to="/" className="text-sm text-[var(--color-text-muted)] underline underline-offset-2">
        {da.license.tak.backToStart}
      </Link>
    </div>
  );
}

function ErrorCard({
  title,
  body,
  sessionId,
}: {
  title: string;
  body: string;
  sessionId: string | null;
}) {
  const mailto = `mailto:${da.license.supportEmail}?subject=${encodeURIComponent(
    "Dystn-pakken: manglende kode",
  )}&body=${encodeURIComponent(`${da.license.tak.reference}: ${sessionId ?? "(intet session_id)"}`)}`;
  return (
    <div className="card-glow rounded-2xl bg-[var(--color-surface)] p-8 flex flex-col items-center gap-4 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="text-sm text-[var(--color-text-muted)]">{body}</p>
      {sessionId && (
        <p className="text-xs font-mono text-[var(--color-text-muted)] break-all">
          {da.license.tak.reference}: {sessionId}
        </p>
      )}
      <a href={mailto} className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold">
        {da.license.supportEmail}
      </a>
      <Link to="/" className="text-sm text-[var(--color-text-muted)] underline underline-offset-2">
        {da.license.tak.backToStart}
      </Link>
    </div>
  );
}
