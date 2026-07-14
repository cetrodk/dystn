import { Suspense, lazy, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { da } from "@/lib/da";
import { formatLicenseInputEvent, normalizeLicenseInput, withDashes } from "@/lib/license";

const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);

// Payment Linket er et build-time-valg; mangler det (dev/e2e), degraderer
// modalen yndefuldt til kun kode-indløsning i stedet for at crashe.
const PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined;

/**
 * Oplåsnings-modal for Dystn-pakken. To tilstande:
 * - rum-mode (onRedeem): indløser koden live i rummet over socketen
 * - landing-mode (onSaveOnly): gemmer kun koden til senere (intet rum åbent)
 */
export function UnlockModal({
  open,
  onClose,
  onRedeem,
  onSaveOnly,
  redeeming = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onRedeem?: (code: string, remember: boolean) => void;
  onSaveOnly?: (code: string) => void;
  redeeming?: boolean;
  error?: string | null;
}) {
  const [codeInput, setCodeInput] = useState("");
  const [remember, setRemember] = useState(true);
  const [formatError, setFormatError] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const canonical = normalizeLicenseInput(codeInput);
    if (!canonical) {
      setFormatError(true);
      return;
    }
    setFormatError(false);
    const code = withDashes(canonical);
    if (onRedeem) {
      onRedeem(code, remember);
    } else if (onSaveOnly) {
      onSaveOnly(code);
      setSavedMsg(true);
    }
  }

  const shownError = formatError ? da.license.errors.badFormat : error;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-6 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-primary)]/15">
                <Sparkles className="h-6 w-6 text-[var(--color-primary)]" />
              </div>
              <h3 className="font-display text-xl font-bold mt-1">{da.license.modal.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)]">{da.license.modal.pitch}</p>
              <p className="text-sm font-bold">
                {da.license.modal.priceLabel}: {da.license.price}
              </p>
            </div>

            {PAYMENT_LINK && (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-[var(--color-bg)] p-4">
                <Suspense fallback={<div className="h-[140px] w-[140px]" />}>
                  <div className="rounded-lg bg-white p-2">
                    <QRCodeSVG value={PAYMENT_LINK} size={124} />
                  </div>
                </Suspense>
                <p className="text-sm font-semibold">{da.license.modal.qrHint}</p>
                <a
                  href={PAYMENT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-primary-light)] underline underline-offset-2"
                >
                  {da.license.modal.linkLabel}
                </a>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{da.license.modal.haveCode}</p>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => { setCodeInput(formatLicenseInputEvent(e.currentTarget, codeInput)); setFormatError(false); }}
                placeholder={da.license.modal.codePlaceholder}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className={`w-full rounded-xl bg-[var(--color-bg)] px-4 py-3 text-center font-mono text-sm outline-none transition-colors ${
                  shownError
                    ? "ring-2 ring-[var(--color-danger)]"
                    : "focus:ring-2 focus:ring-[var(--color-primary)]"
                }`}
              />
              {onRedeem && (
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {da.license.modal.remember}
                </label>
              )}
              <div className="min-h-5 flex items-center justify-center text-center">
                {shownError && (
                  <motion.p
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-[var(--color-danger)]"
                  >
                    {shownError}
                  </motion.p>
                )}
                {!shownError && savedMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-[var(--color-success,#6bae5a)]"
                  >
                    {da.license.modal.saved}
                  </motion.p>
                )}
              </div>
              <button
                type="submit"
                disabled={redeeming}
                className="rounded-xl bg-[var(--color-primary)] py-3 font-bold transition-transform hover:scale-[1.03] active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {redeeming ? da.license.modal.redeeming : da.license.modal.redeem}
              </button>
            </form>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              {da.license.modal.support}{" "}
              <a href={`mailto:${da.license.supportEmail}`} className="underline underline-offset-2">
                {da.license.supportEmail}
              </a>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
