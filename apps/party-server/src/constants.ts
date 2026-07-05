/** Sentinel ID for the real/truth answer in vote lists */
export const TRUTH_ID = "__TRUTH__";

/** Caps on drawing submissions — raw strokes are persisted in DO storage and
 * fanned out in every broadcast, so an unbounded payload multiplies fast. */
export const MAX_STROKES = 400;
export const MAX_DRAWING_BYTES = 300_000;
