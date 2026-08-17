// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useWhiteboard } from './useWhiteboard'

function pointer(
  pointerId: number,
  type: 'pointerdown' | 'pointermove',
  x: number,
  y: number,
  pointerType: 'pen' | 'mouse' | 'touch' = 'pen',
  isPrimary = true,
) {
  return {
    pointerId,
    pointerType,
    button: 0,
    isPrimary,
    clientX: x,
    clientY: y,
    pressure: 0.6,
    movementX: type === 'pointermove' ? 5 : 0,
    movementY: type === 'pointermove' ? 5 : 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ReactPointerEvent<HTMLCanvasElement>
}

describe('useWhiteboard captured-pointer cancellation', () => {
  it('rolls back an active stroke and ignores later captured moves before Submit export', () => {
    const { result } = renderHook(() => useWhiteboard(true))
    const canvas = document.createElement('canvas')
    Object.defineProperties(canvas, {
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
      getContext: { value: () => null },
      setPointerCapture: { value: vi.fn() },
    })
    result.current.canvasRef.current = canvas

    act(() => { result.current.onPointerDown(pointer(7, 'pointerdown', 40, 40)) })
    expect(result.current.strokesRef.current).toHaveLength(1)

    act(() => { result.current.cancelInput() })
    expect(result.current.strokesRef.current).toHaveLength(0)

    act(() => { result.current.onPointerMove(pointer(7, 'pointermove', 80, 80)) })
    expect(result.current.strokesRef.current).toHaveLength(0)
  })

  it('does not add ink when lassoing — copy is image-only', () => {
    const { result } = renderHook(() => useWhiteboard(true))
    const canvas = document.createElement('canvas')
    Object.defineProperties(canvas, {
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
      getContext: { value: () => null },
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => false },
      releasePointerCapture: { value: vi.fn() },
    })
    result.current.canvasRef.current = canvas

    act(() => { result.current.setTool('lasso') })
    act(() => { result.current.onPointerDown(pointer(3, 'pointerdown', 40, 40)) })
    act(() => { result.current.onPointerMove(pointer(3, 'pointermove', 120, 40)) })
    act(() => { result.current.onPointerMove(pointer(3, 'pointermove', 120, 120)) })
    act(() => { result.current.setTool('rect') })
    act(() => { result.current.onPointerDown(pointer(4, 'pointerdown', 40, 40)) })
    act(() => { result.current.onPointerMove(pointer(4, 'pointermove', 200, 160)) })
    expect(result.current.strokesRef.current).toHaveLength(0)
  })

  it('draws with a Mac mouse', () => {
    const { result } = renderHook(() => useWhiteboard(true))
    const canvas = document.createElement('canvas')
    Object.defineProperties(canvas, {
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
      getContext: { value: () => null },
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => false },
      releasePointerCapture: { value: vi.fn() },
    })
    result.current.canvasRef.current = canvas

    act(() => { result.current.onPointerDown(pointer(1, 'pointerdown', 40, 40, 'mouse')) })
    act(() => { result.current.onPointerMove(pointer(1, 'pointermove', 80, 80, 'mouse')) })
    expect(result.current.strokesRef.current).toHaveLength(1)
    expect(result.current.strokesRef.current[0].points.length).toBeGreaterThan(1)
  })

  it('zooms when a second non-primary finger pinches', () => {
    const { result } = renderHook(() => useWhiteboard(true))
    const canvas = document.createElement('canvas')
    Object.defineProperties(canvas, {
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
      getContext: { value: () => null },
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => false },
      releasePointerCapture: { value: vi.fn() },
    })
    result.current.canvasRef.current = canvas

    act(() => { result.current.onPointerDown(pointer(1, 'pointerdown', 40, 40, 'touch', true)) })
    act(() => { result.current.onPointerDown(pointer(2, 'pointerdown', 140, 40, 'touch', false)) })
    act(() => { result.current.onPointerMove(pointer(2, 'pointermove', 240, 40, 'touch', false)) })
    expect(result.current.viewport.scale).toBeGreaterThan(0.75)
  })

  it('returns to draw if lasso or rect stays still for 4 seconds', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWhiteboard(true))

    act(() => { result.current.setTool('lasso') })
    expect(result.current.tool).toBe('lasso')
    act(() => { vi.advanceTimersByTime(3999) })
    expect(result.current.tool).toBe('lasso')
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.tool).toBe('pen')

    act(() => { result.current.setTool('rect') })
    act(() => { vi.advanceTimersByTime(4000) })
    expect(result.current.tool).toBe('pen')
    vi.useRealTimers()
  })

  it('keeps lasso while the pointer is still moving', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWhiteboard(true))
    const canvas = document.createElement('canvas')
    Object.defineProperties(canvas, {
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
      getContext: { value: () => null },
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => false },
      releasePointerCapture: { value: vi.fn() },
    })
    result.current.canvasRef.current = canvas

    act(() => { result.current.setTool('lasso') })
    act(() => { result.current.onPointerDown(pointer(8, 'pointerdown', 40, 40)) })
    act(() => { vi.advanceTimersByTime(3000) })
    act(() => { result.current.onPointerMove(pointer(8, 'pointermove', 120, 80)) })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.tool).toBe('lasso')
    vi.useRealTimers()
  })
})
