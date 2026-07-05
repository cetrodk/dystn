import { getAvatarSrc } from "@/lib/avatars";

interface GameAvatarProps {
  name: string;
  avatarColor: string;
  avatarImage?: string;
  className?: string;
}

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/**
 * Procedural "blob" avatar — a friendly cartoon face whose shape, eyes,
 * smile and hat are derived from the player's name. Used as the fallback
 * when a player hasn't picked an image avatar. Matches the warm-editorial
 * design language (ink outline, accent fill). Theme-aware: outline + face
 * use currentColor, set to the ink colour via CSS.
 */
function BlobAvatar({ seed, color }: { seed: string; color: string }) {
  const h = hashStr(seed);
  const shape = h % 4;
  const eyeOffset = (h % 5) - 2;
  const smile = h % 3;
  const hat = h % 5;

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full"
      style={{ display: "block", color: "var(--color-ink)" }}
      aria-hidden="true"
    >
      {shape === 0 && (
        <circle cx="50" cy="50" r="40" fill={color} stroke="currentColor" strokeWidth="3" />
      )}
      {shape === 1 && (
        <rect x="12" y="14" width="76" height="72" rx="14" fill={color} stroke="currentColor" strokeWidth="3" />
      )}
      {shape === 2 && (
        <path
          d="M50 10 C 85 18, 90 60, 70 86 C 40 95, 10 75, 14 44 C 18 22, 30 10, 50 10 Z"
          fill={color}
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {shape === 3 && (
        <polygon points="50,10 88,35 78,85 22,85 12,35" fill={color} stroke="currentColor" strokeWidth="3" />
      )}
      {hat === 1 && <path d="M25 28 Q50 8 75 28 L72 32 L28 32 Z" fill="currentColor" />}
      {hat === 2 && (
        <g>
          <rect x="36" y="12" width="28" height="8" fill="currentColor" />
          <rect x="30" y="20" width="40" height="4" fill="currentColor" />
        </g>
      )}
      {hat === 3 && <path d="M30 30 Q50 18 70 30" stroke="currentColor" strokeWidth="3" fill="none" />}
      <circle cx={40 + eyeOffset} cy="48" r="4.5" fill="currentColor" />
      <circle cx={62 + eyeOffset} cy="48" r="4.5" fill="currentColor" />
      <circle cx={41 + eyeOffset} cy="47" r="1.4" fill="#fff" />
      <circle cx={63 + eyeOffset} cy="47" r="1.4" fill="#fff" />
      {smile === 0 && (
        <path d="M38 64 Q50 74 62 64" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {smile === 1 && <path d="M38 66 L62 66" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />}
      {smile === 2 && <ellipse cx="50" cy="66" rx="5" ry="6" fill="currentColor" />}
      <circle cx="30" cy="60" r="3" fill="#e85a8a" opacity="0.55" />
      <circle cx="72" cy="60" r="3" fill="#e85a8a" opacity="0.55" />
    </svg>
  );
}

export function GameAvatar({
  name,
  avatarColor,
  avatarImage,
  className = "h-10 w-10",
}: GameAvatarProps) {
  const src = getAvatarSrc(avatarImage);
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div className={`${className} shrink-0`}>
      <BlobAvatar seed={name} color={avatarColor} />
    </div>
  );
}
