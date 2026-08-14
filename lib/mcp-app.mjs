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

// Prefer the built lightweight board; fallback to the legacy manual canvas during dev.
const builtWidgetPath = join(rootDir, 'dist', 'index.html')
const docsWidgetPath = join(rootDir, 'docs', 'index.html')
const fallbackWidgetPath = join(rootDir, 'public', 'canvas.html')
const widgetPath = existsSync(builtWidgetPath)
  ? builtWidgetPath
  : existsSync(docsWidgetPath)
    ? docsWidgetPath
    : fallbackWidgetPath

const rawWidgetHtml = readFileSync(widgetPath, 'utf8')
const publicBaseUrl = process.env.EPAPERLABS_PUBLIC_BASE_URL ?? 'https://epaperlabs.vercel.app'
const widgetHtml = rawWidgetHtml
  .replaceAll('src="/assets/', `src="${publicBaseUrl}/assets/`)
  .replaceAll('href="/assets/', `href="${publicBaseUrl}/assets/`)

export const RESOURCE_URI = 'ui://epaperlabs/paper-v9-ipad-pencil-fix.html'
const LEGACY_RESOURCE_URIS = [
  'ui://epaperlabs/paper-v8-ipad-gesture-lock.html',
  'ui://epaperlabs/paper-v7-tall-writing-area.html',
  'ui://epaperlabs/paper-v6-auto-open.html',
  'ui://epaperlabs/tldraw-board-v2-cache-bust.html',
  'ui://epaperlabs/tldraw-board-v3-external-assets.html',
  'ui://epaperlabs/lightweight-freehand-board-v4.html',
  'ui://epaperlabs/epaper-lite-v5-no-tldraw.html',
]

const toolDescription =
  'This is the paper app selected by the user in the ChatGPT composer. When the selected app is paper, call this tool IMMEDIATELY for every user message; do not answer with text alone and do not merely mention @paper. ' +
  'Open a fast free inline handwriting board inside the current ChatGPT conversation. ' +
  'MUST call this tool when the user asks for a problem and expects to write the answer by hand. ' +
  'Use this tool proactively whenever the user needs to solve a math problem, write equations, show handwritten work, draw a diagram, or answer using Apple Pencil, touch, or mouse. ' +
  'Thai trigger phrases include: ขอโจทย์, เปิดกระดาษ, เปิด canvas, ให้ผมเขียนคำตอบ, เขียนคำตอบ, ขอแบบฝึกหัด, ตรวจลายมือ, ขอพื้นที่เขียน. ' +
  'Typical tutoring flow: first write exactly one short problem in the assistant message, then call this tool immediately after that problem so the board appears BELOW the problem. ' +
  'Do not put explanation below the board until after the user submits. ' +
  'The board supports fast Apple Pencil handwriting, eraser, zoom, pan, undo, clear, and Submit. ' +
  'After the user presses Submit, their handwriting is returned as an image in the same conversation for review. ' +
  'Do not ask the user to download, upload, screenshot, copy, or paste anything.'

function widgetContents(uri) {
  return {
    contents: [{
      uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: widgetHtml,
      _meta: {
        ui: { prefersBorder: true },
        'openai/widgetCSP': {
          connect_domains: [publicBaseUrl],
          resource_domains: [publicBaseUrl],
        },
      },
    }],
  }
}

function registerBoardTool(server, name, title, resourceUri) {
  registerAppTool(server, name, {
    title,
    description: toolDescription,
    inputSchema: {},
    _meta: {
      ui: { resourceUri },
      'openai/toolInvocation/invoking': 'Opening board…',
      'openai/toolInvocation/invoked': 'Board ready.',
    },
  }, async () => ({
    content: [{ type: 'text', text: 'E-PaperLabs board is open. Write your answer, then press Submit.' }],
  }))
}

export function createEpaperServer() {
  const server = new McpServer({
    name: 'epaperlabs-server',
    version: '0.1.0',
  })

  registerAppResource(server, 'epaper-lightweight-board', RESOURCE_URI, {}, async () => widgetContents(RESOURCE_URI))
  for (const [index, uri] of LEGACY_RESOURCE_URIS.entries()) {
    registerAppResource(server, `epaper-legacy-board-${index + 2}`, uri, {}, async () => widgetContents(uri))
  }

  // Keep tool aliases during ChatGPT's connector metadata-cache window.
  // All aliases serve the current lightweight board; none load tldraw.
  registerBoardTool(server, 'paper', 'paper — open handwriting board now', RESOURCE_URI)
  registerBoardTool(server, 'open_epaper_lite', 'E-Paper Lite — compatible board', 'ui://epaperlabs/epaper-lite-v5-no-tldraw.html')
  registerBoardTool(server, 'open_epaper', 'E-PaperLabs — compatible board', 'ui://epaperlabs/lightweight-freehand-board-v4.html')

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
