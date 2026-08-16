import { useCallback, useEffect, useRef, useState, type PointerEvent, type TouchEvent, type WheelEvent } from 'react'
import { COLORS, MAX_SCALE, MIN_SCALE, SIZES } from '../constants'
import { BoardHistory, cloneStrokes } from '../history/boardHistory'
import { PointerSession, type SessionPointer } from '../input/pointerSession'
import type { Stroke, Tool, Viewport } from '../types'
import { distance, exportPaperBlob, midpoint, redrawPaper, screenToPaper, uid } from '../utils/drawing'

export function useWhiteboard(
  writingReady: boolean,
  options?: {
    onCanvasReady?: () => void
    onFirstInk?: () => void
  }
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const historyRef = useRef(new BoardHistory())
  const gestureBeforeRef = useRef<Stroke[] | null>(null)
  const pointerSession = useRef(new PointerSession())
  const activeStrokeId = useRef<string | null>(null)
  const pinchStart = useRef<{
    distance: number
    midpoint: { x: number; y: number }
    viewport: Viewport
  } | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [viewport, setViewport] = useState<Viewport>({ scale: 0.75, x: 32, y: 32 })
  const [revision, setRevision] = useState(0)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    })
  }, [])

  const redraw = useCallback((nextViewport = viewport) => {
    const canvas = canvasRef.current
    if (!canvas) return
    redrawPaper(canvas, nextViewport, strokesRef.current)
    options?.onCanvasReady?.()
  }, [viewport, options])

  useEffect(() => {
    redraw()
  }, [redraw, revision, viewport])

  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [redraw])

  const resetPointerState = useCallback(() => {
    if (gestureBeforeRef.current) {
      strokesRef.current = cloneStrokes(gestureBeforeRef.current)
      gestureBeforeRef.current = null
      setRevision((r) => r + 1)
    }
    pointerSession.current.reset()
    activeStrokeId.current = null
    pinchStart.current = null
  }, [])

  useEffect(() => {
    const onVisibilityLoss = () => {
      if (document.visibilityState === 'hidden') resetPointerState()
    }
    window.addEventListener('blur', resetPointerState)
    document.addEventListener('visibilitychange', onVisibilityLoss)
    if (!writingReady) resetPointerState()
    return () => {
      window.removeEventListener('blur', resetPointerState)
      document.removeEventListener('visibilitychange', onVisibilityLoss)
    }
  }, [resetPointerState, writingReady])

  const setZoom = useCallback((nextScale: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    setViewport((current) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale))
      const paperX = (centerX - current.x) / current.scale
      const paperY = (centerY - current.y) / current.scale
      return { scale, x: centerX - paperX * scale, y: centerY - paperY * scale }
    })
  }, [])

  const eraseAt = useCallback((point: { x: number; y: number }) => {
    const before = strokesRef.current.length
    const radius = Math.max(18, size * 2.5)
    strokesRef.current = strokesRef.current.filter((stroke) =>
      !stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) <= radius)
    )
    if (strokesRef.current.length !== before) {
      setRevision((r) => r + 1)
    }
  }, [size])

  const eventPointer = useCallback((canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>): SessionPointer => {
    const rect = canvas.getBoundingClientRect()
    return {
      id: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pointerType: event.pointerType,
    }
  }, [])

  const beginPinch = useCallback((pointers: [SessionPointer, SessionPointer]) => {
    const [a, b] = pointers
    pinchStart.current = { distance: distance(a, b), midpoint: midpoint(a, b), viewport }
  }, [viewport])

  const cancelTouchStroke = useCallback((cancelledDrawingId: number | null) => {
    if (cancelledDrawingId === null) return
    if (gestureBeforeRef.current) {
      strokesRef.current = cloneStrokes(gestureBeforeRef.current)
      gestureBeforeRef.current = null
      setRevision((r) => r + 1)
    }
    activeStrokeId.current = null
  }, [])

  const onPointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!writingReady) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.setPointerCapture?.(event.pointerId)
    } catch {
      // Sandboxed WebKit can reject capture; pointer ownership still remains explicit.
    }

    const action = pointerSession.current.down(eventPointer(canvas, event))
    if (action.kind === 'startGesture') {
      cancelTouchStroke(action.cancelledDrawingId)
      beginPinch(action.pointers)
      return
    }
    if (action.kind !== 'startDrawing') return

    if (tool !== 'pan') gestureBeforeRef.current = cloneStrokes(strokesRef.current)

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
    options?.onFirstInk?.()
    setRevision((r) => r + 1)
  }, [beginPinch, cancelTouchStroke, color, eraseAt, eventPointer, options, size, tool, viewport, writingReady])

  const onPointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!writingReady) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const action = pointerSession.current.move(eventPointer(canvas, event))
    if (action.kind === 'gesture' && pinchStart.current) {
      const [a, b] = action.pointers
      const nextMid = midpoint(a, b)
      const start = pinchStart.current
      const ratio = distance(a, b) / Math.max(1, start.distance)
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, start.viewport.scale * ratio))
      const paperX = (start.midpoint.x - start.viewport.x) / start.viewport.scale
      const paperY = (start.midpoint.y - start.viewport.y) / start.viewport.scale
      setViewport({
        scale: nextScale,
        x: nextMid.x - paperX * nextScale,
        y: nextMid.y - paperY * nextScale,
      })
      return
    }
    if (action.kind !== 'draw') return

    const point = screenToPaper(canvas, viewport, event.clientX, event.clientY)
    point.pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.55

    if (tool === 'eraser') {
      eraseAt(point)
      return
    }
    if (tool === 'pan') {
      setViewport((current) => ({ ...current, x: current.x + event.movementX, y: current.y + event.movementY }))
      return
    }

    const id = activeStrokeId.current
    if (!id) return
    const last = strokesRef.current.at(-1)
    if (!last || last.id !== id) return
    last.points.push(point)
    setRevision((r) => r + 1)
  }, [eraseAt, eventPointer, tool, viewport, writingReady])

  const finishPointer = useCallback((event: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    try {
      if (canvas?.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    } catch {
      // Capture can already be gone after host cancellation.
    }

    const action = pointerSession.current.up(event.pointerId)
    if (action.endedDrawing) {
      if (cancelled) {
        if (gestureBeforeRef.current) {
          strokesRef.current = cloneStrokes(gestureBeforeRef.current)
          setRevision((r) => r + 1)
        }
      } else if (gestureBeforeRef.current) {
        historyRef.current.commit(gestureBeforeRef.current, strokesRef.current)
        syncHistoryState()
      }
      gestureBeforeRef.current = null
      activeStrokeId.current = null
    }
    pinchStart.current = null
    if (action.startGesture) beginPinch(action.startGesture)
  }, [beginPinch, syncHistoryState])

  const endPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    finishPointer(event, false)
  }, [finishPointer])

  const cancelPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    finishPointer(event, true)
  }, [finishPointer])

  const blockCanvasGesture = useCallback((event: TouchEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const undo = useCallback(() => {
    const previous = historyRef.current.undo(strokesRef.current)
    if (!previous) return
    strokesRef.current = previous
    syncHistoryState()
    setRevision((r) => r + 1)
  }, [syncHistoryState])

  const redo = useCallback(() => {
    const next = historyRef.current.redo(strokesRef.current)
    if (!next) return
    strokesRef.current = next
    syncHistoryState()
    setRevision((r) => r + 1)
  }, [syncHistoryState])

  const clearBoard = useCallback(() => {
    if (strokesRef.current.length === 0) return
    const before = cloneStrokes(strokesRef.current)
    strokesRef.current = []
    historyRef.current.commit(before, strokesRef.current)
    syncHistoryState()
    setRevision((r) => r + 1)
  }, [syncHistoryState])

  const exportBlob = useCallback(() => exportPaperBlob(strokesRef.current), [])

  return {
    canvasRef,
    strokesRef,
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    viewport,
    setZoom,
    onPointerDown,
    onPointerMove,
    endPointer,
    cancelPointer,
    cancelInput: resetPointerState,
    blockCanvasGesture,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    clearBoard,
    exportBlob,
  }
}
