import React from 'react'
import { createRoot } from 'react-dom/client'
import { DrawingBoard } from './components/DrawingBoard'
import { Toolbar } from './components/Toolbar'
import { useWhiteboard } from './hooks/useWhiteboard'
import './styles.css'

function App() {
  const board = useWhiteboard(true)

  return (
    <div className="appShell">
      <DrawingBoard
        canvasRef={board.canvasRef}
        tool={board.tool}
        writingReady
        inputLocked={false}
        onPointerDown={board.onPointerDown}
        onPointerMove={board.onPointerMove}
        onPointerUp={board.endPointer}
        onPointerCancel={board.cancelPointer}
        onGestureBlock={board.blockCanvasGesture}
      />
      <Toolbar
        tool={board.tool}
        color={board.color}
        size={board.size}
        canUndo={board.canUndo}
        canRedo={board.canRedo}
        hint={board.lassoHint}
        zoomPercent={board.zoomPercent}
        onToolChange={board.setTool}
        onColorChange={board.setColor}
        onSizeChange={board.setSize}
        onUndo={board.undo}
        onRedo={board.redo}
        onClear={board.clearBoard}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
