import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Prefer the built tldraw board; fallback to the legacy manual canvas during dev.
const builtWidgetPath = join(rootDir, 'dist', 'index.html')
const docsWidgetPath = join(rootDir, 'docs', 'index.html')
const fallbackWidgetPath = join(rootDir, 'public', 'canvas.html')
const widgetPath = existsSync(builtWidgetPath)
  ? builtWidgetPath
  : existsSync(docsWidgetPath)
    ? docsWidgetPath
    : fallbackWidgetPath

const widgetHtml = readFileSync(widgetPath, 'utf8')
export const RESOURCE_URI = 'ui://epaperlabs/tldraw-board-v1.html'

export function createEpaperServer() {
  const server = new McpServer({
    name: 'epaperlabs-server',
    version: '0.1.0',
  })

  registerAppResource(
    server,
    'epaper-tldraw-board',
    RESOURCE_URI,
    {},
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: { prefersBorder: true },
          },
        },
      ],
    })
  )

  registerAppTool(
    server,
    'open_epaper',
    {
      title: 'Open E-PaperLabs board',
      description:
        'Open E-PaperLabs, an inline tldraw handwriting board inside the current ChatGPT conversation. ' +
        'Use this tool proactively whenever the user needs to solve a math problem, write equations, ' +
        'show handwritten work, draw a diagram, or answer using Apple Pencil, touch, or mouse. ' +
        'Thai trigger phrases include: ขอโจทย์, เปิดกระดาษ, เปิด canvas, ให้ผมเขียนคำตอบ, เขียนคำตอบ, ' +
        'ขอแบบฝึกหัด, ตรวจลายมือ, ขอพื้นที่เขียน. ' +
        'Typical tutoring flow: first write exactly one short problem in the assistant message, then call this tool immediately after that problem so the board appears BELOW the problem. ' +
        'Do not put explanation below the board until after the user submits. ' +
        'The board supports GoodNotes-like draw, eraser, zoom, pan, selection, and Submit. ' +
        'After the user presses Submit, their handwriting is returned as an image in the same conversation for review. ' +
        'Do not ask the user to download, upload, screenshot, copy, or paste anything.',
      inputSchema: {},
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
        'openai/toolInvocation/invoking': 'Opening board…',
        'openai/toolInvocation/invoked': 'Board ready.',
      },
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: 'E-PaperLabs board is open. Write your answer, then press Submit.',
        },
      ],
    })
  )

  return server
}

export async function handleMcpRequest(req, res) {
  const method = req.method ?? 'GET'

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  if (!['POST', 'GET', 'DELETE'].includes(method)) {
    res.writeHead(405, { ...corsHeaders(), 'content-type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  for (const [key, value] of Object.entries(corsHeaders())) {
    res.setHeader(key, value)
  }

  // The MCP SDK requires BOTH application/json and text/event-stream.
  // Some clients send only one or wildcard, so normalize before handoff.
  const acc = req.headers.accept ?? ''
  const parts = [acc]
  if (!String(acc).includes('application/json')) parts.push('application/json')
  if (!String(acc).includes('text/event-stream')) parts.push('text/event-stream')
  req.headers.accept = parts.filter(Boolean).join(', ')

  const server = createEpaperServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  res.on?.('close', () => {
    transport.close()
    server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res)
  } catch (error) {
    console.error('MCP error:', error)
    if (!res.headersSent) {
      res.writeHead(500, { ...corsHeaders(), 'content-type': 'text/plain' })
      res.end('Internal server error')
    }
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'content-type, mcp-session-id, accept',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  }
}
