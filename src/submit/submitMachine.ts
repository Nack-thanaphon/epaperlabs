export type SubmitStage =
  | 'idle'
  | 'exporting'
  | 'uploading'
  | 'attaching'
  | 'sending'
  | 'closing'
  | 'submitted'

export type ActiveSubmitStage = Exclude<SubmitStage, 'idle' | 'submitted'>

export class SubmitStageError extends Error {
  readonly stage: ActiveSubmitStage
  readonly code: 'timeout' | 'failed'

  constructor(stage: ActiveSubmitStage, code: 'timeout' | 'failed', cause?: unknown) {
    super(code === 'timeout' ? `${stage} timed out` : `${stage} failed`, { cause })
    this.name = 'SubmitStageError'
    this.stage = stage
    this.code = code
  }
}

interface SubmitAttempt {
  id: string
  blob?: Blob
  fileId?: string
  attached: boolean
  sent: boolean
}

export interface SubmitControllerDependencies {
  exportBlob: () => Promise<Blob>
  upload: (blob: Blob, submissionId: string) => Promise<string>
  attach: (fileId: string, submissionId: string) => Promise<void> | void
  send: (submissionId: string) => Promise<void>
  close: () => Promise<void>
  onStage: (stage: SubmitStage) => void
  onFailure?: (error: SubmitStageError) => void
  timeoutMs?: number
}

export interface SubmitController {
  submit: () => Promise<boolean>
  retry: () => Promise<boolean>
  isSubmitting: () => boolean
  reset: () => void
}

function submissionId() {
  return `papa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createSubmitController(deps: SubmitControllerDependencies): SubmitController {
  const timeoutMs = deps.timeoutMs ?? 20_000
  let inFlight = false
  let attempt: SubmitAttempt | null = null

  const runStage = async <T>(stage: ActiveSubmitStage, operation: () => Promise<T> | T): Promise<T> => {
    deps.onStage(stage)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new SubmitStageError(stage, 'timeout')), timeoutMs)
        }),
      ])
    } catch (error) {
      const wrapped = error instanceof SubmitStageError
        ? error
        : new SubmitStageError(stage, 'failed', error)
      deps.onFailure?.(wrapped)
      throw wrapped
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  const run = async () => {
    if (inFlight) return false
    inFlight = true
    attempt ??= { id: submissionId(), attached: false, sent: false }

    try {
      if (!attempt.blob) {
        attempt.blob = await runStage('exporting', deps.exportBlob)
      }
      if (!attempt.fileId) {
        attempt.fileId = await runStage('uploading', () => deps.upload(attempt!.blob!, attempt!.id))
        if (!attempt.fileId) throw new SubmitStageError('uploading', 'failed')
      }
      if (!attempt.attached) {
        await runStage('attaching', () => deps.attach(attempt!.fileId!, attempt!.id))
        attempt.attached = true
      }
      if (!attempt.sent) {
        await runStage('sending', () => deps.send(attempt!.id))
        attempt.sent = true
      }
      await runStage('closing', deps.close)
      deps.onStage('submitted')
      attempt = null
      return true
    } finally {
      inFlight = false
    }
  }

  return {
    submit: run,
    retry: run,
    isSubmitting: () => inFlight,
    reset: () => {
      if (inFlight) return
      attempt = null
      deps.onStage('idle')
    },
  }
}
