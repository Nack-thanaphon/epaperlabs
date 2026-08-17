import { describe, expect, it } from 'vitest'
import { canExportLasso, lassoArea, lassoBounds, pointInPolygon, rectPolygon } from './lasso'
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

  it('builds a rectangle polygon from two corners', () => {
    const polygon = rectPolygon(
      { x: 80, y: 20, pressure: 0 },
      { x: 10, y: 60, pressure: 0 },
    )
    expect(polygon).toEqual([
      { x: 10, y: 20, pressure: 0 },
      { x: 80, y: 20, pressure: 0 },
      { x: 80, y: 60, pressure: 0 },
      { x: 10, y: 60, pressure: 0 },
    ])
    expect(canExportLasso(polygon)).toBe(true)
  })
})
