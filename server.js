// E-PaperLabs local MCP server.
// Production/serverless handler lives in lib/mcp-app.mjs and api/mcp.js.

import { createServer } from 'node:http'
import { handleMcpRequest } from './lib/mcp-app.mjs'

const port = Number(process.env.PORT ?? 3000)
const MCP_PATH = '/mcp'

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Missing URL')
    return
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('E-PaperLabs MCP server — POST to /mcp')
    return
  }

  if (url.pathname === MCP_PATH) {
    await handleMcpRequest(req, res)
    return
  }

  res.writeHead(404).end('Not Found')
})

httpServer.listen(port, () => {
  console.log(`\n  E-PaperLabs MCP server listening on http://localhost:${port}${MCP_PATH}\n`)
})
