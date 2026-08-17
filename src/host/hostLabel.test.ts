import { describe, expect, it } from 'vitest'
import { formatElapsed, hostLabel } from './hostLabel'

describe('hostLabel', () => {
  it('detects Chrome on iPad', () => {
    expect(hostLabel('Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1')).toBe('Chrome')
  })

  it('labels ChatGPT native separately from Chrome', () => {
    expect(hostLabel('Mozilla/5.0 ChatGPT/1.0')).toBe('แอป ChatGPT')
  })
})

describe('formatElapsed', () => {
  it('renders processing seconds in Thai', () => {
    expect(formatElapsed(0)).toBe('ประมวลผล 0s')
    expect(formatElapsed(9200)).toBe('ประมวลผล 9s')
  })
})
