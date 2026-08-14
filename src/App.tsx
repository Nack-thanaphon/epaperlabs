import React, { useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DefaultColorStyle,
  DefaultSizeStyle,
  Editor,
  Tldraw,
  TLShapeId,
} from 'tldraw'
import 'tldraw/tldraw.css'
import './styles.css'

declare global {
  interface Window {
    openai?: {
      uploadFile?: (file: File, options?: { library?: boolean }) => Promise<{ fileId: string }>
      setWidgetState?: (state: {
        modelContent?: string
        privateContent?: unknown
        imageIds?: string[]
      }) => void
      sendFollowUpMessage?: (message: { prompt: string; scrollToBottom?: boolean }) => Promise<void>
      requestDisplayMode?: (request: { mode: 'inline' | 'fullscreen' | 'picture-in-picture' }) => Promise<void>
    }
  }
}

type SubmitStatus = 'idle' | 'submitting' | 'submitted' | 'error' | 'empty'

function App() {
  const editorRef = useRef<Editor | null>(null)
  const [status, setStatus] = useState<SubmitStatus>('idle')

  const onMount = useCallback((editor: Editor) => {
    editorRef.current = editor

    // Make it feel like scratch paper immediately.
    editor.setCurrentTool('draw')
    editor.setStyleForNextShapes(DefaultColorStyle, 'black')
    editor.setStyleForNextShapes(DefaultSizeStyle, 'm')

    // Center camera and request a larger writing surface where ChatGPT supports it.
    try {
      window.openai?.requestDisplayMode?.({ mode: 'fullscreen' })
    } catch {
      // ignored: standalone browser / unsupported host
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return

    const shapes = editor.getCurrentPageShapes()
    if (shapes.length === 0) {
      setStatus('empty')
      setTimeout(() => setStatus('idle'), 1400)
      return
    }

    setStatus('submitting')
    try {
      const ids = shapes.map((shape) => shape.id) as TLShapeId[]
      const image = await editor.toImage(ids, {
        format: 'png',
        scale: 2,
        background: true,
        padding: 32,
      })

      const file = new File([image.blob], 'epaperlabs-board.png', { type: 'image/png' })

      if (window.openai?.uploadFile) {
        const { fileId } = await window.openai.uploadFile(file, { library: true })
        window.openai.setWidgetState?.({
          modelContent:
            'The user submitted handwritten work from E-PaperLabs. Review the attached image visually. Preserve layout: equations, arrows, fractions, crossed-out work, and spatial structure matter.',
          privateContent: {
            source: 'epaperlabs-tldraw-board',
            shapeCount: shapes.length,
            width: image.width,
            height: image.height,
          },
          imageIds: [fileId],
        })
        await window.openai.sendFollowUpMessage?.({
          prompt: '[E-PaperLabs] ผมส่งคำตอบที่เขียนด้วยลายมือแล้วครับ ช่วยตรวจให้หน่อย',
          scrollToBottom: true,
        })
        setStatus('submitted')
        setTimeout(() => setStatus('idle'), 2200)
        return
      }

      // Standalone / GitHub Pages demo fallback.
      const url = URL.createObjectURL(image.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'epaperlabs-board.png'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('submitted')
      setTimeout(() => setStatus('idle'), 1800)
    } catch (error) {
      console.error('Submit failed', error)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2200)
    }
  }, [])

  const clearBoard = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const ids = editor.getCurrentPageShapes().map((shape) => shape.id)
    if (ids.length > 0) editor.deleteShapes(ids)
    editor.setCurrentTool('draw')
  }, [])

  const undo = useCallback(() => {
    editorRef.current?.undo()
  }, [])

  const statusText = {
    idle: 'Submit',
    submitting: 'Submitting…',
    submitted: 'Submitted ✓',
    error: 'Try again',
    empty: 'Write first',
  }[status]

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="brand">
          <span className="logo">E</span>
          <span>E-PaperLabs</span>
        </div>
        <div className="hint">Pinch to zoom · two fingers to pan · write with Pencil/finger</div>
        <button className="submitButton" disabled={status === 'submitting'} onClick={handleSubmit}>
          {statusText}
        </button>
      </div>

      <div className="boardWrap">
        <Tldraw
          persistenceKey="epaperlabs-board-v1"
          onMount={onMount}
          autoFocus
        />
      </div>

      <div className="bottomBar">
        <button className="toolButton" onClick={undo}>↶ Undo</button>
        <button className="toolButton danger" onClick={clearBoard}>Clear</button>
        <button className="toolButton primary" disabled={status === 'submitting'} onClick={handleSubmit}>
          {statusText}
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
