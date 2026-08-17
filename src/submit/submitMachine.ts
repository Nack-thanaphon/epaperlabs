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
  exportPromise?: Promise<Blob>
  uploadPromise?: Promise<string>
  attachPromise?: Promise<void>
  sendPromise?: Promise<void>
  closePromise?: Promise<void>
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
  returnToHost: () => Promise<boolean>
  hasSubmitted: () => boolean
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

  const runPersistentStage = async <T>(
    stage: ActiveSubmitStage,
    getPromise: () => Promise<T> | undefined,
    setPromise: (promise: Promise<T> | undefined) => void,
    operation: () => Promise<T> | T
  ): Promise<T> => {
    let operationPromise = getPromise()
    if (!operationPromise) {
      operationPromise = Promise.resolve().then(operation)
      setPromise(operationPromise)
    }
    try {
      return await runStage(stage, () => operationPromise!)
    } catch (error) {
      // Host bridge calls cannot be aborted. After a timeout, retain and await
      // the original promise on Retry instead of issuing a duplicate side effect.
      // A definite rejection is safe to replace on the next explicit Retry.
      if (error instanceof SubmitStageError && error.code === 'failed') {
        setPromise(undefined)
      }
      throw error
    }
  }

  const run = async () => {
    if (inFlight) return false
    inFlight = true
    attempt ??= { id: submissionId(), attached: false, sent: false }

    try {
      if (!attempt.blob) {
        attempt.blob = await runPersistentStage(
          'exporting',
          () => attempt!.exportPromise,
          (promise) => { attempt!.exportPromise = promise },
          deps.exportBlob
        )
      }
      if (!attempt.fileId) {
        attempt.fileId = await runPersistentStage(
          'uploading',
          () => attempt!.uploadPromise,
          (promise) => { attempt!.uploadPromise = promise },
          async () => {
            const fileId = await deps.upload(attempt!.blob!, attempt!.id)
            if (!fileId) throw new Error('Upload returned no file ID')
            return fileId
          }
        )
      }
      if (!attempt.attached) {
        await runPersistentStage(
          'attaching',
          () => attempt!.attachPromise,
          (promise) => { attempt!.attachPromise = promise },
          () => deps.attach(attempt!.fileId!, attempt!.id)
        )
        attempt.attached = true
      }
      if (!attempt.sent) {
        await runPersistentStage(
          'sending',
          () => attempt!.sendPromise,
          (promise) => { attempt!.sendPromise = promise },
          () => deps.send(attempt!.id)
        )
        attempt.sent = true
      }
      // Do not call ChatGPT display-mode APIs after send. Those promises hang
      // the iframe with no error. The learner stays on the board.
      deps.onStage('submitted')
      returnToHostAvailable = true
      attempt = null
      return true
    } finally {
      inFlight = false
    }
  }

  let returnInFlight = false
  let returnPromise: Promise<void> | undefined
  let returnToHostAvailable = false

  const returnToHost = async () => {
    if (!returnToHostAvailable || returnInFlight) return false
    returnInFlight = true
    try {
      returnPromise ??= Promise.resolve().then(deps.close)
      try {
        await runStage('closing', () => returnPromise!)
        returnToHostAvailable = false
        return true
      } catch (error) {
        if (error instanceof SubmitStageError && error.code === 'failed') {
          returnPromise = undefined
        }
        throw error
      }
    } finally {
      returnInFlight = false
    }
  }

  return {
    submit: run,
    retry: run,
    returnToHost,
    hasSubmitted: () => returnToHostAvailable,
    isSubmitting: () => inFlight,
    reset: () => {
      if (inFlight) return
      attempt = null
      returnToHostAvailable = false
      returnPromise = undefined
      deps.onStage('idle')
    },
  }
}
