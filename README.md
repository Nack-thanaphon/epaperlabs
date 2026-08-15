# Papa

Papa is a lightweight handwriting board embedded in a ChatGPT conversation through MCP Apps.

## Flow

```text
Tap “เปิดเต็มจอเพื่อเขียน”
→ write with Apple Pencil, touch, or mouse
→ Submit
→ ChatGPT receives the handwriting PNG in the same conversation
→ ChatGPT reviews the working
```

## Current design

- Compact inline launcher; the full board renders only after fullscreen opens.
- Fullscreen-only writing, with pointer handling blocked outside fullscreen.
- Canvas + `perfect-freehand` for pen strokes, eraser, pan, zoom, undo, clear, and PNG export.
- Three pen colors: black, blue, red.
- Plain-text caret exponents such as `x^2` render as superscripts in the problem panel.
- Submit uses `uploadFile` → `setWidgetState({ imageIds })` → `sendFollowUpMessage`.

## Commands

```bash
npm test
npm run build
npm start
vercel --prod
```

`npm run build` must run before `npm start`, because the MCP server serves the built Vite widget from `dist/`.

## MCP connector

Use this public endpoint when adding the connector in ChatGPT:

```text
https://epaperlabs.vercel.app/mcp
```

The current MCP server and tool are named `papa`.

## Project structure

```text
src/                 React widget
src/hooks/           board, ChatGPT host, submit logic
src/components/      compact launcher, problem panel, board controls
src/utils/           canvas rendering and PNG export
lib/mcp-app.mjs      MCP server + widget resource
api/mcp.js           Vercel function entrypoint
test/                node:test logic tests
```

## Sources

- https://developers.openai.com/plugins/reference
- https://modelcontextprotocol.io/extensions/apps/overview
