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
  pointerType: 'pen' | 'mouse' = 'pen',
) {
  return {
    pointerId,
    pointerType,
    button: 0,
    isPrimary: true,
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
})
