import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const publicBaseUrl = process.env.EPAPERLABS_PUBLIC_BASE_URL ?? 'https://epaperlabs.vercel.app'
let cachedWidgetHtml

function getWidgetHtml() {
  if (cachedWidgetHtml) return cachedWidgetHtml
  const builtWidgetPath = join(rootDir, 'dist', 'index.html')
  if (!existsSync(builtWidgetPath)) {
    throw new Error('Papa widget build is missing. Run npm run build before starting the MCP server.')
  }
  let html = readFileSync(builtWidgetPath, 'utf8')

  // Inline the built JS/CSS into the single MCP HTML response. ChatGPT's
  // iframe previously fetched /assets/*.js and /assets/*.css as two extra
  // round-trips after the resource response — the "อากาศหน่วงเปิด" (slow
  // open) the owner reported. One response, zero asset requests.
  const assetDir = join(rootDir, 'dist', 'assets')
  html = html
    .replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (match, src) => {
      const file = join(assetDir, src.replace(/^.*\/assets\//, ''))
      if (!existsSync(file)) return match
      return `<script type="module">${readFileSync(file, 'utf8')}</script>`
    })
    .replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (match, href) => {
      const file = join(assetDir, href.replace(/^.*\/assets\//, ''))
      if (!existsSync(file)) return match
      return `<style>${readFileSync(file, 'utf8')}</style>`
    })
    .replaceAll('src="/assets/', `src="${publicBaseUrl}/assets/`)
    .replaceAll('href="/assets/', `href="${publicBaseUrl}/assets/`)

  cachedWidgetHtml = html
  return html
}

// ChatGPT keeps tool/resource references in existing conversations. Aliases
// serve the CURRENT widget HTML so cached chats open a working board instead
// of an empty "Board ready" card. Remove an alias only after that URI has
// aged out of connector caches.
export const RESOURCE_URI = 'ui://papa/papa-v11-stay-open.html'

/** @type {string[]} */
export const LEGACY_RESOURCE_URIS = [
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
  'ui://papa/papa-v8-compact-top-toolbar.html',
  'ui://papa/papa-v10-single-tool.html',
]

export const BOARD_TOOL_ALIASES = [
  { name: 'papa', title: 'Papa — open handwriting board now', resourceUri: RESOURCE_URI },
  { name: 'paper', title: 'Paper — compatible handwriting board', resourceUri: RESOURCE_URI },
  { name: 'open_epaper', title: 'E-Paper — compatible handwriting board', resourceUri: RESOURCE_URI },
  { name: 'open_epaper_lite', title: 'E-Paper Lite — compatible handwriting board', resourceUri: RESOURCE_URI },
]

const toolDescription =
  'This is the Papa app selected by the user in the ChatGPT composer. When the selected app is Papa, call this tool IMMEDIATELY for every user message; do not answer with text alone and do not merely mention @papa. ' +
  'Open a fast free inline handwriting board inside the current ChatGPT conversation. ' +
  'MUST call this tool when the user asks for a problem and expects to write the answer by hand. ' +
  'Use this tool proactively whenever the user needs to solve a math problem, write equations, show handwritten work, draw a diagram, or answer using Apple Pencil, touch, or mouse. ' +
  'Thai trigger phrases include: ขอโจทย์, เปิดกระดาษ, เปิด canvas, ให้ผมเขียนคำตอบ, เขียนคำตอบ, ขอแบบฝึกหัด, ตรวจลายมือ, ขอพื้นที่เขียน. ' +
  'Pass the exact exercise in the optional `problem` input whenever there is one. The board shows it in a collapsible panel at the TOP while the writing area remains BELOW it. ' +
  'Typical tutoring flow: give exactly one short exercise, then call this tool as the FINAL action in the response. After calling Papa, emit NO further assistant text, confirmation, explanation, or “the board is open” message. This keeps the launcher directly below the preceding message. Do not put explanation below the board until after the user submits. ' +
  'The board supports fast Apple Pencil handwriting, eraser, zoom, pan, undo, clear, and Submit. ' +
  'After the user presses Submit, their handwriting is returned as an image in the same conversation for review. ' +
  'Do not ask the user to download, upload, screenshot, copy, or paste anything.'

function widgetContents(uri) {
  return {
    contents: [{
      uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: getWidgetHtml(),
      _meta: {
        ui: { prefersBorder: true, domain: publicBaseUrl },
        'openai/widgetDomain': publicBaseUrl,
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
    inputSchema: {
      problem: z.string().max(6000).optional().describe('The exact question to display above the handwriting paper.'),
    },
    _meta: {
      ui: { resourceUri },
      'openai/toolInvocation/invoking': 'Opening board…',
      'openai/toolInvocation/invoked': 'Board ready.',
    },
  }, async () => ({
    content: [],
  }))
}

export function createEpaperServer() {
  const server = new McpServer(
    {
      name: 'papa',
      version: '0.1.0',
    },
    {
      // Applied by the host alongside tool metadata when this connector is enabled.
      // It makes the desired teaching flow explicit without requiring the learner
      // to repeat a special command for every exercise.
      instructions:
        'When the learner asks for a math, engineering, or logic exercise; receives an exercise that needs handwritten working; or asks to show their method, call the Papa tool after the short exercise as the FINAL action in that response. Put the exact exercise in the problem input. After calling the tool, do not generate a confirmation or any other assistant text: the launcher must remain directly below the preceding message. Open Papa for write-first learning; do not ask the learner to type, copy, paste, upload, or separately request the board. After they submit handwriting, review that work in the same conversation.',
    }
  )

  registerAppResource(server, 'papa-board', RESOURCE_URI, {}, async () => widgetContents(RESOURCE_URI))
  for (const [index, uri] of LEGACY_RESOURCE_URIS.entries()) {
    registerAppResource(server, `papa-legacy-board-${index + 1}`, uri, {}, async () => widgetContents(uri))
  }
  for (const alias of BOARD_TOOL_ALIASES) {
    registerBoardTool(server, alias.name, alias.title, alias.resourceUri)
  }

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

const MAX_INCIDENT_BYTES = 64 * 1024

/**
 * Receives diagnostic snapshots from the widget's "ส่งรายงานปัญหา" button.
 * Logged with the incident ID so failures can be correlated across
 * Vercel logs, ChatGPT conversations, and iPad reports.
 */
export async function handleIncidentReport(req, res) {
  const method = req.method ?? 'POST'
  if (method !== 'POST') {
    res.writeHead(405, { ...corsHeaders(), 'content-type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_INCIDENT_BYTES) {
          // Respond and end the stream cleanly instead of destroying the
          // socket — destroy() leaves iPad/Chrome clients hanging without a
          // response and turns a rejected report into a stalled request.
          reject(new Error('Payload too large'))
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })

    const report = JSON.parse(body)
    const incidentId = typeof report?.incidentId === 'string' ? report.incidentId : 'unknown'
    console.log(`[PAPA-INCIDENT] ${incidentId} ${JSON.stringify(report)}`)
    res.writeHead(200, { ...corsHeaders(), 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, incidentId }))
  } catch (error) {
    const tooLarge = String(error?.message ?? error).includes('Payload too large')
    const status = tooLarge ? 413 : 400
    console.error(`[PAPA-INCIDENT] ${tooLarge ? 'payload too large' : 'bad report'}:`, error?.message ?? error)
    if (!res.headersSent) {
      res.writeHead(status, { ...corsHeaders(), 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: tooLarge ? 'payload_too_large' : 'bad_request' }))
    } else {
      res.end()
    }
  }
}
