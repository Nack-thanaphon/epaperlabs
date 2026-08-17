import React, { useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { AnswerPrompt } from './components/AnswerPrompt'
import { BottomBar } from './components/BottomBar'
import { DebugPanel } from './components/DebugPanel'
import { DrawingBoard } from './components/DrawingBoard'
import { FloatingTools } from './components/FloatingTools'
import { ProblemPanel } from './components/ProblemPanel'
import { StatusStrip } from './components/StatusStrip'
import { useOpenAiHost } from './hooks/useOpenAiHost'
import { useSubmitHandwriting } from './hooks/useSubmitHandwriting'
import { useWhiteboard } from './hooks/useWhiteboard'
import './styles.css'

const INCIDENT_ENDPOINT =
  (import.meta.env?.VITE_INCIDENT_ENDPOINT as string | undefined) ??
  'https://epaperlabs.vercel.app/api/incident'

function App() {
  const host = useOpenAiHost()
  const { problem, safeArea, exerciseKey } = host
  const [writingOpen, setWritingOpen] = useState(false)
  const board = useWhiteboard(true, {
    onCanvasReady: host.markCanvasReady,
    onFirstInk: host.markFirstInk,
    problemKey: exerciseKey,
  })
  const { status, statusText, isSubmitting, isBoardLocked, handleSubmit } = useSubmitHandwriting({
    strokesRef: board.strokesRef,
    exportBlob: board.exportBlob,
    beforeSubmit: board.cancelInput,
    onDiagnosticFailure: host.reportSubmitFailure,
    strokeRevision: board.revision,
    problemKey: exerciseKey,
    onStageLog: host.pushLog,
  })

  const openWriting = () => {
    setWritingOpen(true)
    host.requestFullscreen()
  }

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
      className={`appShell ${writingOpen ? 'writingMode' : 'inlineMode'}`}
      style={{
        '--host-safe-top': `${safeArea.top}px`,
        '--host-safe-right': `${safeArea.right}px`,
        '--host-safe-bottom': `${safeArea.bottom}px`,
        '--host-safe-left': `${safeArea.left}px`,
      } as CSSProperties}
    >
      <div className="chromeTop">
      <StatusStrip
        buildVersion={host.buildVersion}
        displayMode={host.displayMode}
        hostName={host.hostName}
        elapsedText={host.elapsedText}
        status={status}
        logLine={host.logLine}
      />
      <DebugPanel
        error={host.launchError}
        onRetry={host.retryLaunch}
        onSendReport={sendReport}
        reportState={host.reportState}
      />
      {writingOpen && (
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
        />
      </div>
      )}
      </div>
      <ProblemPanel problem={problem} />
      <DrawingBoard
        canvasRef={board.canvasRef}
        tool={board.tool}
        writingReady={writingOpen}
        inputLocked={isBoardLocked}
        parked={!writingOpen}
        onPointerDown={board.onPointerDown}
        onPointerMove={board.onPointerMove}
        onPointerUp={board.endPointer}
        onPointerCancel={board.cancelPointer}
        onGestureBlock={board.blockCanvasGesture}
      />
      {!writingOpen && <AnswerPrompt onAnswer={openWriting} />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
