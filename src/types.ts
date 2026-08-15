export type SubmitStatus =
  | 'idle'
  | 'exporting'
  | 'uploading'
  | 'attaching'
  | 'sending'
  | 'closing'
  | 'submitted'
  | 'failed'
  | 'empty'
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
      }) => void | Promise<void>
      sendFollowUpMessage?: (message: { prompt: string; scrollToBottom?: boolean }) => Promise<void>
      requestClose?: () => Promise<void>
      requestDisplayMode?: (request: { mode: 'inline' | 'fullscreen' | 'picture-in-picture' }) => Promise<void>
      displayMode?: 'inline' | 'fullscreen' | 'picture-in-picture'
      safeArea?: { top?: number; right?: number; bottom?: number; left?: number }
      toolInput?: { problem?: string }
    }
  }
}
