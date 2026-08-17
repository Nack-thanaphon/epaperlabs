interface ProblemPanelProps {
  problem: string
}

// ChatGPT commonly passes plain-text math such as x^2. Render a caret exponent
// as real superscript while keeping all other text as safe React text nodes.
function renderProblem(problem: string) {
  return problem.split(/(\^(?:\{[^{}]*\}|[+-]?\d+|[A-Za-z]))/g).map((part, index) => {
    if (!part.startsWith('^')) return part
    const exponent = part.slice(1).replace(/^\{(.+)\}$/, '$1')
    return <sup key={`${part}-${index}`}>{exponent}</sup>
  })
}

export function ProblemPanel({ problem }: ProblemPanelProps) {
  if (!problem) return null

  return (
    <section className="problemPanel" aria-label="โจทย์">
      <div className="problemText">{renderProblem(problem)}</div>
    </section>
  )
}
