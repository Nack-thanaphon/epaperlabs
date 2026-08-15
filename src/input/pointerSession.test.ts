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

  it('cancels a pending touch stroke when the second finger arrives', () => {
    const session = new PointerSession()
    expect(session.down(point(10, 'touch')).kind).toBe('startDrawing')
    const second = session.down(point(11, 'touch', 20, 0))
    expect(second.kind).toBe('startGesture')
    if (second.kind !== 'startGesture') throw new Error('expected startGesture')
    expect(second.cancelledDrawingId).toBe(10)
    expect(session.drawingPointerId).toBeNull()
    expect(session.move(point(10, 'touch', 5, 0)).kind).toBe('gesture')
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
})
