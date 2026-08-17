// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('uses perfect-freehand text actions and has no Submit button', () => {
    render(
      <Toolbar
        tool="pen"
        color="#111827"
        size={16}
        canUndo
        canRedo
        hint=""
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onSizeChange={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Draw' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lasso' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rect' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull()
    expect(screen.queryByText('−')).toBeNull()
  })
})
