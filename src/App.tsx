import React from 'react'
import { createRoot } from 'react-dom/client'
import { BottomBar } from './components/BottomBar'
import { DrawingBoard } from './components/DrawingBoard'
import { FloatingTools } from './components/FloatingTools'
import { useWhiteboard } from './hooks/useWhiteboard'
import './styles.css'

function App() {
  const board = useWhiteboard(true)

  return (
    <div className="appShell writingMode">
      <div className="bottomControls">
        <FloatingTools
          tool={board.tool}
          color={board.color}
          size={board.size}
          onToolChange={board.setTool}
          onColorChange={board.setColor}
          onSizeChange={board.setSize}
        />
        {board.lassoHint && <span className="lassoHint">{board.lassoHint}</span>}
        <BottomBar
          canUndo={board.canUndo}
          canRedo={board.canRedo}
          onUndo={board.undo}
          onRedo={board.redo}
          onClear={board.clearBoard}
        />
      </div>
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
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
