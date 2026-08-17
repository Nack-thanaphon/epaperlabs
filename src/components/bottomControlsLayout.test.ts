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

describe('toolbar layout', () => {
  it('floats a single non-wrapping toolbar over the paper', () => {
    expect(appSource.indexOf('<DrawingBoard')).toBeLessThan(appSource.indexOf('<Toolbar'))
    expect(rule('.toolbar')).toContain('display: flex')
    expect(rule('.toolbar')).toContain('flex-wrap: nowrap')
    expect(rule('.toolbar')).toContain('position: absolute')
  })
})
