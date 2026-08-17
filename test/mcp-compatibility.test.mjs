import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RESOURCE_URI,
  LEGACY_RESOURCE_URIS,
  BOARD_TOOL_ALIASES,
} from '../lib/mcp-app.mjs'

// 2026-08-17: owner retired the compatibility window. The accumulated
// aliases (paper / open_epaper / open_epaper_lite) and 22 legacy resource
// URIs made ChatGPT's connector cache serve stale metadata, producing
// "Board ready" tool cards with no widget. The contract is now: exactly ONE
// tool and ONE resource, version-bumped so caches must refetch.
describe('MCP single-tool contract', () => {
  test('publishes exactly one versioned resource URI', () => {
    assert.equal(RESOURCE_URI, 'ui://papa/papa-v10-single-tool.html')
  })

  test('retires every legacy resource URI', () => {
    assert.equal(LEGACY_RESOURCE_URIS.length, 0)
  })

  test('publishes exactly one tool named papa', () => {
    assert.deepEqual(
      BOARD_TOOL_ALIASES.map(({ name }) => name),
      ['papa']
    )
    assert.equal(BOARD_TOOL_ALIASES[0].resourceUri, RESOURCE_URI)
  })
})
