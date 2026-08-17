import { describe, expect, it } from 'vitest'
import { canExportLasso, lassoArea, lassoBounds, pointInPolygon } from './lasso'
import type { Point } from '../types'

const square: Point[] = [
  { x: 0, y: 0, pressure: 0 },
  { x: 100, y: 0, pressure: 0 },
  { x: 100, y: 100, pressure: 0 },
  { x: 0, y: 100, pressure: 0 },
]

describe('lasso geometry', () => {
  it('detects points inside the polygon', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false)
  })

  it('rejects a tiny scribble', () => {
    const tiny: Point[] = [
      { x: 0, y: 0, pressure: 0 },
      { x: 4, y: 0, pressure: 0 },
      { x: 4, y: 4, pressure: 0 },
    ]
    expect(lassoArea(tiny)).toBeLessThan(400)
    expect(canExportLasso(tiny)).toBe(false)
    expect(canExportLasso(square)).toBe(true)
  })

  it('pads the lasso bounding box', () => {
    const bounds = lassoBounds(square, 10)
    expect(bounds.x).toBe(-10)
    expect(bounds.y).toBe(-10)
    expect(bounds.width).toBe(120)
    expect(bounds.height).toBe(120)
  })
})
