import getStroke from 'perfect-freehand'
import { EXPORT_MAX_EDGE, EXPORT_PADDING, EXPORT_SCALE, GRID_STEP, PAPER_HEIGHT, PAPER_WIDTH } from '../constants'
import type { Point, Stroke, Viewport } from '../types'

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function average(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, pressure: (a.pressure + b.pressure) / 2 }
}

export function zoomPercent(scale: number) {
  return Math.round(scale * 100)
}

/** Keep ~0.5 CSS-pixel spacing so zoomed strokes stay connected. */
export function minPointSpacing(scale: number) {
  return Math.max(0.2, 0.5 / Math.max(0.3, scale))
}

export function getSvgPathFromStroke(points: number[][]) {
  if (points.length < 4) return ''
  const len = points.length
  const a = points[0]
  const b = points[1]
  const c = points[2]
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(
    { x: b[0], y: b[1], pressure: 0 },
    { x: c[0], y: c[1], pressure: 0 }
  ).x.toFixed(2)},${average(
    { x: b[0], y: b[1], pressure: 0 },
    { x: c[0], y: c[1], pressure: 0 }
  ).y.toFixed(2)} T`

  for (let i = 2; i < len - 1; i++) {
    const p = points[i]
    const n = points[i + 1]
    result += `${((p[0] + n[0]) / 2).toFixed(2)},${((p[1] + n[1]) / 2).toFixed(2)} `
  }
  result += 'Z'
  return result
}

export function screenToPaperFromRect(rect: DOMRectReadOnly, viewport: Viewport, clientX: number, clientY: number): Point {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale,
    pressure: 0.5,
  }
}

export function screenToPaper(canvas: HTMLCanvasElement, viewport: Viewport, clientX: number, clientY: number): Point {
  return screenToPaperFromRect(canvas.getBoundingClientRect(), viewport, clientX, clientY)
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function freehandOptions(scale = 1, live = false) {
  const zoomBoost = Math.min(0.2, Math.max(0, (scale - 1) * 0.08))
  return {
    thinning: live ? 0.35 : 0.45,
    smoothing: Math.min(0.8, (live ? 0.65 : 0.6) + zoomBoost),
    streamline: Math.min(0.8, (live ? 0.65 : 0.58) + zoomBoost),
    simulatePressure: true,
    last: !live,
    start: { taper: 0, cap: true },
    end: { taper: live ? 0 : 4, cap: true },
  }
}

/** Polyline through every sample — never skips gaps like midpoint curves can. */
export function tracePolylineStroke(
  ctx: CanvasRenderingContext2D | Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'beginPath'>,
  points: Point[],
) {
  if (points.length === 0) return false
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  return true
}

/** Midpoint quadratic for exports / soft committed ink. */
export function traceQuadraticStroke(
  ctx: CanvasRenderingContext2D | Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'beginPath'>,
  points: Point[],
) {
  if (points.length === 0) return false
  if (points.length < 3) return tracePolylineStroke(ctx, points)
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  return true
}

function drawInkStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = Math.max(stroke.size, 1)
  if (stroke.points.length === 1) {
    const p = stroke.points[0]
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(stroke.size, 1) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  if (!tracePolylineStroke(ctx, stroke.points)) return
  ctx.stroke()
}

function drawFreehandStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number) {
  if (stroke.points.length < 3) {
    drawInkStroke(ctx, stroke)
    return
  }
  const opts = freehandOptions(scale, false)
  const outline = getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: stroke.size,
      thinning: opts.thinning,
      smoothing: opts.smoothing,
      streamline: opts.streamline,
      simulatePressure: opts.simulatePressure,
      last: opts.last,
      start: opts.start,
      end: opts.end,
    }
  )
  const path = getSvgPathFromStroke(outline)
  if (!path) {
    drawInkStroke(ctx, stroke)
    return
  }
  ctx.fillStyle = stroke.color
  ctx.fill(new Path2D(path))
}

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  options?: { scale?: number; freehand?: boolean },
) {
  if (stroke.points.length === 0) return
  if (options?.freehand) {
    drawFreehandStroke(ctx, stroke, options.scale ?? 1)
    return
  }
  drawInkStroke(ctx, stroke)
}

interface CachedStrokePath {
  points: number
  color: string
  size: number
  path: Path2D
}

export interface PaperCache {
  paths: Map<string, CachedStrokePath>
}

export function createPaperCache(): PaperCache {
  return { paths: new Map() }
}

function buildPolylinePath(points: Point[]): Path2D {
  const path = new Path2D()
  path.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x, points[i].y)
  }
  return path
}

function syncStrokePaths(cache: PaperCache, strokes: Stroke[]) {
  const seen = new Set<string>()
  for (const stroke of strokes) {
    seen.add(stroke.id)
    const existing = cache.paths.get(stroke.id)
    if (
      existing
      && existing.points === stroke.points.length
      && existing.color === stroke.color
      && existing.size === stroke.size
    ) {
      continue
    }
    if (stroke.points.length === 0) continue
    cache.paths.set(stroke.id, {
      points: stroke.points.length,
      color: stroke.color,
      size: stroke.size,
      path: buildPolylinePath(stroke.points),
    })
  }
  for (const id of cache.paths.keys()) {
    if (!seen.has(id)) cache.paths.delete(id)
  }
}

function drawPaperGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#f1f5f9'
  ctx.lineWidth = 1
  for (let x = GRID_STEP; x < PAPER_WIDTH; x += GRID_STEP) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, PAPER_HEIGHT)
    ctx.stroke()
  }
  for (let y = GRID_STEP; y < PAPER_HEIGHT; y += GRID_STEP) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(PAPER_WIDTH, y)
    ctx.stroke()
  }
}

function applyPaperTransform(ctx: CanvasRenderingContext2D, dpr: number, viewport: Viewport) {
  ctx.setTransform(
    dpr * viewport.scale,
    0,
    0,
    dpr * viewport.scale,
    dpr * viewport.x,
    dpr * viewport.y
  )
}

function paintCachedStroke(ctx: CanvasRenderingContext2D, cached: CachedStrokePath) {
  ctx.strokeStyle = cached.color
  ctx.fillStyle = cached.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(cached.size, 1)
  if (cached.points === 1) {
    // Path is a degenerate move; draw a dot from cache metadata is awkward — caller uses drawInkStroke for live.
    ctx.stroke(cached.path)
    return
  }
  ctx.stroke(cached.path)
}

export function redrawPaper(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  strokes: Stroke[],
  lassoPath: Point[] = [],
  cache?: PaperCache,
  liveStrokeId: string | null = null,
  screenRect?: DOMRectReadOnly | null,
) {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return

  const rect = screenRect ?? canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.floor(rect.width * dpr))
  const height = Math.max(1, Math.floor(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const live = liveStrokeId && strokes.at(-1)?.id === liveStrokeId ? strokes.at(-1) : null
  const committed = live ? strokes.slice(0, -1) : strokes

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  applyPaperTransform(ctx, dpr, viewport)

  if (cache && typeof Path2D !== 'undefined') {
    syncStrokePaths(cache, committed)
    for (const stroke of committed) {
      const cached = cache.paths.get(stroke.id)
      if (!cached) {
        drawInkStroke(ctx, stroke)
        continue
      }
      if (stroke.points.length === 1) {
        drawInkStroke(ctx, stroke)
        continue
      }
      paintCachedStroke(ctx, cached)
    }
  } else {
    for (const stroke of committed) drawInkStroke(ctx, stroke)
  }
  if (live) drawInkStroke(ctx, live)

  if (lassoPath.length >= 2) {
    ctx.save()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 3 / Math.max(0.3, viewport.scale)
    ctx.setLineDash([14 / viewport.scale, 10 / viewport.scale])
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (!tracePolylineStroke(ctx, lassoPath)) {
      ctx.restore()
      return
    }
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }
}

export function contentBounds(strokes: Stroke[], padding = EXPORT_PADDING) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      const radius = stroke.size / 2
      minX = Math.min(minX, point.x - radius)
      minY = Math.min(minY, point.y - radius)
      maxX = Math.max(maxX, point.x + radius)
      maxY = Math.max(maxY, point.y + radius)
    }
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: PAPER_WIDTH, height: PAPER_HEIGHT }
  }
  const x = Math.max(0, Math.floor(minX - padding))
  const y = Math.max(0, Math.floor(minY - padding))
  const right = Math.min(PAPER_WIDTH, Math.ceil(maxX + padding))
  const bottom = Math.min(PAPER_HEIGHT, Math.ceil(maxY + padding))
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}

export function exportFrame(strokes: Stroke[], maxEdge = EXPORT_MAX_EDGE) {
  const bounds = contentBounds(strokes)
  const longest = Math.max(bounds.width, bounds.height)
  const scale = Math.min(EXPORT_SCALE, maxEdge / longest)
  return {
    ...bounds,
    scale,
    outputWidth: Math.max(1, Math.round(bounds.width * scale)),
    outputHeight: Math.max(1, Math.round(bounds.height * scale)),
  }
}

export async function exportPaperBlob(strokes: Stroke[]) {
  const frame = exportFrame(strokes)
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = frame.outputWidth
  exportCanvas.height = frame.outputHeight
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) throw new Error('No canvas context')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.setTransform(frame.scale, 0, 0, frame.scale, -frame.x * frame.scale, -frame.y * frame.scale)
  drawPaperGrid(ctx)
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
  for (const stroke of strokes) drawStrokePath(ctx, stroke, { scale: frame.scale, freehand: true })
  return new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png')
  })
}
