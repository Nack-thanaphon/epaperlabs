import { describe, expect, it, vi } from 'vitest'
import { copyPngBlob } from './copyImage'

describe('copyPngBlob', () => {
  it('writes a PNG to the clipboard when the host allows it', async () => {
    const write = vi.fn(async () => undefined)
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })
    vi.stubGlobal('navigator', {
      clipboard: { write },
    })
    const blob = new Blob(['png'], { type: 'image/png' })
    await expect(copyPngBlob(blob)).resolves.toBe('copied')
    expect(write).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
