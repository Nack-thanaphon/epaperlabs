import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

test('PWA icons are present for install prompts', () => {
  assert.equal(existsSync('public/favicon.svg'), true)
  assert.equal(existsSync('public/apple-touch-icon.png'), true)
  assert.equal(existsSync('public/pwa-192x192.png'), true)
  assert.equal(existsSync('public/pwa-512x512.png'), true)
})
