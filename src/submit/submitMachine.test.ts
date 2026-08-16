import { describe, expect, it, vi } from 'vitest'
import { createSubmitController, type SubmitStage } from './submitMachine'

function harness(overrides: Partial<Parameters<typeof createSubmitController>[0]> = {}) {
  const calls: string[] = []
  const stages: SubmitStage[] = []
  const deps = {
    exportBlob: vi.fn(async () => { calls.push('export'); return new Blob(['ink'], { type: 'image/png' }) }),
    upload: vi.fn(async () => { calls.push('upload'); return 'file-1' }),
    attach: vi.fn(async () => { calls.push('attach') }),
    send: vi.fn(async () => { calls.push('send') }),
    close: vi.fn(async () => { calls.push('close') }),
    onStage: vi.fn((stage: SubmitStage) => stages.push(stage)),
    timeoutMs: 100,
    ...overrides,
  }
  return { controller: createSubmitController(deps), deps, calls, stages }
}

describe('submit controller', () => {
  it('runs every stage once and closes after sending', async () => {
    const { controller, calls, stages } = harness()
    await expect(controller.submit()).resolves.toBe(true)
    expect(calls).toEqual(['export', 'upload', 'attach', 'send', 'close'])
    expect(stages).toEqual(['exporting', 'uploading', 'attaching', 'sending', 'closing', 'submitted'])
  })

  it('rejects rapid duplicate submits synchronously', async () => {
    let release!: () => void
    const uploadGate = new Promise<void>((resolve) => { release = resolve })
    const { controller, deps } = harness({
      upload: vi.fn(async () => { await uploadGate; return 'file-1' }),
    })
    const first = controller.submit()
    const second = controller.submit()
    await expect(second).resolves.toBe(false)
    release()
    await expect(first).resolves.toBe(true)
    expect(deps.upload).toHaveBeenCalledTimes(1)
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  it('retries attach without exporting or uploading again', async () => {
    const attach = vi.fn()
      .mockRejectedValueOnce(new Error('host busy'))
      .mockResolvedValueOnce(undefined)
    const { controller, deps } = harness({ attach })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'attaching' })
    await expect(controller.retry()).resolves.toBe(true)
    expect(deps.exportBlob).toHaveBeenCalledTimes(1)
    expect(deps.upload).toHaveBeenCalledTimes(1)
    expect(attach).toHaveBeenCalledTimes(2)
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  it('retries close without sending a duplicate follow-up', async () => {
    const close = vi.fn()
      .mockRejectedValueOnce(new Error('close declined'))
      .mockResolvedValueOnce(undefined)
    const { controller, deps } = harness({ close })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'closing' })
    await expect(controller.retry()).resolves.toBe(true)
    expect(deps.send).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(2)
  })

  it('times out a hanging stage with its exact stage', async () => {
    const { controller } = harness({
      upload: vi.fn(() => new Promise<string>(() => {})),
      timeoutMs: 5,
    })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'uploading', code: 'timeout' })
  })

  it('never sends a second follow-up after an uncertain send timeout', async () => {
    let releaseSend!: () => void
    const pendingSend = new Promise<void>((resolve) => { releaseSend = resolve })
    const send = vi.fn(() => pendingSend)
    const { controller, deps } = harness({ send, timeoutMs: 5 })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'sending', code: 'timeout' })
    const retry = controller.retry()
    releaseSend()
    await expect(retry).resolves.toBe(true)
    expect(deps.send).toHaveBeenCalledTimes(1)
    expect(deps.close).toHaveBeenCalledTimes(1)
  })

  it('reconciles a late upload instead of starting a duplicate upload', async () => {
    let releaseUpload!: (fileId: string) => void
    const pendingUpload = new Promise<string>((resolve) => { releaseUpload = resolve })
    const upload = vi.fn(() => pendingUpload)
    const { controller, deps } = harness({ upload, timeoutMs: 5 })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'uploading', code: 'timeout' })
    const retry = controller.retry()
    releaseUpload('late-file')
    await expect(retry).resolves.toBe(true)
    expect(deps.upload).toHaveBeenCalledTimes(1)
  })

  it('reconciles a late attachment without repeating widget state', async () => {
    let releaseAttach!: () => void
    const pendingAttach = new Promise<void>((resolve) => { releaseAttach = resolve })
    const attach = vi.fn(() => pendingAttach)
    const { controller, deps } = harness({ attach, timeoutMs: 5 })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'attaching', code: 'timeout' })
    const retry = controller.retry()
    releaseAttach()
    await expect(retry).resolves.toBe(true)
    expect(deps.attach).toHaveBeenCalledTimes(1)
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  it('reconciles a late close without repeating the follow-up', async () => {
    let releaseClose!: () => void
    const pendingClose = new Promise<void>((resolve) => { releaseClose = resolve })
    const close = vi.fn(() => pendingClose)
    const { controller, deps } = harness({ close, timeoutMs: 5 })
    await expect(controller.submit()).rejects.toMatchObject({ stage: 'closing', code: 'timeout' })
    const retry = controller.retry()
    releaseClose()
    await expect(retry).resolves.toBe(true)
    expect(deps.close).toHaveBeenCalledTimes(1)
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  it('completes 30 sequential one-tap submissions without duplicate stages', async () => {
    const { controller, deps } = harness()
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await expect(controller.submit()).resolves.toBe(true)
    }
    expect(deps.exportBlob).toHaveBeenCalledTimes(30)
    expect(deps.upload).toHaveBeenCalledTimes(30)
    expect(deps.attach).toHaveBeenCalledTimes(30)
    expect(deps.send).toHaveBeenCalledTimes(30)
    expect(deps.close).toHaveBeenCalledTimes(30)
  })
})
