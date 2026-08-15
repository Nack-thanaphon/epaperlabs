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

      const bridge = window.openai
      if (bridge) {
        if (!bridge.uploadFile || !bridge.setWidgetState || !bridge.sendFollowUpMessage) {
          throw new Error('ChatGPT bridge is not ready; please try Submit again')
        }
        // Do not also wait for the optional ChatGPT file-library copy. The image
        // only needs to be attached to this conversation, so this is faster and
        // has one less host operation that can delay the follow-up.
        const { fileId } = await bridge.uploadFile(file)
        if (!fileId) throw new Error('ChatGPT did not return an uploaded image ID')

        await bridge.setWidgetState({
          modelContent:
            'The user submitted handwritten work. The PNG in imageIds is the answer to inspect visually. Read the image before replying; preserve equations, arrows, fractions, crossed-out work, and spatial structure.',
          privateContent: {
            source: 'papa-handwriting-board',
            strokeCount: strokesRef.current.length,
            paperWidth: PAPER_WIDTH,
            paperHeight: PAPER_HEIGHT,
            fileId,
          },
          imageIds: [fileId],
        })
        // setWidgetState is synchronous in the documented bridge, but wait one
        // render frame so its postMessage reaches the host before asking the
        // model to read the attached image.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await bridge.sendFollowUpMessage({
          prompt: '[Papa] ผมส่งคำตอบลายมือเป็นรูปภาพแล้ว กรุณาดูรูปที่แนบมาก่อน แล้วตรวจวิธีคิดให้ผมครับ',
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
