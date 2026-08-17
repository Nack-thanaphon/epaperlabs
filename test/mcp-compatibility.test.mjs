import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RESOURCE_URI,
  BOARD_TOOL_ALIASES,
} from '../lib/mcp-app.mjs'

describe('MCP single-tool contract', () => {
  test('publishes exactly one versioned resource URI', () => {
    assert.equal(RESOURCE_URI, 'ui://papa/papa-v12-local.html')
  })

  test('publishes exactly one tool named papa', () => {
    assert.deepEqual(
      BOARD_TOOL_ALIASES.map(({ name }) => name),
      ['papa']
    )
    assert.equal(BOARD_TOOL_ALIASES[0].resourceUri, RESOURCE_URI)
    assert.ok(BOARD_TOOL_ALIASES[0].description.includes('call the tool named papa IMMEDIATELY'))
  })
})
