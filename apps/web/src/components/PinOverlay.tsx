import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { api } from "../../convex/_generated/api";

const STORAGE_KEY = "festspil-pin";

export function PinOverlay({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyPin = useMutation(api.auth.verifyPin);

  const tryUnlock = useCallback(
    async (code: string) => {
      try {
        const { valid } = await verifyPin({ pin: code });
        if (valid) {
          localStorage.setItem(STORAGE_KEY, code);
          setUnlocked(true);
          return true;
        }
      } catch {
        // verification failed
      }
      return false;
    },
    [verifyPin],
  );

  // Auto-verify stored PIN on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      tryUnlock(stored).finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, [tryUnlock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    setLoading(true);
    setError("");
    const ok = await tryUnlock(pin);
    if (!ok) {
      setError("Forkert PIN-kode");
      setPin("");
    }
    setLoading(false);
  };

  // Don't flash overlay while checking stored PIN
  if (checking) return null;

  return (
    <>
      <AnimatePresence>
        {!unlocked && (
          <motion.div
            key="pin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-[var(--color-bg)]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
              className="flex w-full max-w-xs flex-col items-center gap-6 px-6"
            >
              {/* Lock icon */}
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-surface)]">
                <Lock
                  className="h-10 w-10"
                  style={{ color: "var(--color-primary)" }}
                />
              </div>

              {/* Title */}
              <div className="text-center">
                <h1
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: "Fredoka, sans-serif",
                    color: "var(--color-text)",
                  }}
                >
                  Festspil
                </h1>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Indtast PIN-kode for at få adgang
                </p>
              </div>

              {/* PIN form */}
              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col items-center gap-4"
              >
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  placeholder="····"
                  autoComplete="off"
                  autoFocus
                  className="h-14 w-36 rounded-xl border-2 bg-[var(--color-surface)] text-center text-2xl tracking-[0.5em] outline-none transition-colors"
                  style={{
                    color: "var(--color-text)",
                    borderColor: error
                      ? "var(--color-danger)"
                      : "var(--color-surface-light)",
                  }}
                  onFocus={(e) => {
                    if (!error)
                      e.currentTarget.style.borderColor =
                        "var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    if (!error)
                      e.currentTarget.style.borderColor =
                        "var(--color-surface-light)";
                  }}
                />

                {/* Error message */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm"
                      style={{ color: "var(--color-danger)" }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={pin.length < 4 || loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition-opacity disabled:opacity-40"
                  style={{
                    background: "var(--color-primary)",
                    color: "#fff",
                    fontFamily: "Fredoka, sans-serif",
                  }}
                >
                  {loading ? (
                    "Tjekker..."
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" />
                      Lås op
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {unlocked && children}
    </>
  );
}
