export type SubmitStatus = 'idle' | 'submitting' | 'submitted' | 'error' | 'empty'
export type Tool = 'pen' | 'eraser' | 'pan'
export type Point = { x: number; y: number; pressure: number }
export type Stroke = { id: string; points: Point[]; color: string; size: number }
export type Viewport = { scale: number; x: number; y: number }

export type PointerState = {
  id: number
  x: number
  y: number
  pointerType: string
}

declare global {
  interface Window {
    openai?: {
      uploadFile?: (file: File, options?: { library?: boolean }) => Promise<{ fileId: string }>
      setWidgetState?: (state: {
        modelContent?: string
        privateContent?: unknown
        imageIds?: string[]
      }) => void
      sendFollowUpMessage?: (message: { prompt: string; scrollToBottom?: boolean }) => Promise<void>
      requestDisplayMode?: (request: { mode: 'inline' | 'fullscreen' | 'picture-in-picture' }) => Promise<void>
      displayMode?: 'inline' | 'fullscreen' | 'picture-in-picture'
      toolInput?: { problem?: string }
    }
  }
}
