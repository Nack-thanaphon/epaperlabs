import { describe, expect, it, vi } from 'vitest'
import { copyImageBlob } from './copyImage'
import { COPY_MAX_BYTES, COPY_MAX_EDGE } from '../constants'

describe('copy image budget', () => {
  it('keeps paste copies at or below 700KB and 1024px', () => {
    expect(COPY_MAX_BYTES).toBe(700 * 1024)
    expect(COPY_MAX_EDGE).toBe(1024)
  })
})

describe('copyImageBlob', () => {
  it('writes the encoded image to the clipboard when the host allows it', async () => {
    const write = vi.fn(async () => undefined)
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })
    vi.stubGlobal('navigator', {
      clipboard: { write },
    })
    const blob = new Blob(['jpg'], { type: 'image/jpeg' })
    await expect(copyImageBlob(blob)).resolves.toBe('copied')
    expect(write).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
