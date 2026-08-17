import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RESOURCE_URI,
  LEGACY_RESOURCE_URIS,
  BOARD_TOOL_ALIASES,
} from '../lib/mcp-app.mjs'

describe('MCP compatibility window', () => {
  test('publishes a current versioned resource URI', () => {
    assert.equal(RESOURCE_URI, 'ui://papa/papa-v11-stay-open.html')
  })

  test('keeps legacy resource URIs that all point at the live widget', () => {
    assert.ok(LEGACY_RESOURCE_URIS.length >= 20)
    assert.equal(new Set(LEGACY_RESOURCE_URIS).size, LEGACY_RESOURCE_URIS.length)
    assert.ok(!LEGACY_RESOURCE_URIS.includes(RESOURCE_URI))
  })

  test('keeps papa plus cached tool aliases on the current URI', () => {
    assert.deepEqual(
      BOARD_TOOL_ALIASES.map(({ name }) => name),
      ['papa', 'paper', 'open_epaper', 'open_epaper_lite']
    )
    for (const alias of BOARD_TOOL_ALIASES) {
      assert.equal(alias.resourceUri, RESOURCE_URI)
    }
  })

  test('papa is the only tool with the tutoring prompt; aliases stay quiet', () => {
    const papa = BOARD_TOOL_ALIASES.find((alias) => alias.name === 'papa')
    const aliases = BOARD_TOOL_ALIASES.filter((alias) => alias.name !== 'papa')
    assert.ok(papa.description.includes('call the tool named papa IMMEDIATELY'))
    for (const alias of aliases) {
      assert.ok(alias.description.includes('Do not call'))
      assert.ok(!alias.description.includes('IMMEDIATELY'))
    }
  })
})
