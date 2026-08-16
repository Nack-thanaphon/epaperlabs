import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RESOURCE_URI,
  LEGACY_RESOURCE_URIS,
  BOARD_TOOL_ALIASES,
} from '../lib/mcp-app.mjs'

const expectedLegacyResources = [
  'ui://epaperlabs/tldraw-board-v1.html',
  'ui://epaperlabs/tldraw-board-v2-cache-bust.html',
  'ui://epaperlabs/tldraw-board-v3-external-assets.html',
  'ui://epaperlabs/lightweight-freehand-board-v4.html',
  'ui://epaperlabs/epaper-lite-v5-no-tldraw.html',
  'ui://epaperlabs/paper-v6-auto-open.html',
  'ui://epaperlabs/paper-v7-tall-writing-area.html',
  'ui://epaperlabs/paper-v8-ipad-gesture-lock.html',
  'ui://epaperlabs/paper-v9-ipad-pencil-fix.html',
  'ui://epaperlabs/paper-v10-ipad-pencil-capture.html',
  'ui://epaperlabs/paper-v11-ipad-capture-safe.html',
  'ui://epaperlabs/paper-v12-domain-clean.html',
  'ui://epaperlabs/paper-v13-fullscreen-problem.html',
  'ui://epaperlabs/paper-v14-true-fullscreen.html',
  'ui://epaperlabs/paper-v15-compact-launcher.html',
  'ui://papa/papa-v1-compact-launcher.html',
  'ui://papa/papa-v2-math-superscripts.html',
  'ui://papa/papa-v3-reliable-submit.html',
  'ui://papa/papa-v4-bottom-launcher.html',
  'ui://papa/papa-v5-undo-redo-touch.html',
  'ui://papa/papa-v6-stable-workflow.html',
  'ui://papa/papa-v7-one-row-controls.html',
]

describe('MCP compatibility contract', () => {
  test('publishes the compact top-toolbar v8 resource as current', () => {
    assert.equal(RESOURCE_URI, 'ui://papa/papa-v8-compact-top-toolbar.html')
  })

  test('keeps every previously published resource URI', () => {
    for (const uri of expectedLegacyResources) {
      assert.ok(LEGACY_RESOURCE_URIS.includes(uri), `missing legacy resource ${uri}`)
    }
    assert.equal(new Set(LEGACY_RESOURCE_URIS).size, LEGACY_RESOURCE_URIS.length)
    assert.ok(!LEGACY_RESOURCE_URIS.includes(RESOURCE_URI))
  })

  test('keeps cached tool aliases routed to the current widget', () => {
    assert.deepEqual(
      BOARD_TOOL_ALIASES.map(({ name }) => name),
      ['papa', 'paper', 'open_epaper', 'open_epaper_lite']
    )
    for (const alias of BOARD_TOOL_ALIASES) assert.equal(alias.resourceUri, RESOURCE_URI)
  })
})
