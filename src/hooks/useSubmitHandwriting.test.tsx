// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSubmitHandwriting } from './useSubmitHandwriting'
import type { Stroke } from '../types'

const stroke: Stroke = {
  id: 'active',
  color: '#111827',
  size: 7,
  points: [{ x: 1, y: 1, pressure: 0.5 }],
}

describe('useSubmitHandwriting input handoff', () => {
  it('cancels captured input synchronously before checking and exporting strokes', async () => {
    const strokesRef = { current: [stroke] }
    const beforeSubmit = vi.fn(() => { strokesRef.current = [] })
    const exportBlob = vi.fn(async () => new Blob(['ink'], { type: 'image/png' }))
    const { result } = renderHook(() => useSubmitHandwriting({
      strokesRef,
      exportBlob,
      beforeSubmit,
    }))

    await act(async () => { await result.current.handleSubmit() })

    expect(beforeSubmit).toHaveBeenCalledTimes(1)
    expect(exportBlob).not.toHaveBeenCalled()
    expect(result.current.status).toBe('empty')
  })
})
