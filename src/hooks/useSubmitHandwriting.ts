import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { PAPER_HEIGHT, PAPER_WIDTH, STATUS_TEXT } from '../constants'
import { createSubmitController, type SubmitController, type SubmitStageError } from '../submit/submitMachine'
import type { Stroke, SubmitStatus } from '../types'

interface UseSubmitHandwritingOptions {
  strokesRef: RefObject<Stroke[]>
  exportBlob: () => Promise<Blob>
  beforeSubmit?: () => void
  onDiagnosticFailure?: (detail: string) => void
}

const ACTIVE_STATUSES = new Set<SubmitStatus>([
  'exporting',
  'uploading',
  'attaching',
  'sending',
  'closing',
  'submitted',
])

function bridgeOrThrow() {
  const bridge = window.openai
  if (!bridge?.uploadFile || !bridge.setWidgetState || !bridge.sendFollowUpMessage) {
    throw new Error('ChatGPT bridge is not ready')
  }
  return bridge
}

export function useSubmitHandwriting({ strokesRef, exportBlob, beforeSubmit, onDiagnosticFailure }: UseSubmitHandwritingOptions) {
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [failureText, setFailureText] = useState('')
  const statusText = useMemo(
    () => status === 'failed' && failureText ? failureText : STATUS_TEXT[status],
    [failureText, status]
  )
  const exportBlobRef = useRef(exportBlob)
  exportBlobRef.current = exportBlob
  const controllerRef = useRef<SubmitController | null>(null)

  if (!controllerRef.current) {
    controllerRef.current = createSubmitController({
      exportBlob: () => exportBlobRef.current(),
      upload: async (blob) => {
        const bridge = bridgeOrThrow()
        const file = new File([blob], 'papa-handwriting.png', { type: 'image/png' })
        const { fileId } = await bridge.uploadFile!(file)
        if (!fileId) throw new Error('ChatGPT did not return an uploaded image ID')
        return fileId
      },
      attach: async (fileId, submissionId) => {
        const bridge = bridgeOrThrow()
        await bridge.setWidgetState!({
          modelContent:
            'The user submitted handwritten work. The PNG in imageIds is the answer to inspect visually. Read the image before replying; preserve equations, arrows, fractions, crossed-out work, and spatial structure.',
          privateContent: {
            source: 'papa-handwriting-board',
            submissionId,
            strokeCount: strokesRef.current.length,
            paperWidth: PAPER_WIDTH,
            paperHeight: PAPER_HEIGHT,
            fileId,
          },
          imageIds: [fileId],
        })
      },
      send: async (submissionId) => {
        const bridge = bridgeOrThrow()
        await bridge.sendFollowUpMessage!({
          prompt: `[Papa submission ${submissionId}] ผมส่งคำตอบลายมือเป็นรูปภาพแล้ว กรุณาดูรูปที่แนบมาก่อน แล้วตรวจวิธีคิดให้ผมครับ`,
          scrollToBottom: true,
        })
      },
      close: async () => {
        const bridge = window.openai
        if (bridge?.requestClose) {
          await bridge.requestClose()
          return
        }
        if (bridge?.requestDisplayMode) {
          await bridge.requestDisplayMode({ mode: 'inline' })
          return
        }
        throw new Error('ChatGPT cannot close the board')
      },
      onStage: (stage) => {
        setFailureText('')
        setStatus(stage)
      },
      onFailure: (error: SubmitStageError) => {
        const labels: Record<SubmitStageError['stage'], string> = {
          exporting: 'เตรียมรูปไม่สำเร็จ — ลองอีกครั้ง',
          uploading: 'อัปโหลดไม่สำเร็จ — งานเดิมยังอยู่',
          attaching: 'แนบรูปไม่สำเร็จ — งานเดิมยังอยู่',
          sending: error.code === 'timeout'
            ? 'รอการส่งเดิม — แตะตรวจอีกครั้ง'
            : 'ส่งเข้าแชตไม่สำเร็จ — งานเดิมยังอยู่',
          closing: 'ส่งแล้ว — แตะเพื่อกลับแชต',
        }
        setFailureText(labels[error.stage])
        setStatus('failed')
        onDiagnosticFailure?.(`${error.stage} ${error.code}: ${error.message}`)
      },
      timeoutMs: 20_000,
    })
  }

  const handleSubmit = useCallback(async () => {
    const controller = controllerRef.current!
    if (controller.isSubmitting()) return
    beforeSubmit?.()
    if (strokesRef.current.length === 0) {
      setStatus('empty')
      window.setTimeout(() => setStatus((current) => current === 'empty' ? 'idle' : current), 1400)
      return
    }

    try {
      await (status === 'failed' ? controller.retry() : controller.submit())
    } catch (error) {
      console.error('Papa Submit failed', error)
    }
  }, [beforeSubmit, status, strokesRef])

  return {
    status,
    statusText,
    isSubmitting: ACTIVE_STATUSES.has(status),
    isBoardLocked: status !== 'idle' && status !== 'empty',
    handleSubmit,
  }
}
