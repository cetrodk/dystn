import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BlobAvatar } from "@/components/GameAvatar";
import { AvatarEditorModal } from "@/components/AvatarEditorModal";
import { da } from "@/lib/da";
import { PLAYER_NAME_KEY, PLAYER_AVATAR_KEY } from "@/lib/session";
import {
  AVATAR_PALETTE,
  parseStoredAvatar,
  randomAvatar,
  type AvatarSpec,
} from "@/lib/avatar";

export function JoinPage() {
  const navigate = useNavigate();
  const { code: codeParam } = useParams<{ code?: string }>();

  const [code, setCode] = useState(codeParam?.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [avatar, setAvatar] = useState<AvatarSpec>(
    () => parseStoredAvatar(sessionStorage.getItem(PLAYER_AVATAR_KEY)) ?? randomAvatar(),
  );
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const canSubmit = code.length === 4 && name.trim().length > 0 && !joining;

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setJoining(true);

    // Store player name and avatar in sessionStorage so PlayerView can send
    // the join message when it connects to PartyKit
    const trimmedName = name.trim();
    sessionStorage.setItem(PLAYER_NAME_KEY, trimmedName);
    sessionStorage.setItem(PLAYER_AVATAR_KEY, JSON.stringify(avatar));

    navigate(`/play/${code.toUpperCase()}`);
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
          className="font-display text-5xl glow-text cursor-pointer hover:opacity-80 transition-opacity sm:text-6xl"
        >
          {da.title}
        </motion.a>

        {/* Join form — phone card */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 150, damping: 18 }}
          onSubmit={handleJoin}
          className="nb-card flex w-full flex-col gap-4 rounded-[28px] p-6"
        >
          <div className="-mt-1 mb-1 flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-muted)]">
            <span>DYSTN.APP</span>
            <span>DELTAG</span>
          </div>
          {/* Room code input */}
          <input
            type="text"
            maxLength={4}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            }
            placeholder={da.enterCode}
            className="w-full rounded-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-bg)] p-4 text-center font-display text-4xl uppercase tracking-[0.3em] placeholder:text-[var(--color-text-muted)]/50 placeholder:text-base placeholder:tracking-normal placeholder:font-normal"
            style={{ boxShadow: "4px 4px 0 var(--color-ink)" }}
            autoComplete="off"
            autoFocus
          />

          {/* Avatar — stor og klikbar; første møde med figuren skal kunne ses */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.16, type: "spring", stiffness: 150, damping: 18 }}
            className="relative mx-auto mt-1"
          >
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              aria-label={da.avatar.title}
              className="flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-[var(--color-ink)] bg-[var(--color-surface-light)] p-2 transition-colors hover:bg-[var(--color-primary)]/20 cursor-pointer"
              style={{ boxShadow: "4px 4px 0 var(--color-ink)" }}
            >
              <BlobAvatar traits={avatar} color={AVATAR_PALETTE[avatar.color]} />
            </button>
            <button
              type="button"
              onClick={() => setAvatar(randomAvatar())}
              aria-label={da.avatar.shuffle}
              className="absolute -bottom-1 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-surface)] text-lg transition-colors hover:bg-[var(--color-primary)]/20 cursor-pointer"
              style={{ boxShadow: "2px 2px 0 var(--color-ink)" }}
            >
              ↻
            </button>
          </motion.div>

          {/* Name input */}
          <motion.input
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 150, damping: 18 }}
            type="text"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={da.enterName}
            className="w-full rounded-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-surface)] p-4 text-center text-xl placeholder:text-[var(--color-text-muted)]/50"
            style={{ boxShadow: "4px 4px 0 var(--color-ink)" }}
            autoComplete="off"
          />

          <AnimatePresence>
            {avatarModalOpen ? (
              <AvatarEditorModal
                value={avatar}
                onChange={setAvatar}
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
            className="nb-press rounded-2xl border-[3px] border-[var(--color-ink)] p-4 font-display text-2xl disabled:cursor-not-allowed cursor-pointer"
            style={{
              backgroundColor: canSubmit ? "var(--color-ink)" : "var(--color-surface-light)",
              color: canSubmit ? "var(--color-paper)" : "color-mix(in srgb, var(--color-ink) 35%, transparent)",
              boxShadow: canSubmit ? "5px 5px 0 var(--color-primary)" : "none",
            }}
          >
            {joining ? "..." : `${da.join} →`}
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
}
