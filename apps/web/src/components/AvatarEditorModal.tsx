import { motion } from "framer-motion";
import { BlobAvatar } from "@/components/GameAvatar";
import { da } from "@/lib/da";
import {
  AVATAR_PALETTE,
  TRAIT_COUNTS,
  randomAvatar,
  type AvatarSpec,
} from "@/lib/avatar";

interface AvatarEditorModalProps {
  value: AvatarSpec;
  onChange: (value: AvatarSpec) => void;
  onClose: () => void;
}

const TRAIT_ROWS = [
  { key: "shape", label: da.avatar.shape },
  { key: "eyes", label: da.avatar.eyes },
  { key: "mouth", label: da.avatar.mouth },
  { key: "hat", label: da.avatar.hat },
] as const;

/**
 * Blob-avatar editor: live preview + shuffle + one option row per trait.
 * Fully controlled — parents own the state (JoinPage keeps it locally,
 * PlayerView sends changeAvatar on every change for live lobby feedback).
 */
export function AvatarEditorModal({ value, onChange, onClose }: AvatarEditorModalProps) {
  return (
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
        className="card-glow w-full max-w-sm rounded-2xl bg-[var(--color-bg-warm)] p-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl font-bold">{da.avatar.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Live preview + shuffle */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="h-28 w-28">
            <BlobAvatar traits={value} color={AVATAR_PALETTE[value.color]} />
          </div>
          <button
            type="button"
            onClick={() => onChange(randomAvatar())}
            className="nb-press rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-surface)] px-4 py-1.5 text-sm font-bold tracking-wide cursor-pointer"
            style={{ boxShadow: "3px 3px 0 var(--color-ink)" }}
          >
            ↻ {da.avatar.shuffle}
          </button>
        </div>

        {/* Color swatches */}
        <div className="mb-3">
          <div className="mb-1.5 font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-muted)] uppercase">
            {da.avatar.color}
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_PALETTE.map((hex, i) => (
              <button
                key={hex}
                type="button"
                aria-label={`${da.avatar.color} ${i + 1}`}
                onClick={() => onChange({ ...value, color: i })}
                className={`h-9 w-9 rounded-full border-2 border-[var(--color-ink)] transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
                  value.color === i ? "ring-2 ring-offset-2 ring-[var(--color-ink)] ring-offset-[var(--color-bg-warm)]" : ""
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        {/* Trait rows with mini-blob previews */}
        {TRAIT_ROWS.map(({ key, label }) => (
          <div key={key} className="mb-3">
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-muted)] uppercase">
              {label}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: TRAIT_COUNTS[key] }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ ...value, [key]: i })}
                  className={`rounded-xl p-1 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    value[key] === i
                      ? "ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/20"
                      : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)]"
                  }`}
                >
                  <div className="h-10 w-10">
                    <BlobAvatar
                      traits={{ ...value, [key]: i }}
                      color={AVATAR_PALETTE[value.color]}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onClose}
          className="nb-press mt-1 w-full rounded-xl border-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] p-3 font-display text-lg text-[var(--color-paper)] cursor-pointer"
          style={{ boxShadow: "4px 4px 0 var(--color-primary)" }}
        >
          {da.avatar.done}
        </button>
      </motion.div>
    </motion.div>
  );
}
