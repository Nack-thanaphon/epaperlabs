import React, { type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { BottomBar } from './components/BottomBar'
import { DrawingBoard } from './components/DrawingBoard'
import { FloatingTools } from './components/FloatingTools'
import { FullscreenGate } from './components/FullscreenGate'
import { ProblemPanel } from './components/ProblemPanel'
import { useOpenAiHost } from './hooks/useOpenAiHost'
import { useSubmitHandwriting } from './hooks/useSubmitHandwriting'
import { useWhiteboard } from './hooks/useWhiteboard'
import './styles.css'

function App() {
  const { problem, writingReady, safeArea, requestFullscreen } = useOpenAiHost()
  const board = useWhiteboard(writingReady)
  const { status, statusText, isSubmitting, isBoardLocked, handleSubmit } = useSubmitHandwriting({
    strokesRef: board.strokesRef,
    exportBlob: board.exportBlob,
    beforeSubmit: board.cancelInput,
  })
  const expand = () => void requestFullscreen()

  return (
    <div
      className={`appShell ${writingReady ? 'writingMode' : 'inlineMode'}`}
      style={{
        '--host-safe-top': `${safeArea.top}px`,
        '--host-safe-right': `${safeArea.right}px`,
        '--host-safe-bottom': `${safeArea.bottom}px`,
        '--host-safe-left': `${safeArea.left}px`,
      } as CSSProperties}
    >
      {!writingReady ? <FullscreenGate compact onExpand={expand} /> : <>
      <ProblemPanel problem={problem} />
      <DrawingBoard
        canvasRef={board.canvasRef}
        tool={board.tool}
        writingReady={writingReady}
        inputLocked={isBoardLocked}
        onPointerDown={board.onPointerDown}
        onPointerMove={board.onPointerMove}
        onPointerUp={board.endPointer}
        onPointerCancel={board.cancelPointer}
        onGestureBlock={board.blockCanvasGesture}
        onExpand={expand}
      />
      <div className="bottomControls">
        <FloatingTools
          tool={board.tool}
          color={board.color}
          size={board.size}
          viewport={board.viewport}
          onToolChange={board.setTool}
          onColorChange={board.setColor}
          onSizeChange={board.setSize}
          onZoom={board.setZoom}
        />
        <BottomBar
          status={status}
          isSubmitting={isSubmitting}
          mutationLocked={isBoardLocked}
          statusText={statusText}
          canUndo={board.canUndo}
          canRedo={board.canRedo}
          onUndo={board.undo}
          onRedo={board.redo}
          onClear={board.clearBoard}
          onSubmit={handleSubmit}
        />
      </div>
      </>}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
