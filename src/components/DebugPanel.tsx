import { useState } from 'react'
import type { DiagnosticSnapshot } from '../diagnostics/launchRecorder'
import { formatDiagnosis } from '../diagnostics/launchRecorder'

interface DebugPanelProps {
  error: DiagnosticSnapshot | null
  onRetry: () => void
  onSendReport: () => Promise<void> | void
  reportState: 'idle' | 'sending' | 'sent' | 'failed'
}

export function DebugPanel({ error, onRetry, onSendReport, reportState }: DebugPanelProps) {
  const [open, setOpen] = useState(false)
  if (!error) return null

  const lines = formatDiagnosis(error)

  return (
    <div className="debugPanel" role="alert">
      <div className="debugPanelHead">
        <span className="debugCode">{error.code ?? '—'}</span>
        <div className="debugActions">
          <button className="debugButton" onClick={() => setOpen((v) => !v)}>
            {open ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
          </button>
          <button className="debugButton primary" onClick={onRetry}>
            ลองใหม่
          </button>
          <button
            className="debugButton"
            disabled={reportState === 'sending' || reportState === 'sent'}
            onClick={() => void onSendReport()}
          >
            {reportState === 'sent'
              ? 'ส่งรายงานแล้ว'
              : reportState === 'sending'
                ? 'กำลังส่ง…'
                : reportState === 'failed'
                  ? 'ส่งไม่สำเร็จ — แตะอีกครั้ง'
                  : 'ส่งรายงานปัญหา'}
          </button>
        </div>
      </div>
      {open && (
        <pre className="debugDetail">{lines.join('\n')}</pre>
      )}
    </div>
  )
}
