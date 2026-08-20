import { useCallback, useEffect, useRef, useState, type PointerEvent, type TouchEvent } from 'react'
import { COLORS, DEFAULT_PEN_SIZE, DEFAULT_SCALE, DRAFT_PERSIST_MS, MAX_SCALE, MIN_SCALE, SELECT_IDLE_MS } from '../constants'
import { BoardHistory, cloneStrokes } from '../history/boardHistory'
import { PointerSession, type SessionPointer } from '../input/pointerSession'
import { BLANK_PROBLEM_KEY, readHostDraft, writeHostDraft } from '../persistence/widgetDraft'
import type { Point, Stroke, Tool, Viewport } from '../types'
import { copyImage } from '../utils/copyImage'
import { canExportLasso, exportLassoBlob, rectPolygon } from '../utils/lasso'
import { createPaperCache, distance, midpoint, redrawPaper, screenToPaperFromRect, uid, zoomPercent } from '../utils/drawing'

export function useWhiteboard(
  writingReady: boolean,
  options?: {
    onCanvasReady?: () => void
    onFirstInk?: () => void
    problemKey?: string
  }
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const historyRef = useRef(new BoardHistory())
  const gestureBeforeRef = useRef<Stroke[] | null>(null)
  const pointerSession = useRef(new PointerSession(
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches === true
  ))
  const activeStrokeId = useRef<string | null>(null)
  const lassoPathRef = useRef<Point[]>([])
  const lassoOriginRef = useRef<Point | null>(null)
  const lassoHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safariPinchRef = useRef(false)
  const paperCacheRef = useRef(createPaperCache())
  const canvasRectRef = useRef<DOMRect | null>(null)
  const zoomRafRef = useRef<number | null>(null)
  const viewportRef = useRef<Viewport>({ scale: DEFAULT_SCALE, x: 32, y: 32 })
  const problemKey = options?.problemKey ?? BLANK_PROBLEM_KEY
  const problemKeyRef = useRef(problemKey)
  problemKeyRef.current = problemKey
  const onCanvasReadyRef = useRef(options?.onCanvasReady)
  const onFirstInkRef = useRef(options?.onFirstInk)
  onCanvasReadyRef.current = options?.onCanvasReady
  onFirstInkRef.current = options?.onFirstInk
  const pinchStart = useRef<{
    distance: number
    midpoint: { x: number; y: number }
    viewport: Viewport
  } | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(DEFAULT_PEN_SIZE)
  const [viewport, setViewportState] = useState<Viewport>(viewportRef.current)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const [lassoHint, setLassoHint] = useState('')

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    })
  }, [])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    redrawPaper(
      canvas,
      viewportRef.current,
      strokesRef.current,
      lassoPathRef.current,
      paperCacheRef.current,
      activeStrokeId.current,
    )
    onCanvasReadyRef.current?.()
  }, [])

  const bumpRevision = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      paint()
    })
  }, [paint])

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      void writeHostDraft(strokesRef.current, problemKeyRef.current)
    }, DRAFT_PERSIST_MS)
  }, [])

  const setViewport = useCallback((next: Viewport | ((current: Viewport) => Viewport)) => {
    const resolved = typeof next === 'function' ? next(viewportRef.current) : next
    viewportRef.current = resolved
    bumpRevision()
    if (zoomRafRef.current != null) return
    zoomRafRef.current = requestAnimationFrame(() => {
      zoomRafRef.current = null
      setViewportState({ ...viewportRef.current })
    })
  }, [bumpRevision])

  useEffect(() => {
    paint()
  }, [paint, writingReady])

  useEffect(() => {
    const canvas = canvasRef.current
    const onResize = () => {
      canvasRectRef.current = canvas?.getBoundingClientRect() ?? null
      paint()
    }
    window.addEventListener('resize', onResize)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)
    if (canvas && observer) observer.observe(canvas)
    return () => {
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
    }
  }, [paint, writingReady])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const clampScale = (value: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
    const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
      const rect = canvas.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      const current = viewportRef.current
      const paperX = (px - current.x) / current.scale
      const paperY = (py - current.y) / current.scale
      setViewport({
        scale: nextScale,
        x: px - paperX * nextScale,
        y: py - paperY * nextScale,
      })
    }

    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.ctrlKey || event.metaKey) {
        zoomAt(event.clientX, event.clientY, clampScale(viewportRef.current.scale * Math.exp(-event.deltaY * 0.01)))
        return
      }
      setViewport({
        ...viewportRef.current,
        x: viewportRef.current.x - event.deltaX,
        y: viewportRef.current.y - event.deltaY,
      })
    }

    const onGestureStart = (event: Event) => {
      event.preventDefault()
      safariPinchRef.current = true
      pinchStart.current = {
        distance: 1,
        midpoint: { x: 0, y: 0 },
        viewport: { ...viewportRef.current },
      }
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const gesture = event as Event & { scale: number; clientX: number; clientY: number }
      const start = pinchStart.current
      if (!start) return
      zoomAt(gesture.clientX, gesture.clientY, clampScale(start.viewport.scale * (gesture.scale || 1)))
    }
    const onGestureEnd = (event: Event) => {
      event.preventDefault()
      safariPinchRef.current = false
      pinchStart.current = null
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('gesturestart', onGestureStart)
    canvas.addEventListener('gesturechange', onGestureChange)
    canvas.addEventListener('gestureend', onGestureEnd)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('gesturestart', onGestureStart)
      canvas.removeEventListener('gesturechange', onGestureChange)
      canvas.removeEventListener('gestureend', onGestureEnd)
    }
  }, [setViewport, writingReady])

  useEffect(() => {
    const restored = readHostDraft(problemKey)
    if (restored?.length) {
      strokesRef.current = restored
    } else {
      strokesRef.current = []
      historyRef.current.reset()
      syncHistoryState()
    }
    pointerSession.current.reset()
    activeStrokeId.current = null
    lassoPathRef.current = []
    lassoOriginRef.current = null
    pinchStart.current = null
    gestureBeforeRef.current = null
    activeStrokeId.current = null
    paint()
  }, [paint, problemKey, syncHistoryState])

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [])

  const resetSession = useCallback(() => {
    pointerSession.current.reset()
    activeStrokeId.current = null
    pinchStart.current = null
  }, [])

  const toolRef = useRef<Tool>(tool)
  toolRef.current = tool
  const selectIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSelectIdle = useCallback(() => {
    if (selectIdleTimerRef.current) {
      clearTimeout(selectIdleTimerRef.current)
      selectIdleTimerRef.current = null
    }
  }, [])

  const armSelectIdle = useCallback(() => {
    if (selectIdleTimerRef.current) clearTimeout(selectIdleTimerRef.current)
    selectIdleTimerRef.current = setTimeout(() => {
      selectIdleTimerRef.current = null
      if (toolRef.current !== 'lasso' && toolRef.current !== 'rect') return
      if (pointerSession.current.activeCount > 0) {
        armSelectIdle()
        return
      }
      lassoPathRef.current = []
      lassoOriginRef.current = null
      toolRef.current = 'pen'
      setTool('pen')
      resetSession()
      paint()
    }, SELECT_IDLE_MS)
  }, [paint, resetSession])

  const selectTool = useCallback((next: Tool) => {
    setTool(next)
    toolRef.current = next
    if (next === 'lasso' || next === 'rect') armSelectIdle()
    else clearSelectIdle()
  }, [armSelectIdle, clearSelectIdle])

  useEffect(() => () => clearSelectIdle(), [clearSelectIdle])

  const showLassoHint = useCallback((text: string) => {
    setLassoHint(text)
    if (lassoHintTimerRef.current) clearTimeout(lassoHintTimerRef.current)
    lassoHintTimerRef.current = setTimeout(() => {
      lassoHintTimerRef.current = null
      setLassoHint('')
    }, 1800)
  }, [])

  const copyLassoImage = useCallback(async (polygon: Point[]) => {
    if (!canExportLasso(polygon)) {
      showLassoHint('ลากล้อมพื้นที่ก่อน')
      return
    }
    try {
      const result = await copyImage(() => exportLassoBlob(strokesRef.current, polygon))
      showLassoHint(result === 'copied' ? 'คัดลอกรูปแล้ว' : result === 'shared' ? 'แชร์รูปแล้ว' : 'บันทึกรูปแล้ว')
    } catch {
      showLassoHint('คัดลอกรูปไม่สำเร็จ')
    }
  }, [showLassoHint])

  const cancelInput = useCallback(() => {
    if (gestureBeforeRef.current) {
      strokesRef.current = cloneStrokes(gestureBeforeRef.current)
      gestureBeforeRef.current = null
      bumpRevision()
    }
    if (lassoPathRef.current.length) {
      lassoPathRef.current = []
      lassoOriginRef.current = null
      bumpRevision()
    }
    resetSession()
  }, [bumpRevision, resetSession])

  const commitOpenStroke = useCallback(() => {
    if (gestureBeforeRef.current) {
      historyRef.current.commit(gestureBeforeRef.current, strokesRef.current)
      syncHistoryState()
      gestureBeforeRef.current = null
      schedulePersist()
    }
    resetSession()
  }, [resetSession, schedulePersist, syncHistoryState])

  useEffect(() => {
    const onVisibilityLoss = () => {
      if (document.visibilityState === 'hidden') commitOpenStroke()
    }
    window.addEventListener('blur', commitOpenStroke)
    document.addEventListener('visibilitychange', onVisibilityLoss)
    if (!writingReady) resetSession()
    return () => {
      window.removeEventListener('blur', commitOpenStroke)
      document.removeEventListener('visibilitychange', onVisibilityLoss)
    }
  }, [commitOpenStroke, resetSession, writingReady])

  const eraseAt = useCallback((point: { x: number; y: number }) => {
    const before = strokesRef.current.length
    const radius = Math.max(18, size * 2.5)
    strokesRef.current = strokesRef.current.filter((stroke) =>
      !stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) <= radius)
    )
    if (strokesRef.current.length !== before) bumpRevision()
  }, [bumpRevision, size])

  const eventPointer = useCallback((canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>): SessionPointer => {
    const rect = canvasRectRef.current ?? canvas.getBoundingClientRect()
    return {
      id: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pointerType: event.pointerType,
    }
  }, [])

  const toPaper = useCallback((canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvasRectRef.current ?? canvas.getBoundingClientRect()
    return screenToPaperFromRect(rect, viewportRef.current, clientX, clientY)
  }, [])

  const beginPinch = useCallback((pointers: [SessionPointer, SessionPointer]) => {
    const [a, b] = pointers
    pinchStart.current = { distance: distance(a, b), midpoint: midpoint(a, b), viewport: viewportRef.current }
  }, [])

  const cancelTouchStroke = useCallback((cancelledDrawingId: number | null) => {
    if (cancelledDrawingId === null && lassoPathRef.current.length === 0) return
    if (gestureBeforeRef.current) {
      strokesRef.current = cloneStrokes(gestureBeforeRef.current)
      gestureBeforeRef.current = null
    }
    if (lassoPathRef.current.length) lassoPathRef.current = []
    lassoOriginRef.current = null
    activeStrokeId.current = null
    bumpRevision()
  }, [bumpRevision])

  const onPointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!writingReady) return
    if (event.pointerType === 'mouse' && (event.isPrimary === false || event.button !== 0)) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    canvasRectRef.current = canvas.getBoundingClientRect()
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
    if (action.kind === 'startPan') return
    if (action.kind !== 'startDrawing') return

    if (tool !== 'pan' && tool !== 'lasso' && tool !== 'rect') gestureBeforeRef.current = cloneStrokes(strokesRef.current)

    const point = toPaper(canvas, event.clientX, event.clientY)
    point.pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.55

    if (tool === 'eraser') {
      eraseAt(point)
      return
    }
    if (tool === 'pan') return
    if (tool === 'lasso' || tool === 'rect') {
      armSelectIdle()
      lassoOriginRef.current = point
      lassoPathRef.current = tool === 'rect' ? rectPolygon(point, point) : [point]
      bumpRevision()
      return
    }

    const stroke: Stroke = { id: uid(), points: [point], color, size }
    strokesRef.current = [...strokesRef.current, stroke]
    activeStrokeId.current = stroke.id
    onFirstInkRef.current?.()
    bumpRevision()
  }, [armSelectIdle, beginPinch, bumpRevision, cancelTouchStroke, color, eraseAt, eventPointer, size, toPaper, tool, writingReady])

  const onPointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!writingReady) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return

    const action = pointerSession.current.move(eventPointer(canvas, event))
    if (action.kind === 'gesture' && pinchStart.current && !safariPinchRef.current) {
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
    if (action.kind === 'pan' || (action.kind === 'draw' && tool === 'pan')) {
      setViewport((current) => ({ ...current, x: current.x + event.movementX, y: current.y + event.movementY }))
      return
    }
    if (action.kind !== 'draw') return

    if (tool === 'lasso' || tool === 'rect') {
      armSelectIdle()
      const point = toPaper(canvas, event.clientX, event.clientY)
      if (tool === 'rect') {
        const origin = lassoOriginRef.current
        if (!origin) return
        lassoPathRef.current = rectPolygon(origin, point)
        bumpRevision()
        return
      }
      const last = lassoPathRef.current.at(-1)
      if (!last || distance(last, point) >= 4) {
        lassoPathRef.current = [...lassoPathRef.current, point]
        bumpRevision()
      }
      return
    }

    const id = activeStrokeId.current
    if (!id) return
    const last = strokesRef.current.at(-1)
    if (!last || last.id !== id) return

    const nativeEvents = event.nativeEvent?.getCoalescedEvents?.() ?? [event.nativeEvent ?? event]
    for (const native of nativeEvents) {
      const point = toPaper(canvas, native.clientX, native.clientY)
      point.pressure = native.pressure && native.pressure > 0 ? native.pressure : 0.55
      if (tool === 'eraser') {
        eraseAt(point)
      } else {
        last.points.push(point)
      }
    }
    if (tool !== 'eraser') bumpRevision()
  }, [armSelectIdle, bumpRevision, eraseAt, eventPointer, setViewport, toPaper, tool, writingReady])

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
      if (tool === 'lasso' || tool === 'rect') {
        const polygon = lassoPathRef.current
        lassoPathRef.current = []
        lassoOriginRef.current = null
        bumpRevision()
        if (!cancelled) void copyLassoImage(polygon)
        armSelectIdle()
      } else if (cancelled) {
        if (gestureBeforeRef.current) {
          strokesRef.current = cloneStrokes(gestureBeforeRef.current)
          bumpRevision()
        }
      } else if (gestureBeforeRef.current) {
        historyRef.current.commit(gestureBeforeRef.current, strokesRef.current)
        syncHistoryState()
        schedulePersist()
      }
      gestureBeforeRef.current = null
      activeStrokeId.current = null
      paint()
    }
    if (!action.startGesture) pinchStart.current = null
    if (action.startGesture) beginPinch(action.startGesture)
  }, [armSelectIdle, beginPinch, bumpRevision, copyLassoImage, paint, schedulePersist, syncHistoryState, tool])

  const endPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    finishPointer(event, false)
  }, [finishPointer])

  const cancelPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    finishPointer(event, true)
  }, [finishPointer])

  const blockCanvasGesture = useCallback((event: TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const undo = useCallback(() => {
    const previous = historyRef.current.undo(strokesRef.current)
    if (!previous) return
    strokesRef.current = previous
    syncHistoryState()
    bumpRevision()
    schedulePersist()
  }, [bumpRevision, schedulePersist, syncHistoryState])

  const redo = useCallback(() => {
    const next = historyRef.current.redo(strokesRef.current)
    if (!next) return
    strokesRef.current = next
    syncHistoryState()
    bumpRevision()
    schedulePersist()
  }, [bumpRevision, schedulePersist, syncHistoryState])

  const clearBoard = useCallback(() => {
    if (strokesRef.current.length === 0) return
    const before = cloneStrokes(strokesRef.current)
    strokesRef.current = []
    historyRef.current.commit(before, strokesRef.current)
    syncHistoryState()
    bumpRevision()
    schedulePersist()
  }, [bumpRevision, schedulePersist, syncHistoryState])

  return {
    canvasRef,
    strokesRef,
    tool,
    setTool: selectTool,
    color,
    setColor,
    size,
    setSize,
    viewport,
    zoomPercent: zoomPercent(viewport.scale),
    onPointerDown,
    onPointerMove,
    endPointer,
    cancelPointer,
    cancelInput,
    blockCanvasGesture,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    clearBoard,
    lassoHint,
  }
}
