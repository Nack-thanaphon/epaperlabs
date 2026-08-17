import { describe, expect, it } from 'vitest'
import { EXPORT_MAX_EDGE, EXPORT_SCALE, PAPER_HEIGHT, PAPER_WIDTH } from '../constants'

describe('handwriting export performance budget', () => {
  it('stays at or below four megapixels for iPad reliability', () => {
    expect(PAPER_WIDTH * EXPORT_SCALE * PAPER_HEIGHT * EXPORT_SCALE).toBeLessThanOrEqual(4_000_000)
  })

  it('caps a cropped export at EXPORT_MAX_EDGE on the long side', () => {
    expect(EXPORT_MAX_EDGE * EXPORT_MAX_EDGE).toBeLessThanOrEqual(4_000_000)
  })
})
