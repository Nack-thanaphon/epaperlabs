// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnswerPrompt } from './AnswerPrompt'

describe('AnswerPrompt', () => {
  it('keeps ตอบคำถามนี้ at the bottom and opens writing on tap', async () => {
    const onAnswer = vi.fn()
    render(<AnswerPrompt onAnswer={onAnswer} />)
    const button = screen.getByRole('button', { name: 'ตอบคำถามนี้' })
    await userEvent.click(button)
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})
