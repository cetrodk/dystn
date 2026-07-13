import type { AvatarTraits } from "@/lib/avatar";
import { motion } from "framer-motion";
import { CountdownTimer } from "@dystn/ui/CountdownTimer";
import { GameAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";

interface WaitingScreenProps {
  deadline: number | null | undefined;
  players?: Array<{
    _id: string;
    name: string;
    avatarColor: string;
    avatar?: AvatarTraits;
    hasSubmitted?: boolean;
  }>;
  /** Optional content displayed between the checkmark and the progress */
  children?: React.ReactNode;
}

export function WaitingScreen({ deadline, players, children }: WaitingScreenProps) {
  const pendingPlayers = players?.filter((p) => !p.hasSubmitted) ?? [];
  const totalPlayers = players?.length ?? 0;
  const submittedCount = totalPlayers - pendingPlayers.length;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className="text-6xl"
      >
        ✓
      </motion.div>
      <p className="font-display text-2xl font-bold">{da.waiting}</p>

      {children}

      {players && totalPlayers > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            {submittedCount}/{totalPlayers} har svaret
          </p>
          {pendingPlayers.length > 0 && pendingPlayers.length <= 3 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Venter på</span>
              {pendingPlayers.map((p) => (
                <div key={p._id} className="flex items-center gap-1">
                  <GameAvatar
                    name={p.name}
                    avatarColor={p.avatarColor}
                    avatar={p.avatar}
                    className="h-6 w-6"
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-4xl font-mono font-bold text-[var(--color-primary)]">
        <CountdownTimer deadline={deadline ?? null} />
      </div>
    </div>
  );
}
