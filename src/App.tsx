import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import getStroke from 'perfect-freehand'
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
type Tool = 'pen' | 'eraser' | 'pan'
type Point = { x: number; y: number; pressure: number }
type Stroke = { id: string; points: Point[]; color: string; size: number }
type Viewport = { scale: number; x: number; y: number }

type PointerState = {
  id: number
  x: number
  y: number
  pointerType: string
}

const COLORS = ['#111827', '#2563eb', '#dc2626', '#059669']
const SIZES = [4, 7, 11]
const PAPER_WIDTH = 2400
const PAPER_HEIGHT = 1600

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function average(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, pressure: (a.pressure + b.pressure) / 2 }
}

function getSvgPathFromStroke(points: number[][]) {
  if (points.length < 4) return ''
  const len = points.length
  const a = points[0]
  const b = points[1]
  const c = points[2]
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(
    { x: b[0], y: b[1], pressure: 0 },
    { x: c[0], y: c[1], pressure: 0 }
  ).x.toFixed(2)},${average(
    { x: b[0], y: b[1], pressure: 0 },
    { x: c[0], y: c[1], pressure: 0 }
  ).y.toFixed(2)} T`

  for (let i = 2; i < len - 1; i++) {
    const p = points[i]
    const n = points[i + 1]
    result += `${((p[0] + n[0]) / 2).toFixed(2)},${((p[1] + n[1]) / 2).toFixed(2)} `
  }
  result += 'Z'
  return result
}

function screenToPaper(canvas: HTMLCanvasElement, viewport: Viewport, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale,
    pressure: 0.5,
  }
}

function distance(a: PointerState, b: PointerState) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: PointerState, b: PointerState) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function drawStrokePath(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return

  if (stroke.points.length === 1) {
    const p = stroke.points[0]
    ctx.fillStyle = stroke.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const outline = getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: stroke.size,
      thinning: 0.55,
      smoothing: 0.55,
      streamline: 0.45,
      simulatePressure: false,
      start: { taper: 0, cap: true },
      end: { taper: stroke.size * 2, cap: true },
    }
  )

  const path = getSvgPathFromStroke(outline)
  if (!path) return
  ctx.fillStyle = stroke.color
  ctx.fill(new Path2D(path))
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const activePointers = useRef(new Map<number, PointerState>())
  const activeStrokeId = useRef<string | null>(null)
  const pinchStart = useRef<{
    distance: number
    midpoint: { x: number; y: number }
    viewport: Viewport
  } | null>(null)

  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [viewport, setViewport] = useState<Viewport>({ scale: 0.75, x: 32, y: 32 })
  const [revision, setRevision] = useState(0)

  const statusText = useMemo(() => ({
    idle: 'Submit',
    submitting: 'Submitting…',
    submitted: 'Submitted ✓',
    error: 'Try again',
    empty: 'Write first',
  })[status], [status])

  const redraw = useCallback((nextViewport = viewport) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(rect.width * dpr))
    const height = Math.max(1, Math.floor(rect.height * dpr))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, height)

    ctx.setTransform(
      dpr * nextViewport.scale,
      0,
      0,
      dpr * nextViewport.scale,
      dpr * nextViewport.x,
      dpr * nextViewport.y
    )

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
    ctx.strokeRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)

    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    for (let x = 80; x < PAPER_WIDTH; x += 80) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, PAPER_HEIGHT)
      ctx.stroke()
    }
    for (let y = 80; y < PAPER_HEIGHT; y += 80) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(PAPER_WIDTH, y)
      ctx.stroke()
    }

    for (const stroke of strokesRef.current) drawStrokePath(ctx, stroke)
  }, [viewport])

  const requestFullscreen = useCallback(() => {
    try {
      return window.openai?.requestDisplayMode?.({ mode: 'fullscreen' })
    } catch {
      // Unsupported host / bridge not ready yet.
      return undefined
    }
  }, [])

  useEffect(() => {
    // ChatGPT can inject its bridge after the React app mounts. Retry briefly so
    // iPad starts in a useful writing area instead of a collapsed inline card.
    void requestFullscreen()
    const retries = [350, 1200].map((delay) => window.setTimeout(() => void requestFullscreen(), delay))
    return () => retries.forEach(window.clearTimeout)
  }, [requestFullscreen])

  useEffect(() => {
    redraw()
  }, [redraw, revision, viewport])

  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [redraw])

  useEffect(() => {
    const stop = (event: TouchEvent | Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    for (const type of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange']) {
      document.addEventListener(type, stop, { passive: false, capture: true })
    }
    return () => {
      for (const type of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange']) {
        document.removeEventListener(type, stop, { capture: true })
      }
    }
  }, [])

  const setZoom = useCallback((nextScale: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    setViewport((current) => {
      const scale = Math.max(0.3, Math.min(3, nextScale))
      const paperX = (centerX - current.x) / current.scale
      const paperY = (centerY - current.y) / current.scale
      return { scale, x: centerX - paperX * scale, y: centerY - paperY * scale }
    })
  }, [])

  const eraseAt = useCallback((point: Point) => {
    const before = strokesRef.current.length
    const radius = Math.max(18, size * 2.5)
    strokesRef.current = strokesRef.current.filter((stroke) =>
      !stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) <= radius)
    )
    if (strokesRef.current.length !== before) setRevision((r) => r + 1)
  }, [size])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    event.currentTarget.setPointerCapture?.(event.pointerId)

    const rect = canvas.getBoundingClientRect()
    activePointers.current.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pointerType: event.pointerType,
    })

    if (activePointers.current.size === 2) {
      activeStrokeId.current = null
      const [a, b] = Array.from(activePointers.current.values())
      pinchStart.current = { distance: distance(a, b), midpoint: midpoint(a, b), viewport }
      return
    }

    const point = screenToPaper(canvas, viewport, event.clientX, event.clientY)
    point.pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.55

    if (tool === 'eraser') {
      eraseAt(point)
      return
    }

    if (tool === 'pan') return

    const stroke: Stroke = { id: uid(), points: [point], color, size }
    strokesRef.current = [...strokesRef.current, stroke]
    activeStrokeId.current = stroke.id
    setRevision((r) => r + 1)
  }, [color, eraseAt, size, tool, viewport])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const existing = activePointers.current.get(event.pointerId)
    if (existing) {
      activePointers.current.set(event.pointerId, {
        ...existing,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }

    if (activePointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = Array.from(activePointers.current.values())
      const nextMid = midpoint(a, b)
      const start = pinchStart.current
      const ratio = distance(a, b) / Math.max(1, start.distance)
      const nextScale = Math.max(0.3, Math.min(3, start.viewport.scale * ratio))
      const paperX = (start.midpoint.x - start.viewport.x) / start.viewport.scale
      const paperY = (start.midpoint.y - start.viewport.y) / start.viewport.scale
      setViewport({
        scale: nextScale,
        x: nextMid.x - paperX * nextScale,
        y: nextMid.y - paperY * nextScale,
      })
      return
    }

    const point = screenToPaper(canvas, viewport, event.clientX, event.clientY)
    point.pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.55

    if (tool === 'eraser') {
      eraseAt(point)
      return
    }

    if (tool === 'pan') {
      setViewport((v) => ({ ...v, x: v.x + event.movementX, y: v.y + event.movementY }))
      return
    }

    const id = activeStrokeId.current
    if (!id) return
    const last = strokesRef.current[strokesRef.current.length - 1]
    if (!last || last.id !== id) return
    last.points.push(point)
    setRevision((r) => r + 1)
  }, [eraseAt, tool, viewport])

  const endPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    activePointers.current.delete(event.pointerId)
    if (activePointers.current.size < 2) pinchStart.current = null
    activeStrokeId.current = null
  }, [])

  const blockCanvasGesture = useCallback((event: React.TouchEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const undo = useCallback(() => {
    strokesRef.current = strokesRef.current.slice(0, -1)
    setRevision((r) => r + 1)
  }, [])

  const clearBoard = useCallback(() => {
    strokesRef.current = []
    setRevision((r) => r + 1)
  }, [])

  const exportBlob = useCallback(async () => {
    const exportCanvas = document.createElement('canvas')
    const scale = 1.5
    exportCanvas.width = PAPER_WIDTH * scale
    exportCanvas.height = PAPER_HEIGHT * scale
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) throw new Error('No canvas context')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.scale(scale, scale)
    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1
    for (let x = 80; x < PAPER_WIDTH; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PAPER_HEIGHT); ctx.stroke()
    }
    for (let y = 80; y < PAPER_HEIGHT; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAPER_WIDTH, y); ctx.stroke()
    }
    for (const stroke of strokesRef.current) drawStrokePath(ctx, stroke)
    return new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png')
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (strokesRef.current.length === 0) {
      setStatus('empty')
      setTimeout(() => setStatus('idle'), 1400)
      return
    }

    setStatus('submitting')
    try {
      const blob = await exportBlob()
      const file = new File([blob], 'epaperlabs-handwriting.png', { type: 'image/png' })

      if (window.openai?.uploadFile) {
        const { fileId } = await window.openai.uploadFile(file, { library: true })
        window.openai.setWidgetState?.({
          modelContent:
            'The user submitted handwritten work from E-PaperLabs. Review the attached image visually. Preserve equations, arrows, fractions, crossed-out work, and spatial structure.',
          privateContent: {
            source: 'epaperlabs-perfect-freehand-board',
            strokeCount: strokesRef.current.length,
            paperWidth: PAPER_WIDTH,
            paperHeight: PAPER_HEIGHT,
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

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'epaperlabs-handwriting.png'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('submitted')
      setTimeout(() => setStatus('idle'), 1800)
    } catch (error) {
      console.error('Submit failed', error)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2200)
    }
  }, [exportBlob])

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="brand"><span className="logo">E</span><span>E-PaperLabs</span></div>
        <div className="hint">Lightweight handwriting board · Pencil/finger writes · two fingers pinch/pan</div>
        <button className="expandButton" onClick={() => void requestFullscreen()}>เต็มจอ</button>
        <button className="submitButton" disabled={status === 'submitting'} onClick={handleSubmit}>{statusText}</button>
      </div>

      <div className="boardWrap">
        <canvas
          ref={canvasRef}
          className={`paperCanvas tool-${tool}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
          onTouchStart={blockCanvasGesture}
          onTouchMove={blockCanvasGesture}
          onTouchEnd={blockCanvasGesture}
          onWheel={blockCanvasGesture}
        />
        <div className="floatingTools" aria-label="Drawing tools">
          <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}>Pen</button>
          <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}>Eraser</button>
          <button className={tool === 'pan' ? 'active' : ''} onClick={() => setTool('pan')}>Pan</button>
          <span className="separator" />
          {COLORS.map((c) => <button key={c} className={`swatch ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => { setColor(c); setTool('pen') }} aria-label={`Color ${c}`} />)}
          <span className="separator" />
          {SIZES.map((s) => <button key={s} className={size === s ? 'active' : ''} onClick={() => setSize(s)}>{s === 4 ? 'S' : s === 7 ? 'M' : 'L'}</button>)}
          <span className="separator" />
          <button onClick={() => setZoom(viewport.scale / 1.25)}>−</button>
          <button onClick={() => setZoom(1)}>{Math.round(viewport.scale * 100)}%</button>
          <button onClick={() => setZoom(viewport.scale * 1.25)}>＋</button>
        </div>
      </div>

      <div className="bottomBar">
        <button className="toolButton" onClick={undo}>↶ Undo</button>
        <button className="toolButton danger" onClick={clearBoard}>Clear</button>
        <button className="toolButton primary" disabled={status === 'submitting'} onClick={handleSubmit}>{statusText}</button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
