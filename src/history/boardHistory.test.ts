import { describe, expect, it } from 'vitest'
import { BoardHistory, cloneStrokes } from './boardHistory'
import type { Stroke } from '../types'

const stroke = (id: string): Stroke => ({ id, color: '#000', size: 4, points: [{ x: 1, y: 2, pressure: 0.5 }] })

describe('BoardHistory', () => {
  it('undoes and redoes an added stroke', () => {
    const history = new BoardHistory()
    const before = [stroke('a')]
    const after = [...before, stroke('b')]
    history.commit(before, after)
    expect(history.undo(after)?.map((item) => item.id)).toEqual(['a'])
    expect(history.redo(before)?.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('restores erased strokes and a cleared board', () => {
    const history = new BoardHistory()
    const full = [stroke('a'), stroke('b')]
    const erased = [stroke('a')]
    history.commit(full, erased)
    expect(history.undo(erased)?.map((item) => item.id)).toEqual(['a', 'b'])

    history.reset()
    history.commit(full, [])
    expect(history.undo([])?.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('clears redo after a new action following undo', () => {
    const history = new BoardHistory()
    const a = [stroke('a')]
    const ab = [...a, stroke('b')]
    history.commit(a, ab)
    expect(history.undo(ab)).not.toBeNull()
    expect(history.canRedo).toBe(true)
    history.commit(a, [...a, stroke('c')])
    expect(history.canRedo).toBe(false)
  })

  it('deep clones snapshots so later point mutation cannot corrupt history', () => {
    const original = [stroke('a')]
    const copy = cloneStrokes(original)
    original[0].points[0].x = 99
    expect(copy[0].points[0].x).toBe(1)
  })
})
