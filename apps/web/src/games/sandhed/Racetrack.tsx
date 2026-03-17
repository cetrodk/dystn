import { memo, useMemo } from "react";
import { motion } from "framer-motion";

export const FINISH_LINE = 8;

// Track dimensions within the SVG viewBox
const SVG_WIDTH = 900;
const SVG_HEIGHT = 200;
const TRACK_START_X = 50;
const TRACK_END_X = 850;
const TRACK_WIDTH = TRACK_END_X - TRACK_START_X;

// Generate a gentle wave path between start and end
function buildTrackPath(yCenter: number): string {
  const amplitude = 25;
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
// Uses a temporary SVG path element for accurate positioning
function samplePath(pathD: string, fraction: number): { x: number; y: number } {
  if (typeof document === "undefined") return { x: TRACK_START_X + fraction * TRACK_WIDTH, y: 100 };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const totalLength = path.getTotalLength();
  const point = path.getPointAtLength(fraction * totalLength);
  document.body.removeChild(svg);
  return { x: point.x, y: point.y };
}

interface RacetrackPlayer {
  _id: string;
  name: string;
  avatarColor: string;
  avatarImage?: string;
}

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
    const spread = Math.min(players.length * 12, 60);
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
    <div className="w-full max-w-5xl">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ height: Math.max(140, 100 + players.length * 14) }}
      >
        {/* Track lane lines */}
        {lanes.map((d, i) => (
          <path
            key={`lane-${i}`}
            d={d}
            fill="none"
            stroke="var(--color-surface-light)"
            strokeWidth="2"
            strokeDasharray="8 6"
            opacity="0.35"
          />
        ))}

        {/* Position markers */}
        {Array.from({ length: FINISH_LINE + 1 }, (_, i) => {
          const x = TRACK_START_X + (i / FINISH_LINE) * TRACK_WIDTH;
          return (
            <g key={`marker-${i}`}>
              <line
                x1={x}
                y1={20}
                x2={x}
                y2={SVG_HEIGHT - 20}
                stroke="var(--color-text-muted)"
                strokeWidth="1"
                opacity="0.1"
              />
              {i > 0 && i < FINISH_LINE && (
                <text
                  x={x}
                  y={SVG_HEIGHT - 5}
                  textAnchor="middle"
                  fill="var(--color-text-muted)"
                  fontSize="10"
                  opacity="0.25"
                >
                  {i}
                </text>
              )}
            </g>
          );
        })}

        {/* Start line */}
        <line
          x1={TRACK_START_X}
          y1={15}
          x2={TRACK_START_X}
          y2={SVG_HEIGHT - 15}
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          opacity="0.25"
        />

        {/* Finish line */}
        <line
          x1={TRACK_END_X}
          y1={15}
          x2={TRACK_END_X}
          y2={SVG_HEIGHT - 15}
          stroke="var(--color-sandhed)"
          strokeWidth="3"
          opacity="0.8"
        />
        <text
          x={TRACK_END_X}
          y={10}
          textAnchor="middle"
          fill="var(--color-sandhed)"
          fontSize="11"
          fontWeight="bold"
          opacity="0.7"
        >
          MÅL
        </text>

        {/* Player avatars — rendered inside SVG so coordinates match exactly */}
        {playerPoints.map(({ player, point, pos, laneIndex }) => {
          const isWinner = winners?.includes(player._id);
          const avatarSize = isWinner ? 36 : 28;

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
              {/* Winner glow */}
              {isWinner && (
                <circle
                  r={avatarSize / 2 + 4}
                  fill="none"
                  stroke="var(--color-sandhed)"
                  strokeWidth="2"
                  opacity="0.6"
                />
              )}

              {/* Avatar circle with player color */}
              <circle
                r={avatarSize / 2}
                fill={player.avatarColor}
                stroke={isWinner ? "var(--color-sandhed)" : "var(--color-surface)"}
                strokeWidth="2"
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
                y={avatarSize / 2 + 12}
                textAnchor="middle"
                fill={isWinner ? "var(--color-sandhed)" : "var(--color-text-muted)"}
                fontSize="9"
                fontWeight="600"
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
