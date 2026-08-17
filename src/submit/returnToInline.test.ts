// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { returnToInlineMode } from './returnToInline'

afterEach(() => {
  delete window.openai
})

describe('returnToInlineMode', () => {
  it('requests inline mode and does not call requestClose', async () => {
    const requestDisplayMode = vi.fn(async () => {
      window.openai!.displayMode = 'inline'
    })
    const requestClose = vi.fn()
    window.openai = {
      requestDisplayMode,
      requestClose,
      displayMode: 'fullscreen',
    }
    await returnToInlineMode()
    expect(requestDisplayMode).toHaveBeenCalledWith({ mode: 'inline' })
    expect(requestClose).not.toHaveBeenCalled()
  })
})
