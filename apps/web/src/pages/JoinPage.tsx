import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "@/providers/SessionProvider";
import { getAvatarSrc } from "@/lib/avatars";
import { AvatarPickerModal } from "@/components/AvatarPickerModal";
import { da } from "@/lib/da";

export function JoinPage() {
  const navigate = useNavigate();
  const sessionId = useSessionId();
  const joinRoom = useMutation(api.players.joinRoom);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [dismissedRejoin, setDismissedRejoin] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const existingSession = useQuery(api.players.rejoinRoom, { sessionId });

  const canSubmit = code.length === 4 && name.trim().length > 0 && !joining;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setJoining(true);
    try {
      const result = await joinRoom({
        code: code.toUpperCase(),
        name: name.trim(),
        sessionId,
        ...(selectedAvatar ? { avatarImage: selectedAvatar } : {}),
      });
      navigate(`/play/${result.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center p-4 sm:p-8">

      {/* Back link */}
      <a
        href="/"
        className="absolute top-4 left-4 z-20 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        &larr; {da.back}
      </a>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8"
      >
        {/* Title */}
        <motion.a
          href="/"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="font-display text-5xl font-bold glow-text cursor-pointer hover:opacity-80 transition-opacity sm:text-6xl"
        >
          {da.title}
        </motion.a>

        {/* Rejoin banner */}
        <AnimatePresence>
          {existingSession && !dismissedRejoin ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-glow flex w-full flex-col gap-3 rounded-2xl bg-[var(--color-surface)] p-5"
            >
              <p className="text-center text-sm">
                Du er allerede i et spil som{" "}
                <strong className="text-[var(--color-primary-light)]">
                  {existingSession.playerName}
                </strong>
              </p>
              <button
                onClick={() => navigate(`/play/${existingSession.roomCode}`)}
                className="rounded-xl bg-[var(--color-primary)] p-3 font-bold transition-transform hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                Vend tilbage ({existingSession.roomCode})
              </button>
              <button
                onClick={() => setDismissedRejoin(true)}
                className="text-sm text-[var(--color-text-muted)] underline underline-offset-4 cursor-pointer"
              >
                Deltag i et nyt spil i stedet
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Join form */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 150, damping: 18 }}
          onSubmit={handleJoin}
          className="flex w-full flex-col gap-4"
        >
          {/* Room code input */}
          <div className="group relative">
            <input
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder={da.enterCode}
              className="w-full rounded-2xl bg-[var(--color-surface)] p-4 text-center font-display text-3xl font-bold uppercase tracking-[0.3em] placeholder:text-[var(--color-text-muted)]/50 placeholder:text-base placeholder:tracking-normal placeholder:font-normal focus:outline-none transition-shadow"
              style={{
                boxShadow: code.length === 4
                  ? "0 0 0 2px color-mix(in srgb, var(--color-primary) 50%, transparent), 0 0 20px color-mix(in srgb, var(--color-primary) 12%, transparent)"
                  : undefined,
              }}
              autoComplete="off"
              autoFocus
            />
            {/* Subtle success indicator when code is filled */}
            <motion.div
              className="absolute right-4 top-1/2 -translate-y-1/2"
              initial={false}
              animate={{ opacity: code.length === 4 ? 1 : 0, scale: code.length === 4 ? 1 : 0.5 }}
            >
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--color-success)" }}
              />
            </motion.div>
          </div>

          {/* Name + avatar input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 150, damping: 18 }}
            className="relative flex items-center rounded-2xl bg-[var(--color-surface)] transition-shadow focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_50%,transparent)]"
          >
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              className="group/avatar shrink-0 ml-3 flex items-center justify-center h-10 w-10 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer overflow-hidden"
            >
              {selectedAvatar ? (
                <img
                  src={getAvatarSrc(selectedAvatar)}
                  alt={selectedAvatar}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg text-[var(--color-text-muted)] group-hover/avatar:text-[var(--color-primary-light)] transition-colors">
                  +
                </span>
              )}
            </button>
            <input
              type="text"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={da.enterName}
              className="flex-1 bg-transparent p-4 text-center text-xl placeholder:text-[var(--color-text-muted)]/50 focus:outline-none"
              autoComplete="off"
            />
            {/* Spacer to keep text centered */}
            <div className="shrink-0 w-10 mr-3" />
          </motion.div>

          <AnimatePresence>
            {avatarModalOpen ? (
              <AvatarPickerModal
                selected={selectedAvatar}
                onSelect={setSelectedAvatar}
                onClose={() => setAvatarModalOpen(false)}
              />
            ) : null}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-center text-sm font-medium text-[var(--color-danger)]"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={!canSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, type: "spring", stiffness: 150, damping: 18 }}
            whileHover={canSubmit ? { scale: 1.03 } : undefined}
            whileTap={canSubmit ? { scale: 0.97 } : undefined}
            className="rounded-2xl bg-[var(--color-primary)] p-4 text-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-shadow"
            style={
              canSubmit
                ? {
                    boxShadow:
                      "0 0 24px color-mix(in srgb, var(--color-primary) 25%, transparent)",
                  }
                : undefined
            }
          >
            {joining ? "..." : da.join}
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
}
