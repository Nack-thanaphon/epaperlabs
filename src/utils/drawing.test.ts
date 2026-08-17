import { describe, expect, it } from 'vitest'
import { EXPORT_MAX_EDGE, PAPER_HEIGHT, PAPER_WIDTH } from '../constants'
import { contentBounds, exportFrame } from './drawing'
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
