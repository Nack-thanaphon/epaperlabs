import type { Stroke } from '../types'

export function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }))
}

function sameStrokes(a: Stroke[], b: Stroke[]) {
  if (a.length !== b.length) return false
  return a.every((stroke, index) => {
    const other = b[index]
    if (!other || stroke.id !== other.id || stroke.points.length !== other.points.length) return false
    return stroke.points.every((point, pointIndex) => {
      const next = other.points[pointIndex]
      return next && point.x === next.x && point.y === next.y && point.pressure === next.pressure
    })
  })
}

export class BoardHistory {
  private past: Stroke[][] = []
  private future: Stroke[][] = []
  private readonly limit: number

  constructor(limit = 100) {
    this.limit = limit
  }

  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }

  commit(before: Stroke[], current: Stroke[]) {
    if (sameStrokes(before, current)) return false
    this.past.push(cloneStrokes(before))
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
    return true
  }

  undo(current: Stroke[]) {
    const previous = this.past.pop()
    if (!previous) return null
    this.future.push(cloneStrokes(current))
    return cloneStrokes(previous)
  }

  redo(current: Stroke[]) {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(cloneStrokes(current))
    return cloneStrokes(next)
  }

  reset() {
    this.past = []
    this.future = []
  }
}
