import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { handleIncidentReport } from '../lib/mcp-app.mjs'

function request(port, path, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const options = { host: '127.0.0.1', port, path, method, headers: {} }
    const r = httpRequest(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    r.on('error', (err) => resolve({ status: 0, body: String(err?.code ?? err) }))
    if (body) {
      r.setHeader('content-type', 'application/json')
      r.write(JSON.stringify(body))
    }
    r.end()
  })
}

test('POST /api/incident accepts a diagnostic snapshot and echoes the incident id', async () => {
  const server = createServer((req, res) => handleIncidentReport(req, res))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const response = await request(port, '/api/incident', 'POST', {
    incidentId: 'PAPA-TEST-42',
    code: 'E04',
    events: [],
    metrics: { canvasReadyMs: 286, fullscreenActivationMs: null, firstInkLatencyMs: null },
    context: { buildVersion: 'papa-v14-answer', displayMode: 'inline', bridgeReady: true },
  })

  assert.equal(response.status, 200)
  const parsed = JSON.parse(response.body)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.incidentId, 'PAPA-TEST-42')

  server.close()
})

test('POST /api/incident rejects payloads over 64KB', async () => {
  const server = createServer((req, res) => handleIncidentReport(req, res))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const huge = { incidentId: 'PAPA-BIG', filler: 'x'.repeat(70 * 1024) }
  const response = await request(port, '/api/incident', 'POST', huge)

  assert.ok([0, 400, 408, 413].includes(response.status) || response.body === '')
  server.close()
})

test('GET /api/incident is rejected with 405', async () => {
  const server = createServer((req, res) => handleIncidentReport(req, res))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const response = await request(port, '/api/incident', 'GET')
  assert.equal(response.status, 405)
  server.close()
})
