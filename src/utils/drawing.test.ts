import { describe, expect, it } from 'vitest'
import { EXPORT_MAX_EDGE, PAPER_HEIGHT, PAPER_WIDTH } from '../constants'
import { contentBounds, exportFrame, freehandOptions, minPointSpacing, traceQuadraticStroke, zoomPercent } from './drawing'
import type { Stroke } from '../types'

const stroke = (points: Array<[number, number]>, size = 8): Stroke => ({
  id: 's',
  color: '#111827',
  size,
  points: points.map(([x, y]) => ({ x, y, pressure: 0.5 })),
})

describe('handwriting export crop', () => {
  it('pads the stroke bounding box and stays on the paper', () => {
    const bounds = contentBounds([stroke([[100, 100], [140, 120]])], 80)
    expect(bounds.x).toBe(16)
    expect(bounds.y).toBe(16)
    expect(bounds.width).toBeLessThan(PAPER_WIDTH)
    expect(bounds.height).toBeLessThan(PAPER_HEIGHT)
  })

  it('caps the longest edge while preserving aspect ratio', () => {
    const frame = exportFrame([stroke([[0, 0], [PAPER_WIDTH, PAPER_HEIGHT]])], EXPORT_MAX_EDGE)
    expect(Math.max(frame.outputWidth, frame.outputHeight)).toBeLessThanOrEqual(EXPORT_MAX_EDGE)
    expect(frame.outputWidth / frame.outputHeight).toBeCloseTo(frame.width / frame.height, 2)
  })
})

describe('zoomPercent', () => {
  it('shows the current viewport scale as a percent', () => {
    expect(zoomPercent(0.75)).toBe(75)
    expect(zoomPercent(1)).toBe(100)
    expect(zoomPercent(1.33)).toBe(133)
  })
})

describe('stroke smoothness helpers', () => {
  it('tightens point spacing as zoom increases', () => {
    expect(minPointSpacing(3)).toBeLessThan(minPointSpacing(0.75))
    expect(minPointSpacing(3)).toBeCloseTo(0.65 / 3, 5)
  })

  it('boosts freehand smoothing when zoomed in', () => {
    const normal = freehandOptions(0.75)
    const zoomed = freehandOptions(3)
    expect(zoomed.smoothing).toBeGreaterThan(normal.smoothing)
    expect(zoomed.streamline).toBeGreaterThan(normal.streamline)
  })

  it('builds a quadratic path for live curved ink', () => {
    const calls: string[] = []
    const ctx = {
      beginPath: () => calls.push('begin'),
      moveTo: () => calls.push('move'),
      lineTo: () => calls.push('line'),
      quadraticCurveTo: () => calls.push('quad'),
    }
    expect(traceQuadraticStroke(ctx, [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 10, y: 0, pressure: 0.5 },
      { x: 20, y: 10, pressure: 0.5 },
    ])).toBe(true)
    expect(calls).toEqual(['begin', 'move', 'quad', 'line'])
  })
})
