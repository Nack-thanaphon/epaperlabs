import getStroke from 'perfect-freehand'
import { EXPORT_MAX_EDGE, EXPORT_PADDING, EXPORT_SCALE, GRID_STEP, PAPER_HEIGHT, PAPER_WIDTH } from '../constants'
import type { Point, Stroke, Viewport } from '../types'

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function average(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, pressure: (a.pressure + b.pressure) / 2 }
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

export function screenToPaper(canvas: HTMLCanvasElement, viewport: Viewport, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale,
    pressure: 0.5,
  }
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function drawStrokePath(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return

  if (stroke.points.length === 1) {
    const p = stroke.points[0]
    ctx.fillStyle = stroke.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const outline = getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: stroke.size,
      thinning: 0.4,
      smoothing: 0.65,
      streamline: 0.55,
      simulatePressure: true,
      start: { taper: 0, cap: true },
      end: { taper: 8, cap: true },
    }
  )

  const path = getSvgPathFromStroke(outline)
  if (!path) return
  ctx.fillStyle = stroke.color
  ctx.fill(new Path2D(path))
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

export function redrawPaper(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  strokes: Stroke[],
  lassoPath: Point[] = [],
  predicted: Point[] = [],
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.floor(rect.width * dpr))
  const height = Math.max(1, Math.floor(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.setTransform(
    dpr * viewport.scale,
    0,
    0,
    dpr * viewport.scale,
    dpr * viewport.x,
    dpr * viewport.y
  )

  const liveId = predicted.length > 0 ? strokes.at(-1)?.id : null
  for (const stroke of strokes) {
    if (stroke.id === liveId) {
      drawStrokePath(ctx, { ...stroke, points: [...stroke.points, ...predicted] })
    } else {
      drawStrokePath(ctx, stroke)
    }
  }
  if (lassoPath.length >= 2) {
    ctx.save()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 3
    ctx.setLineDash([14, 10])
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(lassoPath[0].x, lassoPath[0].y)
    for (let i = 1; i < lassoPath.length; i += 1) {
      ctx.lineTo(lassoPath[i].x, lassoPath[i].y)
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
  for (const stroke of strokes) drawStrokePath(ctx, stroke)
  return new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png')
  })
}
