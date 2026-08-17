import React, { type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { BottomBar } from './components/BottomBar'
import { DebugPanel } from './components/DebugPanel'
import { DrawingBoard } from './components/DrawingBoard'
import { FloatingTools } from './components/FloatingTools'
import { FullscreenGate } from './components/FullscreenGate'
import { ProblemPanel } from './components/ProblemPanel'
import { useOpenAiHost } from './hooks/useOpenAiHost'
import { useSubmitHandwriting } from './hooks/useSubmitHandwriting'
import { useWhiteboard } from './hooks/useWhiteboard'
import './styles.css'

const INCIDENT_ENDPOINT =
  (import.meta.env?.VITE_INCIDENT_ENDPOINT as string | undefined) ??
  'https://epaperlabs.vercel.app/api/incident'

function App() {
  const host = useOpenAiHost()
  const { problem, writingReady, safeArea, requestFullscreen, exerciseKey } = host
  const board = useWhiteboard(writingReady, {
    onCanvasReady: host.markCanvasReady,
    onFirstInk: host.markFirstInk,
    problemKey: exerciseKey,
  })
  const { status, statusText, isSubmitting, isBoardLocked, handleSubmit, handleReturnToHost } = useSubmitHandwriting({
    strokesRef: board.strokesRef,
    exportBlob: board.exportBlob,
    beforeSubmit: board.cancelInput,
    onDiagnosticFailure: host.reportSubmitFailure,
    strokeRevision: board.revision,
    problemKey: exerciseKey,
    onReturnToChat: host.markCollapsed,
  })
  const expand = () => void requestFullscreen()

  const sendReport = async () => {
    if (!host.launchError) return
    host.setReportState('sending')
    try {
      const response = await fetch(INCIDENT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(host.launchError),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      host.setReportState('sent')
    } catch {
      host.setReportState('failed')
    }
  }

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
      {!writingReady && <>
        <FullscreenGate
          compact
          sent={status === 'submitted' || status === 'closing'}
          onExpand={expand}
        />
        <DebugPanel
          error={host.launchError}
          onRetry={host.retryLaunch}
          onSendReport={sendReport}
          reportState={host.reportState}
        />
      </>}
      {writingReady && <>
      <div className="bottomControls">
        <FloatingTools
          tool={board.tool}
          color={board.color}
          size={board.size}
          onToolChange={board.setTool}
          onColorChange={board.setColor}
          onSizeChange={board.setSize}
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
          onReturnToHost={handleReturnToHost}
        />
      </div>
      <ProblemPanel problem={problem} />
      </>}
      <DrawingBoard
        canvasRef={board.canvasRef}
        tool={board.tool}
        writingReady={writingReady}
        inputLocked={isBoardLocked}
        parked={!writingReady}
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
