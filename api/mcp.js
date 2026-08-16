import { handleMcpRequest, handleIncidentReport } from '../lib/mcp-app.mjs'

export const config = {
  maxDuration: 30,
}

export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname === '/api/incident') {
    await handleIncidentReport(req, res)
    return
  }
  await handleMcpRequest(req, res)
}
