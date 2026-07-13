import { traitsFromName, type AvatarTraits } from "@/lib/avatar";

interface GameAvatarProps {
  name: string;
  avatarColor: string;
  avatar?: AvatarTraits;
  className?: string;
}

/** Isoleret visning af ét træk — bruges af editorens option-knapper. */
export type BlobPart = "full" | "shape" | "eyes" | "mouth" | "hat";

/** Beskåret viewBox pr. del, så det enkelte træk fylder hele fladen. */
const PART_VIEWBOX: Record<BlobPart, string> = {
  full: "0 0 100 100",
  shape: "0 0 100 100",
  eyes: "28 36 44 24",
  mouth: "30 54 40 22",
  hat: "16 2 68 34",
};

/**
 * Procedural "blob" avatar — a friendly cartoon face whose shape, eyes,
 * mouth and hat come from the player's chosen traits (falling back to a
 * name-derived hash for players without one). Matches the warm-editorial
 * design language (ink outline, accent fill). Theme-aware: outline + face
 * use currentColor, set to the ink colour via CSS.
 */
export function BlobAvatar({
  traits,
  color,
  part = "full",
}: {
  traits: AvatarTraits;
  color: string;
  part?: BlobPart;
}) {
  const { shape, eyes, mouth, hat } = traits;
  // Øjne: 0=standard, 1=kigger venstre, 2=kigger højre, 3=søvnige, 4=store
  const eyeOffset = eyes === 1 ? -3 : eyes === 2 ? 3 : 0;
  const eyeR = eyes === 4 ? 6 : 4.5;
  const glintR = eyes === 4 ? 2 : 1.4;
  const show = (p: Exclude<BlobPart, "full">) => part === "full" || part === p;

  return (
    <svg
      viewBox={PART_VIEWBOX[part]}
      className="h-full w-full"
      style={{ display: "block", color: "var(--color-ink)" }}
      aria-hidden="true"
    >
      {show("shape") && shape === 0 && (
        <circle cx="50" cy="50" r="40" fill={color} stroke="currentColor" strokeWidth="3" />
      )}
      {show("shape") && shape === 1 && (
        <rect x="12" y="14" width="76" height="72" rx="14" fill={color} stroke="currentColor" strokeWidth="3" />
      )}
      {show("shape") && shape === 2 && (
        <path
          d="M50 10 C 85 18, 90 60, 70 86 C 40 95, 10 75, 14 44 C 18 22, 30 10, 50 10 Z"
          fill={color}
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {show("shape") && shape === 3 && (
        <polygon points="50,10 88,35 78,85 22,85 12,35" fill={color} stroke="currentColor" strokeWidth="3" />
      )}
      {show("hat") && hat === 1 && <path d="M25 28 Q50 8 75 28 L72 32 L28 32 Z" fill="currentColor" />}
      {show("hat") && hat === 2 && (
        <g>
          <rect x="36" y="12" width="28" height="8" fill="currentColor" />
          <rect x="30" y="20" width="40" height="4" fill="currentColor" />
        </g>
      )}
      {show("hat") && hat === 3 && (
        <path d="M30 30 Q50 18 70 30" stroke="currentColor" strokeWidth="3" fill="none" />
      )}
      {show("eyes") &&
        (eyes === 3 ? (
          <g>
            <path d="M35 48 Q40 53 45 48" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M57 48 Q62 53 67 48" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx={40 + eyeOffset} cy="48" r={eyeR} fill="currentColor" />
            <circle cx={62 + eyeOffset} cy="48" r={eyeR} fill="currentColor" />
            <circle cx={41 + eyeOffset} cy="47" r={glintR} fill="var(--color-paper)" />
            <circle cx={63 + eyeOffset} cy="47" r={glintR} fill="var(--color-paper)" />
          </g>
        ))}
      {show("mouth") && mouth === 0 && (
        <path d="M38 64 Q50 74 62 64" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {show("mouth") && mouth === 1 && (
        <path d="M38 66 L62 66" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      )}
      {show("mouth") && mouth === 2 && <ellipse cx="50" cy="66" rx="5" ry="6" fill="currentColor" />}
      {part === "full" && (
        <g>
          <circle cx="30" cy="60" r="3" fill="#e85a8a" opacity="0.55" />
          <circle cx="72" cy="60" r="3" fill="#e85a8a" opacity="0.55" />
        </g>
      )}
    </svg>
  );
}

export function GameAvatar({
  name,
  avatarColor,
  avatar,
  className = "h-10 w-10",
}: GameAvatarProps) {
  const traits = avatar ?? traitsFromName(name);
  return (
    <div className={`${className} shrink-0`}>
      <BlobAvatar traits={traits} color={avatarColor} />
    </div>
  );
}
