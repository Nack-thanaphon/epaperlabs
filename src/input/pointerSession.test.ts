import { describe, expect, it } from 'vitest'
import { PointerSession } from './pointerSession'

const point = (id: number, pointerType: string, x = 0, y = 0) => ({ id, pointerType, x, y })

describe('PointerSession', () => {
  it('keeps Pencil ownership when a finger touches and lifts', () => {
    const session = new PointerSession()
    expect(session.down(point(1, 'pen')).kind).toBe('startDrawing')
    expect(session.down(point(2, 'touch')).kind).toBe('ignore')
    expect(session.move(point(1, 'pen', 10, 10)).kind).toBe('draw')
    expect(session.up(2).endedDrawing).toBe(false)
    expect(session.move(point(1, 'pen', 20, 20)).kind).toBe('draw')
    expect(session.drawingPointerId).toBe(1)
  })

  it('uses one finger to pan and never starts a touch stroke', () => {
    const session = new PointerSession()
    expect(session.down(point(10, 'touch')).kind).toBe('startPan')
    expect(session.move(point(10, 'touch', 5, 0)).kind).toBe('pan')
    const second = session.down(point(11, 'touch', 20, 0))
    expect(second.kind).toBe('startGesture')
    if (second.kind !== 'startGesture') throw new Error('expected startGesture')
    expect(second.cancelledDrawingId).toBeNull()
    expect(session.drawingPointerId).toBeNull()
    expect(session.move(point(10, 'touch', 8, 0)).kind).toBe('gesture')
  })

  it('does not resume drawing when one finger remains after a gesture', () => {
    const session = new PointerSession()
    session.down(point(1, 'touch'))
    session.down(point(2, 'touch'))
    session.up(2)
    expect(session.move(point(1, 'touch', 10, 10)).kind).toBe('ignore')
    session.up(1)
    expect(session.gestureActive).toBe(false)
  })

  it('restarts a gesture when a lifted finger is replaced', () => {
    const session = new PointerSession()
    session.down(point(1, 'touch'))
    session.down(point(2, 'touch', 20, 0))
    session.up(2)
    const replacement = session.down(point(3, 'touch', 30, 0))
    expect(replacement.kind).toBe('startGesture')
    expect(session.move(point(1, 'touch', 5, 0)).kind).toBe('gesture')
  })

  it('rebases when a replacement finger arrives before another finger lifts', () => {
    const session = new PointerSession()
    session.down(point(1, 'touch'))
    session.down(point(2, 'touch', 20, 0))
    session.down(point(3, 'touch', 30, 0))
    const thirdUp = session.up(3)
    expect(thirdUp.startGesture?.map((pointer) => pointer.id)).toEqual([1, 2])
    expect(session.move(point(1, 'touch', 5, 0)).kind).toBe('gesture')
  })

  it('ignores hover moves and non-owner moves', () => {
    const session = new PointerSession()
    expect(session.move(point(99, 'pen')).kind).toBe('ignore')
    session.down(point(1, 'mouse'))
    session.down(point(2, 'mouse'))
    expect(session.move(point(2, 'mouse')).kind).toBe('ignore')
    expect(session.move(point(1, 'mouse')).kind).toBe('draw')
  })

  it('clears all state after capture loss/reset', () => {
    const session = new PointerSession()
    session.down(point(1, 'touch'))
    session.down(point(2, 'touch'))
    session.reset()
    expect(session.activeCount).toBe(0)
    expect(session.drawingPointerId).toBeNull()
    expect(session.gestureActive).toBe(false)
  })

  it('keeps Pencil ownership across 100 palm-contact sequences', () => {
    for (let sequence = 0; sequence < 100; sequence += 1) {
      const session = new PointerSession()
      const penId = sequence * 10 + 1
      const touchA = penId + 1
      const touchB = penId + 2
      expect(session.down(point(penId, 'pen')).kind).toBe('startDrawing')
      expect(session.down(point(touchA, 'touch')).kind).toBe('ignore')
      expect(session.down(point(touchB, 'touch')).kind).toBe('ignore')
      expect(session.move(point(penId, 'pen', sequence, sequence)).kind).toBe('draw')
      session.up(touchA)
      session.up(touchB)
      expect(session.move(point(penId, 'pen', sequence + 1, sequence + 1)).kind).toBe('draw')
      expect(session.up(penId).endedDrawing).toBe(true)
      expect(session.activeCount).toBe(0)
    }
  })
})
