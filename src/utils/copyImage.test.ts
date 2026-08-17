import { describe, expect, it, vi } from 'vitest'
import { copyImage, copyImageBlob } from './copyImage'
import { COPY_MAX_BYTES, COPY_MAX_EDGE } from '../constants'

describe('copy image budget', () => {
  it('keeps paste copies at or below 700KB and 1024px', () => {
    expect(COPY_MAX_BYTES).toBe(700 * 1024)
    expect(COPY_MAX_EDGE).toBe(1024)
  })
})

describe('copyImage', () => {
  it('writes PNG to the clipboard before the blob finishes encoding', async () => {
    const write = vi.fn(async () => undefined)
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob | Promise<Blob>>) {}
    })
    vi.stubGlobal('navigator', {
      clipboard: { write },
    })

    let resolveBlob!: (blob: Blob) => void
    const pending = new Promise<Blob>((resolve) => {
      resolveBlob = resolve
    })

    const copyPromise = copyImage(() => pending)
    expect(write).toHaveBeenCalledTimes(1)
    const [items] = write.mock.calls[0] as unknown as [Array<{ items: Record<string, Promise<Blob>> }>]
    expect(items[0]?.items['image/png']).toBeInstanceOf(Promise)

    resolveBlob(new Blob(['png'], { type: 'image/png' }))
    await expect(copyPromise).resolves.toBe('copied')
    vi.unstubAllGlobals()
  })

  it('writes a PNG ClipboardItem for ChatGPT paste', async () => {
    const write = vi.fn(async () => undefined)
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })
    vi.stubGlobal('navigator', {
      clipboard: { write },
    })
    const blob = new Blob(['png'], { type: 'image/png' })
    await expect(copyImageBlob(blob)).resolves.toBe('copied')
    expect(write).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
