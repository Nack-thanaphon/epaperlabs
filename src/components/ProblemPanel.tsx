import { useState } from 'react'

interface ProblemPanelProps {
  problem: string
}

export function ProblemPanel({ problem }: ProblemPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  // No exercise means no header, label, or placeholder: it is simply blank paper.
  if (!problem) return null

  if (collapsed) {
    return (
      <button className="problemRestore" aria-label="แสดงโจทย์" onClick={() => setCollapsed(false)}>⌄</button>
    )
  }

  return (
    <section className="problemPanel" aria-label="โจทย์">
      <button className="problemCollapse" aria-label="พับโจทย์" onClick={() => setCollapsed(true)}>⌃</button>
      <div className="problemText">{problem}</div>
    </section>
  )
}
