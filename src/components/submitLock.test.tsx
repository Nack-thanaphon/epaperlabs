// @vitest-environment jsdom
import { createRef } from 'react'
import { render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar } from './BottomBar'
import { DrawingBoard } from './DrawingBoard'

describe('whiteboard controls', () => {
  it('keeps undo redo and clear without a Submit button', () => {
    const { container } = render(<>
      <DrawingBoard
        canvasRef={createRef<HTMLCanvasElement>()}
        tool="pen"
        writingReady
        inputLocked={false}
        onPointerDown={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerUp={vi.fn()}
        onPointerCancel={vi.fn()}
        onGestureBlock={vi.fn()}
      />
      <BottomBar
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClear={vi.fn()}
      />
    </>)
    const view = within(container)

    expect(container.querySelector('canvas')?.classList.contains('locked')).toBe(false)
    expect(view.getByRole('button', { name: /ย้อนกลับ/ })).toBeTruthy()
    expect(view.getByRole('button', { name: 'ล้าง' })).toBeTruthy()
    expect(view.queryByRole('button', { name: /Submit|กำลัง/ })).toBeNull()
  })
})
