import { COPY_MAX_EDGE, EXPORT_SCALE } from '../constants'
import type { Point, Stroke } from '../types'
import { encodeCopyBlob } from './copyImage'
import { drawStrokePath } from './drawing'

const LASSO_PADDING = 16
const MIN_LASSO_AREA = 400

export function pointInPolygon(point: { x: number; y: number }, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

export function lassoArea(polygon: Point[]): number {
  if (polygon.length < 3) return 0
  let sum = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function lassoBounds(polygon: Point[], padding = LASSO_PADDING) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  const x = Math.floor(minX - padding)
  const y = Math.floor(minY - padding)
  return {
    x,
    y,
    width: Math.max(1, Math.ceil(maxX + padding) - x),
    height: Math.max(1, Math.ceil(maxY + padding) - y),
  }
}

export function rectPolygon(a: Point, b: Point): Point[] {
  const left = Math.min(a.x, b.x)
  const right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const bottom = Math.max(a.y, b.y)
  return [
    { x: left, y: top, pressure: 0 },
    { x: right, y: top, pressure: 0 },
    { x: right, y: bottom, pressure: 0 },
    { x: left, y: bottom, pressure: 0 },
  ]
}

export function canExportLasso(polygon: Point[]): boolean {
  return polygon.length >= 3 && lassoArea(polygon) >= MIN_LASSO_AREA
}

export async function exportLassoBlob(strokes: Stroke[], polygon: Point[]): Promise<Blob> {
  if (!canExportLasso(polygon)) throw new Error('Lasso is too small')
  const bounds = lassoBounds(polygon)
  const longest = Math.max(bounds.width, bounds.height)
  const scale = Math.min(EXPORT_SCALE, COPY_MAX_EDGE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bounds.width * scale))
  canvas.height = Math.max(1, Math.round(bounds.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas context')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale)
  ctx.beginPath()
  ctx.moveTo(polygon[0].x, polygon[0].y)
  for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y)
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
  for (const stroke of strokes) drawStrokePath(ctx, stroke, { freehand: true })

  return encodeCopyBlob(canvas)
}
