import { describe, expect, it } from 'vitest'

declare const process: {
  getBuiltinModule(name: 'fs'): { readFileSync(path: URL, encoding: 'utf8'): string }
}

const css = process.getBuiltinModule('fs').readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const appSource = process.getBuiltinModule('fs').readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? ''
}

describe('bottom controls layout', () => {
  it('keeps every bottom control group on one non-wrapping row', () => {
    const controls = rule('.bottomControls')
    expect(controls).toContain('display: flex')
    expect(controls).toContain('flex-wrap: nowrap')
    expect(css).not.toMatch(/@media\s*\(max-width:\s*600px\)[\s\S]*?\.bottomControls\s*\{[^}]*grid-template-columns/)
  })

  it('lets drawing tools scroll while action buttons stay fixed', () => {
    expect(rule('.floatingTools')).toContain('overflow-x: auto')
    expect(rule('.floatingTools')).toContain('flex: 1 1 auto')
    expect(rule('.bottomBar')).toContain('flex: 0 0 auto')
  })

  it('places the compact controls above the problem and paper', () => {
    expect(appSource.indexOf('className="bottomControls"')).toBeLessThan(appSource.indexOf('<ProblemPanel'))
    expect(appSource.indexOf('<ProblemPanel')).toBeLessThan(appSource.indexOf('<DrawingBoard'))
    expect(rule('.appShell.writingMode')).toContain('grid-template-rows: auto auto 1fr')
    expect(rule('.bottomControls')).toContain('max-height: 56px')
    expect(rule('.bottomControls')).toContain('padding-bottom: 0')
  })
})
