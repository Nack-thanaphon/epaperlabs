interface StatusStripProps {
  buildVersion: string
  status: string
  logLine: string
}

export function StatusStrip({ buildVersion, status, logLine }: StatusStripProps) {
  return (
    <div className="statusStrip" aria-live="polite">
      {buildVersion} · {status} · {logLine}
    </div>
  )
}
