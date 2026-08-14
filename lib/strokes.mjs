// Pure logic for stroke collection, manipulation, and serialization.
// No DOM dependencies — safe to import in Node.js tests.
// The HTML widget contains an identical inline copy for the sandboxed iframe.

/**
 * @typedef {{ x: number, y: number, pressure: number }} Point
 * @typedef {Point[]} Stroke
 * @typedef {Stroke[]} StrokeStore
 */

/** Create an empty stroke store (just an array, but explicit for clarity). */
export function createStore() {
  return [];
}

/** Start a new stroke and return its index in the store. */
export function beginStroke(store, point) {
  const stroke = [validatePoint(point)];
  store.push(stroke);
  return store.length - 1;
}

/** Append a point to the most recent stroke. */
export function addPoint(store, point) {
  if (store.length === 0) return;
  const last = store[store.length - 1];
  last.push(validatePoint(point));
}

/** Remove the last stroke (undo). Returns true if something was removed. */
export function undo(store) {
  if (store.length === 0) return false;
  store.pop();
  return true;
}

/** Remove all strokes (clear). */
export function clearStrokes(store) {
  store.length = 0;
}

/** Count strokes. */
export function strokeCount(store) {
  return store.length;
}

/** Count total points across all strokes. */
export function pointCount(store) {
  return store.reduce((sum, s) => sum + s.length, 0);
}

/**
 * Compute the bounding box of all points across all strokes.
 * Returns { minX, minY, maxX, maxY, width, height } or null if empty.
 */
export function getBoundingBox(store, padding = 0) {
  if (store.length === 0 || pointCount(store) === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of store) {
    for (const p of stroke) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: (maxX - minX) + padding * 2,
    height: (maxY - minY) + padding * 2,
  };
}

/** Serialize strokes to a compact JSON string. */
export function serializeStrokes(store) {
  return JSON.stringify(store);
}

/** Deserialize strokes from a JSON string. Returns a new store. */
export function deserializeStrokes(json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("Invalid strokes JSON: expected array");
  return parsed.map((stroke) => {
    if (!Array.isArray(stroke)) throw new Error("Invalid stroke: expected array of points");
    return stroke.map(validatePoint);
  });
}

/** Map a raw pressure value to a pixel width (1–6px range). */
export function pressureToWidth(pressure, min = 1.5, max = 5) {
  const p = Math.max(0, Math.min(1, pressure));
  return min + (max - min) * p;
}

// ─── internal ───

function validatePoint(p) {
  if (typeof p.x !== "number" || typeof p.y !== "number") {
    throw new Error(`Invalid point: x and y must be numbers, got ${JSON.stringify(p)}`);
  }
  return {
    x: p.x,
    y: p.y,
    pressure: typeof p.pressure === "number" ? Math.max(0, Math.min(1, p.pressure)) : 0.5,
  };
}
