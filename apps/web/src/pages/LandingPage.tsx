import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "@/providers/SessionProvider";
import { da } from "@/lib/da";

export function LandingPage() {
  const navigate = useNavigate();
  const sessionId = useSessionId();
  const createRoom = useMutation(api.rooms.createRoom);
  const existingSession = useQuery(api.players.rejoinRoom, { sessionId });

  async function handleCreateRoom() {
    const { code } = await createRoom({ hostId: sessionId });
    navigate(`/host/${code}`);
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center p-4 sm:p-8">

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex w-full max-w-lg flex-col items-center gap-10"
      >
        {/* Badge */}
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="font-display inline-block rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-[var(--color-primary-light)] uppercase"
        >
          Det ultimative festspil
        </motion.span>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 150 }}
          className="text-center"
        >
          <h1 className="font-display text-6xl font-bold tracking-tight glow-text sm:text-8xl">
            {da.title}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-base text-[var(--color-text-muted)] sm:text-lg">
            {da.subtitle}
          </p>
        </motion.div>

        {/* Rejoin banner */}
        <AnimatePresence>
          {existingSession ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-glow w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-5"
            >
              <p className="mb-3 text-center text-sm">
                Du er i et spil som{" "}
                <strong className="text-[var(--color-primary-light)]">
                  {existingSession.playerName}
                </strong>
              </p>
              <button
                onClick={() => navigate(`/play/${existingSession.roomCode}`)}
                className="w-full rounded-xl bg-[var(--color-primary)] p-3 font-bold transition-transform hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                Vend tilbage ({existingSession.roomCode})
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Two equal action cards */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <ActionCard
            index={0}
            icon={<TvIcon />}
            title="Vær vært"
            description="Vis spillet på dit TV eller din computer."
            accentColor="var(--color-primary)"
            onClick={handleCreateRoom}
          />
          <ActionCard
            index={1}
            icon={<PhoneIcon />}
            title="Deltag"
            description="Brug din telefon til at spille med dine venner."
            accentColor="var(--color-accent)"
            onClick={() => navigate("/play")}
          />
        </div>

        {/* How it works hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-[var(--color-text-muted)]/60"
        >
          En spiller opretter et rum og viser det på TV
          <span className="mx-1.5">·</span>
          Alle andre deltager via telefonen
        </motion.p>
      </motion.div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-4 text-[10px] tracking-[0.2em] text-[var(--color-text-muted)]/30 uppercase"
      >
        &copy; 2026 Festspil Platform
      </motion.footer>
    </div>
  );
}

function ActionCard({
  index,
  icon,
  title,
  description,
  accentColor,
  onClick,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.25 + index * 0.1,
        type: "spring",
        stiffness: 180,
        damping: 18,
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="card-glow group relative cursor-pointer rounded-2xl bg-[var(--color-surface)] p-6 text-left transition-shadow hover:shadow-lg sm:p-7"
      style={{
        ["--card-accent" as string]: accentColor,
      }}
    >
      {/* Hover glow behind card */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, color-mix(in srgb, ${accentColor} 12%, transparent), transparent 70%)`,
        }}
      />

      {/* Icon */}
      <div
        className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{
          background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          color: accentColor,
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <h2 className="font-display relative text-xl font-bold text-[var(--color-text)]">
        {title}
      </h2>
      <p className="relative mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {description}
      </p>

      {/* Arrow hint */}
      <span
        className="absolute right-5 bottom-5 text-lg opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-60"
        style={{ color: accentColor }}
      >
        &rarr;
      </span>
    </motion.button>
  );
}

function TvIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
