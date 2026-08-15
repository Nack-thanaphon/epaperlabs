export interface SessionPointer {
  id: number
  x: number
  y: number
  pointerType: string
}

type PointerAction =
  | { kind: 'startDrawing'; pointer: SessionPointer }
  | { kind: 'draw'; pointer: SessionPointer }
  | { kind: 'startGesture'; pointers: [SessionPointer, SessionPointer]; cancelledDrawingId: number | null }
  | { kind: 'gesture'; pointers: [SessionPointer, SessionPointer] }
  | { kind: 'ignore' }

export interface PointerEndAction {
  endedDrawing: boolean
  startGesture: [SessionPointer, SessionPointer] | null
}

export class PointerSession {
  private readonly active = new Map<number, SessionPointer>()
  private ownerId: number | null = null
  private ownerType: string | null = null
  private inGesture = false

  get drawingPointerId() { return this.ownerId }
  get drawingPointerType() { return this.ownerType }
  get gestureActive() { return this.inGesture }
  get activeCount() { return this.active.size }

  private touchPointers(): SessionPointer[] {
    return [...this.active.values()].filter((pointer) => pointer.pointerType === 'touch')
  }

  down(pointer: SessionPointer): PointerAction {
    this.active.set(pointer.id, pointer)

    if (this.inGesture) {
      const touches = this.touchPointers()
      return touches.length >= 2
        ? { kind: 'gesture', pointers: [touches[0], touches[1]] }
        : { kind: 'ignore' }
    }

    if (pointer.pointerType === 'touch' && this.ownerType === 'pen') {
      // Palm/finger input must never steal or terminate an Apple Pencil stroke.
      return { kind: 'ignore' }
    }

    const touches = this.touchPointers()
    if (touches.length >= 2 && this.ownerType !== 'pen') {
      const cancelledDrawingId = this.ownerType === 'touch' ? this.ownerId : null
      this.ownerId = null
      this.ownerType = null
      this.inGesture = true
      return {
        kind: 'startGesture',
        pointers: [touches[0], touches[1]],
        cancelledDrawingId,
      }
    }

    if (this.ownerId !== null) return { kind: 'ignore' }
    this.ownerId = pointer.id
    this.ownerType = pointer.pointerType
    return { kind: 'startDrawing', pointer }
  }

  move(pointer: SessionPointer): PointerAction {
    if (!this.active.has(pointer.id)) return { kind: 'ignore' }
    this.active.set(pointer.id, pointer)

    if (this.inGesture) {
      const touches = this.touchPointers()
      return touches.length >= 2
        ? { kind: 'gesture', pointers: [touches[0], touches[1]] }
        : { kind: 'ignore' }
    }

    return pointer.id === this.ownerId
      ? { kind: 'draw', pointer }
      : { kind: 'ignore' }
  }

  up(pointerId: number): PointerEndAction {
    const endedDrawing = pointerId === this.ownerId
    if (endedDrawing) {
      this.ownerId = null
      this.ownerType = null
    }
    this.active.delete(pointerId)

    if (this.inGesture) {
      if (this.touchPointers().length === 0) this.inGesture = false
      return { endedDrawing, startGesture: null }
    }

    // If Pencil ended while two already-resting fingers remain, begin their
    // gesture without requiring the user to lift and place them again.
    const touches = this.touchPointers()
    if (touches.length >= 2 && this.ownerId === null) {
      this.inGesture = true
      return { endedDrawing, startGesture: [touches[0], touches[1]] }
    }

    return { endedDrawing, startGesture: null }
  }

  reset() {
    this.active.clear()
    this.ownerId = null
    this.ownerType = null
    this.inGesture = false
  }
}
