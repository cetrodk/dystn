import { useMemo } from "react";
import { strokeToPath } from "./strokePath";
import { VIEWBOX_WIDTH, type Stroke } from "./DrawingCanvas";

interface DrawingData {
  strokes: Stroke[];
  viewBoxHeight: number;
}

interface Props {
  /** Accepts either the new { strokes, viewBoxHeight } format or a raw strokes array */
  data: DrawingData | Stroke[];
  className?: string;
}

export function DrawingDisplay({ data, className = "" }: Props) {
  const strokes = Array.isArray(data) ? data : data.strokes;
  const viewBoxHeight = Array.isArray(data) ? 300 : (data.viewBoxHeight ?? 300);

  const paths = useMemo(
    () => strokes.map((stroke) => ({
      d: strokeToPath(stroke),
      color: stroke.color,
    })),
    [strokes],
  );

  return (
    <div
      className={`rounded-xl bg-[var(--color-surface)] aspect-[4/3] ${className}`}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        {paths.map((path, i) => (
          <path key={i} d={path.d} fill={path.color} />
        ))}
      </svg>
    </div>
  );
}
