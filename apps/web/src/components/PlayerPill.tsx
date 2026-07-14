import { motion } from "framer-motion";
import { GameAvatar } from "@/components/GameAvatar";
import type { AvatarTraits } from "@/lib/avatar";

interface PillPlayer {
  _id: string;
  name: string;
  avatarColor: string;
  avatar?: AvatarTraits;
  hasSubmitted?: boolean;
}

interface PlayerPillProps {
  player: PillPlayer;
  /** Scrawl: kunstneren skal ikke svare — dæmpet pill med ✏️ i stedet for ✓ */
  isArtist?: boolean;
}

/**
 * Vent-på-svar-pill på værtsskærmen: avatar + navn, fyldes med spillerens
 * farve og popper, når svaret er inde. Én delt komponent — var tidligere
 * copy-pastet i hver fase (fusk/blitz HostSubmit, morph HostWrite/HostGuess,
 * scrawl HostDraw/HostGuess).
 */
export function PlayerPill({ player: p, isArtist = false }: PlayerPillProps) {
  const done = !isArtist && !!p.hasSubmitted;
  return (
    <motion.div
      layout
      animate={{
        backgroundColor: isArtist || done ? p.avatarColor : "var(--color-surface)",
        color: isArtist || done ? "#fff" : "var(--color-text)",
        opacity: isArtist ? 0.6 : done ? 1 : 0.4,
        scale: done ? [1, 1.15, 1] : 1,
      }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4"
    >
      <GameAvatar
        name={p.name}
        avatarColor={p.avatarColor}
        avatar={p.avatar}
        className="h-6 w-6"
      />
      <span className="text-base font-semibold">{p.name}</span>
      {isArtist ? (
        <span className="text-sm">✏️</span>
      ) : done ? (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-sm">
          ✓
        </motion.span>
      ) : null}
    </motion.div>
  );
}
