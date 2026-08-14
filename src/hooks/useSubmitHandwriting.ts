import { useCallback, useMemo, useState, type RefObject } from 'react'
import { PAPER_HEIGHT, PAPER_WIDTH, STATUS_TEXT } from '../constants'
import type { Stroke, SubmitStatus } from '../types'

interface UseSubmitHandwritingOptions {
  strokesRef: RefObject<Stroke[]>
  exportBlob: () => Promise<Blob>
}

export function useSubmitHandwriting({ strokesRef, exportBlob }: UseSubmitHandwritingOptions) {
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const statusText = useMemo(() => STATUS_TEXT[status], [status])

  const handleSubmit = useCallback(async () => {
    if (strokesRef.current.length === 0) {
      setStatus('empty')
      setTimeout(() => setStatus('idle'), 1400)
      return
    }

    setStatus('submitting')
    try {
      const blob = await exportBlob()
      const file = new File([blob], 'epaperlabs-handwriting.png', { type: 'image/png' })

      if (window.openai?.uploadFile) {
        const { fileId } = await window.openai.uploadFile(file, { library: true })
        window.openai.setWidgetState?.({
          modelContent:
            'The user submitted handwritten work from E-PaperLabs. Review the attached image visually. Preserve equations, arrows, fractions, crossed-out work, and spatial structure.',
          privateContent: {
            source: 'epaperlabs-perfect-freehand-board',
            strokeCount: strokesRef.current.length,
            paperWidth: PAPER_WIDTH,
            paperHeight: PAPER_HEIGHT,
          },
          imageIds: [fileId],
        })
        await window.openai.sendFollowUpMessage?.({
          prompt: '[E-PaperLabs] ผมส่งคำตอบที่เขียนด้วยลายมือแล้วครับ ช่วยตรวจให้หน่อย',
          scrollToBottom: true,
        })
        setStatus('submitted')
        setTimeout(() => setStatus('idle'), 2200)
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'epaperlabs-handwriting.png'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('submitted')
      setTimeout(() => setStatus('idle'), 1800)
    } catch (error) {
      console.error('Submit failed', error)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2200)
    }
  }, [exportBlob, strokesRef])

  return { status, statusText, handleSubmit }
}
