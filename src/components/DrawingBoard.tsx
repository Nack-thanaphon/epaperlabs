import type { PointerEvent, RefObject, TouchEvent, WheelEvent } from 'react'
import type { Tool } from '../types'
import { FullscreenGate } from './FullscreenGate'

interface DrawingBoardProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  tool: Tool
  writingReady: boolean
  inputLocked: boolean
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLCanvasElement>) => void
  onGestureBlock: (event: TouchEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>) => void
  onExpand: () => void
}

export function DrawingBoard({
  canvasRef,
  tool,
  writingReady,
  inputLocked,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onGestureBlock,
  onExpand,
}: DrawingBoardProps) {
  return (
    <div className="boardWrap">
      <canvas
        ref={canvasRef}
        className={`paperCanvas tool-${tool} ${writingReady && !inputLocked ? '' : 'locked'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onTouchStart={onGestureBlock}
        onTouchMove={onGestureBlock}
        onTouchEnd={onGestureBlock}
        onWheel={onGestureBlock}
      />
      {!writingReady && <FullscreenGate onExpand={onExpand} />}
    </div>
  )
}
