import { describe, expect, it } from 'vitest'
import { EXPORT_SCALE, PAPER_HEIGHT, PAPER_WIDTH } from '../constants'

describe('handwriting export performance budget', () => {
  it('stays at or below four megapixels for iPad reliability', () => {
    expect(PAPER_WIDTH * EXPORT_SCALE * PAPER_HEIGHT * EXPORT_SCALE).toBeLessThanOrEqual(4_000_000)
  })
})
