import getStroke from "perfect-freehand";
import type { Stroke } from "./DrawingCanvas";

const average = (a: number, b: number) => (a + b) / 2;

export function getSvgPathFromStroke(points: number[][]): string {
  const len = points.length;
  if (len < 4) return "";

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }

  result += "Z";
  return result;
}

const STROKE_OPTIONS = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
};

export function strokeToPath(stroke: Stroke): string {
  const outline = getStroke(stroke.points, { ...STROKE_OPTIONS, size: stroke.size });
  return getSvgPathFromStroke(outline);
}
