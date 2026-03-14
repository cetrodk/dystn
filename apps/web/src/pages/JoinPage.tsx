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

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4 || !name.trim()) return;

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
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <a
        href="/"
        className="absolute top-4 left-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        ← {da.back}
      </a>
      <motion.a
        href="/"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-5xl font-bold glow-text cursor-pointer hover:opacity-80 transition-opacity"
      >
        {da.title}
      </motion.a>

      <AnimatePresence>
        {existingSession && !dismissedRejoin ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card-glow flex w-full max-w-xs flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-4"
          >
            <p className="text-center text-sm">
              Du er allerede i et spil som{" "}
              <strong className="text-[var(--color-primary-light)]">{existingSession.playerName}</strong>
            </p>
            <button
              onClick={() => navigate(`/play/${existingSession.roomCode}`)}
              className="rounded-xl bg-[var(--color-primary)] p-3 font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer"
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

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleJoin}
        className="flex w-full max-w-xs flex-col gap-4"
      >
        <input
          type="text"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          placeholder={da.enterCode}
          className="rounded-xl bg-[var(--color-surface)] p-4 text-center font-display text-3xl font-bold uppercase tracking-[0.3em] placeholder:text-[var(--color-text-muted)] placeholder:text-base placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-shadow"
          autoComplete="off"
          autoFocus
        />
        <div className="relative flex items-center rounded-xl bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/50 transition-shadow">
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="shrink-0 ml-3 flex items-center justify-center h-9 w-9 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer overflow-hidden"
          >
            {selectedAvatar ? (
              <img
                src={getAvatarSrc(selectedAvatar)}
                alt={selectedAvatar}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg text-[var(--color-text-muted)]">+</span>
            )}
          </button>
          <input
            type="text"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={da.enterName}
            className="flex-1 bg-transparent p-4 text-center text-xl placeholder:text-[var(--color-text-muted)] focus:outline-none"
            autoComplete="off"
          />
          <div className="shrink-0 w-9 mr-3" />
        </div>

        <AnimatePresence>
          {avatarModalOpen ? (
            <AvatarPickerModal
              selected={selectedAvatar}
              onSelect={setSelectedAvatar}
              onClose={() => setAvatarModalOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        {error ? (
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-center text-sm font-medium text-[var(--color-danger)]"
          >
            {error}
          </motion.p>
        ) : null}

        <motion.button
          type="submit"
          disabled={code.length !== 4 || !name.trim() || joining}
          whileHover={code.length === 4 && name.trim() ? { scale: 1.03 } : undefined}
          whileTap={code.length === 4 && name.trim() ? { scale: 0.97 } : undefined}
          className="rounded-xl bg-[var(--color-primary)] p-4 text-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={code.length === 4 && name.trim() ? { boxShadow: "0 0 20px color-mix(in srgb, var(--color-primary) 19%, transparent)" } : undefined}
        >
          {joining ? "..." : da.join}
        </motion.button>
      </motion.form>
    </div>
  );
}
