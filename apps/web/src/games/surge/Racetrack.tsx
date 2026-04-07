import { memo, useMemo } from "react";
import { motion } from "framer-motion";

export const FINISH_LINE = 8;

// Track dimensions within the SVG viewBox
const SVG_WIDTH = 900;
const SVG_HEIGHT = 240;
const TRACK_START_X = 60;
const TRACK_END_X = 840;
const TRACK_WIDTH = TRACK_END_X - TRACK_START_X;

// Generate a gentle wave path between start and end
function buildTrackPath(yCenter: number): string {
  const amplitude = 30;
  // Cubic bezier wave: 3 curves across the width
  return [
    `M ${TRACK_START_X},${yCenter}`,
    `C ${TRACK_START_X + TRACK_WIDTH * 0.12},${yCenter - amplitude}`,
    `${TRACK_START_X + TRACK_WIDTH * 0.22},${yCenter + amplitude}`,
    `${TRACK_START_X + TRACK_WIDTH * 0.33},${yCenter}`,
    `C ${TRACK_START_X + TRACK_WIDTH * 0.44},${yCenter - amplitude}`,
    `${TRACK_START_X + TRACK_WIDTH * 0.56},${yCenter + amplitude}`,
    `${TRACK_START_X + TRACK_WIDTH * 0.67},${yCenter}`,
    `C ${TRACK_START_X + TRACK_WIDTH * 0.78},${yCenter - amplitude}`,
    `${TRACK_START_X + TRACK_WIDTH * 0.88},${yCenter + amplitude * 0.5}`,
    `${TRACK_END_X},${yCenter}`,
  ].join(" ");
}

// Sample a point along an SVG path at a given fraction (0-1)
// Reuses a persistent off-screen SVG element to avoid DOM churn and forced reflows
let _sharedSvg: SVGSVGElement | null = null;
let _sharedPath: SVGPathElement | null = null;

function samplePath(pathD: string, fraction: number): { x: number; y: number } {
  if (typeof document === "undefined") return { x: TRACK_START_X + fraction * TRACK_WIDTH, y: 120 };
  if (!_sharedSvg) {
    _sharedSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    _sharedPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    _sharedSvg.style.position = "absolute";
    _sharedSvg.style.visibility = "hidden";
    _sharedSvg.style.width = "0";
    _sharedSvg.style.height = "0";
    _sharedSvg.appendChild(_sharedPath);
    document.body.appendChild(_sharedSvg);
  }
  _sharedPath!.setAttribute("d", pathD);
  const totalLength = _sharedPath!.getTotalLength();
  const point = _sharedPath!.getPointAtLength(fraction * totalLength);
  return { x: point.x, y: point.y };
}

interface RacetrackPlayer {
  _id: string;
  name: string;
  avatarColor: string;
  avatarImage?: string;
}

