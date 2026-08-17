// @vitest-environment jsdom
import { createRef } from 'react'
import { render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar } from './BottomBar'
import { DrawingBoard } from './DrawingBoard'

describe('submit lock during in-flight stages', () => {
  it('locks board mutations while exporting and keeps Submit disabled', () => {
    const { container } = render(<>
      <DrawingBoard
        canvasRef={createRef<HTMLCanvasElement>()}
        tool="pen"
        writingReady
        inputLocked
        onPointerDown={vi.fn()}
        onPointerMove={vi.fn()}
        onPointerUp={vi.fn()}
        onPointerCancel={vi.fn()}
        onGestureBlock={vi.fn()}
      />
      <BottomBar
        status="exporting"
        isSubmitting
        mutationLocked
        statusText="กำลังเตรียมรูป…"
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClear={vi.fn()}
        onSubmit={vi.fn()}
        onReturnToHost={vi.fn()}
      />
    </>)
    const view = within(container)

    expect(container.querySelector('canvas')?.classList.contains('locked')).toBe(true)
    expect((view.getByRole('button', { name: /ย้อนกลับ/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((view.getByRole('button', { name: 'ล้าง' }) as HTMLButtonElement).disabled).toBe(true)
    expect((view.getByRole('button', { name: /กำลังเตรียมรูป/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('unlocks the board after a failed submit so the learner can edit', () => {
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
        status="failed"
        isSubmitting={false}
        mutationLocked={false}
        statusText="อัปโหลดไม่สำเร็จ — งานเดิมยังอยู่"
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClear={vi.fn()}
        onSubmit={vi.fn()}
        onReturnToHost={vi.fn()}
      />
    </>)
    const view = within(container)

    expect(container.querySelector('canvas')?.classList.contains('locked')).toBe(false)
    expect((view.getByRole('button', { name: /ย้อนกลับ/ }) as HTMLButtonElement).disabled).toBe(false)
    expect((view.getByRole('button', { name: /อัปโหลดไม่สำเร็จ/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})
