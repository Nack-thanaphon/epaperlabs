// ─── E-PaperLabs MCP Server ──────────────────────────────────────────────────
// Implements the MCP Apps standard (JSON-RPC over HTTP) with a single inline
// UI resource (a handwriting canvas) and one tool that renders it.
//
// Communication flow (from official OpenAI Apps SDK docs):
//   1. ChatGPT calls our "open_epaper" tool.
//   2. The tool's _meta.ui.resourceUri points to our canvas HTML.
//   3. ChatGPT renders the HTML in a sandboxed iframe inside the conversation.
//   4. The user draws on the canvas, presses Submit.
//   5. The canvas widget:
//        a. Converts strokes → PNG via canvas.toDataURL()
//        b. Uploads PNG via window.openai.uploadFile() → gets fileId
//        c. Calls setWidgetState({ imageIds: [fileId], modelContent: "..." })
//        d. Calls sendFollowUpMessage() → posts into SAME conversation
//   6. ChatGPT receives the follow-up (with image context) and responds.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the UI HTML. Prefer the built tldraw board when available; fall back
// to the original manual canvas during early development before `npm run build`.
const builtWidgetPath = join(__dirname, "dist", "index.html");
const fallbackWidgetPath = join(__dirname, "public", "canvas.html");
const canvasHtml = readFileSync(
  existsSync(builtWidgetPath) ? builtWidgetPath : fallbackWidgetPath,
  "utf8"
);

const RESOURCE_URI = "ui://epaperlabs/tldraw-board-v1.html";

function createEpaperServer() {
  const server = new McpServer({
    name: "epaperlabs-server",
    version: "0.1.0",
  });

  // ── Register UI resource ──────────────────────────────────────────────
  // The HTML returned here runs inside a sandboxed iframe in ChatGPT.
  // It contains the drawing canvas, undo/clear/submit buttons, and the
  // JSON-RPC bridge + window.openai extensions for file upload.
  registerAppResource(
    server,
    "epaper-canvas",
    RESOURCE_URI,
    {},
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: canvasHtml,
          _meta: {
            ui: { prefersBorder: true },
          },
        },
      ],
    })
  );

  // ── Register tool ─────────────────────────────────────────────────────
  // The model calls this tool to open the E-Paper canvas. The tool's
  // _meta.ui.resourceUri tells ChatGPT to render our HTML widget.
  registerAppTool(
    server,
    "open_epaper",
    {
      title: "Open E-PaperLabs canvas",
      description:
        "Open E-PaperLabs, an inline handwriting canvas inside the current ChatGPT conversation. " +
        "Use this tool proactively whenever the user needs to solve a math problem, write equations, " +
        "show handwritten work, draw a diagram, or answer using Apple Pencil, touch, or mouse. " +
        "Thai trigger phrases include: ขอโจทย์, เปิดกระดาษ, เปิด canvas, ให้ผมเขียนคำตอบ, เขียนคำตอบ, " +
        "ขอแบบฝึกหัด, ตรวจลายมือ, ขอพื้นที่เขียน. " +
        "Typical tutoring flow: first write exactly one short problem in the assistant message, then call this tool immediately after that problem so the canvas appears BELOW the problem. " +
        "Do not put explanation below the canvas until after the user submits. " +
        "After the user presses Submit, their handwriting is returned as an image in the same conversation for review. " +
        "Do not ask the user to download, upload, screenshot, copy, or paste anything.", 
      inputSchema: {},
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
        "openai/toolInvocation/invoking": "Opening canvas…",
        "openai/toolInvocation/invoked": "Canvas ready.",
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "E-PaperLabs canvas is open. Write your answer, then press Submit.",
          },
        ],
      };
    }
  );

  return server;
}

// ── HTTP server with CORS ──────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3000);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // Health check
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end(
      "E-PaperLabs MCP server — POST to /mcp"
    );
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  // MCP endpoint
  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    // ── Fix Accept header ──────────────────────────────────────────────
    // The MCP SDK's StreamableHTTPServerTransport requires the Accept
    // header to contain BOTH "application/json" and "text/event-stream".
    // ChatGPT may send only one or neither. We normalize the header so
    // the SDK's validation always passes.
    const acc = req.headers.accept ?? "";
    const parts = [acc];
    if (!acc.includes("application/json")) parts.push("application/json");
    if (!acc.includes("text/event-stream")) parts.push("text/event-stream");
    req.headers.accept = parts.filter(Boolean).join(", ");

    const server = createEpaperServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`\n  E-PaperLabs MCP server listening on http://localhost:${port}${MCP_PATH}\n`);
});
