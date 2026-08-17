export type Tool = 'pen' | 'eraser' | 'pan' | 'lasso'
export type Point = { x: number; y: number; pressure: number }
export type Stroke = { id: string; points: Point[]; color: string; size: number }
export type Viewport = { scale: number; x: number; y: number }

export type PointerState = {
  id: number
  x: number
  y: number
  pointerType: string
}
