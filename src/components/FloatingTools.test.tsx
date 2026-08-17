// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FloatingTools } from './FloatingTools'

describe('FloatingTools', () => {
  it('omits zoom-out, zoom percentage, and zoom-in controls', () => {
    render(
      <FloatingTools
        tool="pen"
        color="#111827"
        size={4}
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'ลasso คัดลอกเป็นรูป' })).toBeTruthy()
    expect(screen.queryByText('−')).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.queryByText('＋')).toBeNull()
  })
})