import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Trash2 } from "lucide-react";
import { useRoom, useSend, useLicenseResult } from "@/providers/PartyProvider";
import { useSessionId } from "@/providers/SessionProvider";
import { da } from "@/lib/da";
import {
  clearStoredLicense,
  getStoredLicense,
  normalizeLicenseInput,
  setStoredLicense,
} from "@/lib/license";

/** Kanonisk 24-tegns kode → visningsform med bindestreger. */
function withDashes(canonical: string): string {
  return canonical.replace(/(.{6})(?=.)/g, "$1-");
}

/** Licens-fanen i HostSettings: rum-status, husket kode, indløsning og "glem". */
export function LicenseSettings() {
  const room = useRoom();
  const send = useSend();
  const sessionId = useSessionId();
  const licenseResult = useLicenseResult();

  const [stored, setStored] = useState(() => getStoredLicense());
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Reagér kun på svar på VORES indløsning — ikke fx hostConnect-koden ved load
  const pending = useRef<string | null>(null);

  const hasPack = (room?.entitlements ?? []).includes("pack1");

  useEffect(() => {
    if (!licenseResult || pending.current === null) return;
    setRedeeming(false);
    if (licenseResult.ok) {
      // Indtastning her er en bevidst handling på denne enhed — husk koden
      setStoredLicense(pending.current);
      setStored(pending.current);
      setCodeInput("");
      setMessage({ ok: true, text: da.license.settings.unlockedPacks });
    } else {
      setMessage({ ok: false, text: da.license.errors[licenseResult.reason ?? "invalid"] });
    }
    pending.current = null;
  }, [licenseResult]);

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const canonical = normalizeLicenseInput(codeInput);
    if (!canonical) {
      setMessage({ ok: false, text: da.license.errors.badFormat });
      return;
    }
    const code = withDashes(canonical);
    pending.current = code;
    setMessage(null);
    setRedeeming(true);
    send({ type: "redeemLicense", hostId: sessionId, code });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Rum-status */}
      <div className="rounded-2xl bg-[var(--color-surface)] p-5">
        <p className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-2">
          {da.license.settings.status}
        </p>
        <div className="flex items-center gap-2.5">
          <Sparkles
            className="h-5 w-5"
            style={{ color: hasPack ? "var(--color-primary)" : "var(--color-text-muted)" }}
          />
          <span className="text-base font-semibold">
            {hasPack ? da.license.settings.unlockedPacks : da.license.settings.freeOnly}
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          {stored
            ? `${da.license.settings.rememberedCode}: ${stored.slice(0, 6)}…`
            : da.license.settings.noRememberedCode}
        </p>
      </div>

      {/* Indløs kode */}
      <form onSubmit={handleRedeem} className="rounded-2xl bg-[var(--color-surface)] p-5 flex flex-col gap-3">
        <p className="text-base font-semibold">{da.license.modal.haveCode}</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setMessage(null); }}
            placeholder={da.license.modal.codePlaceholder}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 rounded-xl bg-[var(--color-bg)] px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={redeeming}
            className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {redeeming ? da.license.modal.redeeming : da.license.modal.redeem}
          </button>
        </div>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold"
            style={{ color: message.ok ? "var(--color-primary)" : "var(--color-danger)" }}
          >
            {message.text}
          </motion.p>
        )}
      </form>

      {/* Glem koden på denne enhed — rører ALDRIG rummets entitlements */}
      {stored && (
        <div className="rounded-2xl bg-[var(--color-surface)] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold">{da.license.settings.forgetTitle}</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {da.license.settings.forgetHint}
            </p>
          </div>
          <button
            onClick={() => { clearStoredLicense(); setStored(null); }}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-light)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            {da.license.settings.forget}
          </button>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        {da.license.modal.support}{" "}
        <a href={`mailto:${da.license.supportEmail}`} className="underline underline-offset-2">
          {da.license.supportEmail}
        </a>
      </p>
    </div>
  );
}
