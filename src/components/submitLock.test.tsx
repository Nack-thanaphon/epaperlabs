// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar } from './BottomBar'
import { DrawingBoard } from './DrawingBoard'

describe('immutable Submit retry snapshot', () => {
  it('locks board mutations after failure while keeping Retry available', () => {
    render(<>
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
        onExpand={vi.fn()}
      />
      <BottomBar
        status="failed"
        isSubmitting={false}
        mutationLocked
        statusText="อัปโหลดไม่สำเร็จ — งานเดิมยังอยู่"
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClear={vi.fn()}
        onSubmit={vi.fn()}
      />
    </>)

    expect(document.querySelector('canvas')?.classList.contains('locked')).toBe(true)
    expect((screen.getByRole('button', { name: /ย้อนกลับ/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /ทำซ้ำ/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'ล้าง' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /อัปโหลดไม่สำเร็จ/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})