// Static SVG defs hoisted to module scope to avoid re-creation on every render
const TRACK_DEFS = (
  <defs>
    <filter id="finishGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="trackAmbient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="var(--color-surge)" stopOpacity="0.03" />
      <stop offset="50%" stopColor="var(--color-surge)" stopOpacity="0.06" />
      <stop offset="100%" stopColor="var(--color-surge)" stopOpacity="0.12" />
    </linearGradient>
    <filter id="avatarGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

interface RacetrackProps {
  players: RacetrackPlayer[];
  trackPositions: Record<string, number>;
  animationDelay?: number;
  winners?: string[];
}

export const Racetrack = memo(function Racetrack({
  players,
  trackPositions,
  animationDelay = 0,
  winners,
}: RacetrackProps) {
  // Build one lane path per player, spread vertically
  const lanes = useMemo(() => {
    const spread = Math.min(players.length * 14, 70);
    return players.map((_, i) => {
      const yOffset =
        players.length <= 1
          ? 0
          : ((i - (players.length - 1) / 2) / (players.length - 1)) * spread;
      return buildTrackPath(SVG_HEIGHT / 2 + yOffset);
    });
  }, [players.length]);

  // For each player, compute the SVG point on their lane at their current position
  const playerPoints = useMemo(() => {
    return players.map((player, i) => {
      const pos = trackPositions[player._id] ?? 0;
      const fraction = Math.min(pos / FINISH_LINE, 1);
      const point = samplePath(lanes[i], fraction);
      return { player, point, pos, laneIndex: i };
    });
  }, [players, trackPositions, lanes]);

  return (
    <div className="w-full flex-1 min-h-0">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {TRACK_DEFS}

        {/* Ambient track surface glow */}
        <rect
          x={TRACK_START_X - 10}
          y={30}
          width={TRACK_WIDTH + 20}
          height={SVG_HEIGHT - 60}
          rx={12}
          fill="url(#trackAmbient)"
        />

        {/* Track lane lines */}
        {lanes.map((d, i) => (
          <path
            key={`lane-${i}`}
            d={d}
            fill="none"
            stroke="var(--color-surface-light)"
            strokeWidth="2"
            strokeDasharray="10 8"
            opacity="0.3"
          />
        ))}

        {/* Position markers */}
        {Array.from({ length: FINISH_LINE + 1 }, (_, i) => {
          const x = TRACK_START_X + (i / FINISH_LINE) * TRACK_WIDTH;
          return (
            <g key={`marker-${i}`}>
              <line
                x1={x}
                y1={30}
                x2={x}
                y2={SVG_HEIGHT - 30}
                stroke="var(--color-text-muted)"
                strokeWidth="1"
                opacity="0.08"
              />
              {/* Small tick marks at top and bottom */}
              {i > 0 && i < FINISH_LINE && (
                <>
                  <line
                    x1={x}
                    y1={SVG_HEIGHT - 28}
                    x2={x}
                    y2={SVG_HEIGHT - 20}
                    stroke="var(--color-surge)"
                    strokeWidth="1.5"
                    opacity="0.25"
                  />
                  <text
                    x={x}
                    y={SVG_HEIGHT - 8}
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize="13"
                    fontFamily="var(--font-display)"
                    opacity="0.3"
                  >
                    {i}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Start line */}
        <line
          x1={TRACK_START_X}
          y1={20}
          x2={TRACK_START_X}
          y2={SVG_HEIGHT - 20}
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          opacity="0.2"
        />
        <text
          x={TRACK_START_X}
          y={14}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontSize="11"
          fontWeight="bold"
          fontFamily="var(--font-display)"
          opacity="0.35"
        >
          START
        </text>

        {/* Finish line with glow */}
        <line
          x1={TRACK_END_X}
          y1={20}
          x2={TRACK_END_X}
          y2={SVG_HEIGHT - 20}
          stroke="var(--color-surge)"
          strokeWidth="4"
          opacity="0.9"
          filter="url(#finishGlow)"
        />
        {/* Checkered pattern on finish line */}
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={`check-${i}`}
            x={TRACK_END_X - 4}
            y={25 + i * ((SVG_HEIGHT - 50) / 8)}
            width={8}
            height={(SVG_HEIGHT - 50) / 16}
            fill="var(--color-surge)"
            opacity={i % 2 === 0 ? 0.5 : 0.15}
          />
        ))}
        <text
          x={TRACK_END_X}
          y={14}
          textAnchor="middle"
          fill="var(--color-surge)"
          fontSize="13"
          fontWeight="bold"
          fontFamily="var(--font-display)"
          opacity="0.8"
        >
          MÅL
        </text>

        {/* Player avatars */}
        {playerPoints.map(({ player, point, pos, laneIndex }) => {
          const isWinner = winners?.includes(player._id);
          const avatarSize = isWinner ? 40 : 32;

          return (
            <motion.g
              key={player._id}
              animate={{ x: point.x, y: point.y }}
              transition={{
                type: "spring",
                stiffness: 120,
                damping: 18,
                delay: animationDelay + laneIndex * 0.08,
              }}
            >
              {/* Winner glow — animated pulse */}
              {isWinner && (
                <motion.circle
                  r={avatarSize / 2 + 6}
                  fill="none"
                  stroke="var(--color-surge)"
                  strokeWidth="2"
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {/* Subtle glow behind avatar */}
              <circle
                r={avatarSize / 2 + 2}
                fill={player.avatarColor}
                opacity="0.15"
                filter="url(#avatarGlow)"
              />

              {/* Avatar circle with player color */}
              <circle
                r={avatarSize / 2}
                fill={player.avatarColor}
                stroke={isWinner ? "var(--color-surge)" : "var(--color-surface)"}
                strokeWidth="2.5"
              />

              {/* Player initials */}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={avatarSize * 0.38}
                fontWeight="bold"
                fontFamily="var(--font-display)"
              >
                {player.name.slice(0, 2).toUpperCase()}
              </text>

              {/* Name label below */}
              <text
                y={avatarSize / 2 + 14}
                textAnchor="middle"
                fill={isWinner ? "var(--color-surge)" : "var(--color-text-muted)"}
                fontSize="11"
                fontWeight="600"
                fontFamily="var(--font-display)"
              >
                {player.name} ({pos})
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
});
