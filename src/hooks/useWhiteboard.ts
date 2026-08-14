import { useCallback, useEffect, useRef, useState, type PointerEvent, type TouchEvent, type WheelEvent } from 'react'
import { COLORS, MAX_SCALE, MIN_SCALE, SIZES } from '../constants'
import type { PointerState, Stroke, Tool, Viewport } from '../types'
import { distance, exportPaperBlob, midpoint, redrawPaper, screenToPaper, uid } from '../utils/drawing'

export function useWhiteboard(writingReady: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const activePointers = useRef(new Map<number, PointerState>())
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

  const redraw = useCallback((nextViewport = viewport) => {
    const canvas = canvasRef.current
    if (!canvas) return
    redrawPaper(canvas, nextViewport, strokesRef.current)
  }, [viewport])

  useEffect(() => {
    redraw()
  }, [redraw, revision, viewport])

  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [redraw])

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
    if (strokesRef.current.length !== before) setRevision((r) => r + 1)
  }, [size])

  const onPointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!writingReady) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.setPointerCapture?.(event.pointerId)
    } catch {
      // Some sandboxed WebKit/iframe contexts reject pointer capture; drawing must still continue.
    }

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
  }, [color, eraseAt, size, tool, viewport, writingReady])

  const onPointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!writingReady) return
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
  }, [eraseAt, tool, viewport, writingReady])

  const endPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    try {
      if (canvas?.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may have been rejected or released by the host.
    }
    activePointers.current.delete(event.pointerId)
    if (activePointers.current.size < 2) pinchStart.current = null
    activeStrokeId.current = null
  }, [])

  const blockCanvasGesture = useCallback((event: TouchEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>) => {
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
    blockCanvasGesture,
    undo,
    clearBoard,
    exportBlob,
  }
}
