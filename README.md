# E-PaperLabs

E-PaperLabs is a proof-of-concept ChatGPT App / MCP App that opens a handwriting board inside an existing ChatGPT conversation.

The goal is **WRITE → SUBMIT**:

```text
ChatGPT asks a question
→ E-PaperLabs board appears inline below the problem
→ user writes with Apple Pencil / finger / mouse
→ user presses Submit
→ the board exports PNG
→ ChatGPT receives the image in the same conversation
→ ChatGPT reviews the handwritten work
```

## Current status

✅ MCP server works through Cloudflare Tunnel  
✅ Inline ChatGPT widget opens  
✅ Board now uses `tldraw` instead of a manual canvas  
✅ Built-in draw, eraser, zoom, pan, selection UI  
✅ Submit exports board as PNG via `editor.toImage()`  
✅ ChatGPT flow uses `window.openai.uploadFile()` → `setWidgetState({ imageIds })` → `sendFollowUpMessage()`  
✅ Tests pass: `20/20`  

## Important architecture note

GitHub Pages can host the static board demo, but **GitHub Pages cannot host the MCP server**.

So there are two URLs:

1. **ChatGPT MCP URL** — real app connection:

```text
https://my-mac-tunnel.tap-on-it.com/mcp
```

This points to the local Mac server on port `3000` through Cloudflare Tunnel.

2. **GitHub Pages URL** — static demo only:

```text
https://nack-thanaphon.github.io/epaperlabs/
```

The Pages version is useful for checking the board UI, but outside ChatGPT it cannot call `window.openai`, so Submit falls back to local download.

## Run locally

```bash
cd /Users/jarvis/epaperlabs
npm install
npm run build
npm start
```

MCP endpoint:

```text
http://localhost:3000/mcp
```

Tunnel endpoint:

```text
https://my-mac-tunnel.tap-on-it.com/mcp
```

## Cloudflare Tunnel

The tunnel config is in:

```text
~/.cloudflared/config.yaml
```

It should point to:

```yaml
- hostname: my-mac-tunnel.tap-on-it.com
  service: http://localhost:3000
```

Run tunnel:

```bash
cloudflared tunnel run my-mac-tunnel
```

## ChatGPT setup

1. Open ChatGPT settings.
2. Enable **Developer mode**.
3. Go to:

```text
https://chatgpt.com/plugins
```

4. Add or refresh E-PaperLabs.
5. MCP URL:

```text
https://my-mac-tunnel.tap-on-it.com/mcp
```

6. Authentication: **None**.
7. Start a new chat.
8. Enable the E-PaperLabs tool.
9. Prompt:

```text
ขอโจทย์
```

## Recommended learning prompt

```text
คุณเป็นติวเตอร์คณิตของผม
ให้โจทย์ทีละข้อ
หลังโจทย์ให้เปิด E-PaperLabs board ใต้โจทย์ทันที
อย่าเฉลยก่อนผม Submit
หลังผมกด Submit ให้ตรวจลายมือ อธิบายเป็นภาษาไทยง่าย ๆ และบอกจุดผิดถ้ามี
```

## Development commands

```bash
npm test       # node:test logic tests
npm run build  # build single-file tldraw widget for MCP + GitHub Pages
npm start      # run MCP server on port 3000
```

## Known limitations

1. **ChatGPT controls final layout.** The tool description asks ChatGPT to place the board below the problem, but MCP cannot hard-control host message layout.
2. **GitHub Pages is static only.** It cannot replace the MCP server.
3. **tldraw production licensing.** `tldraw` is excellent for this POC, but production/commercial use may require reviewing tldraw's license.
4. **iPad still needs real-device testing.** The board should behave better than manual canvas because tldraw has built-in pan/zoom/draw handling, but Apple Pencil behavior must be verified on the actual iPad.
5. **Standalone Submit downloads.** Outside ChatGPT, `window.openai` is unavailable, so Submit downloads a PNG for demo/testing.

## Why tldraw?

The earlier manual canvas worked, but maintaining GoodNotes-like behavior manually is expensive:

- pinch zoom
- pan
- eraser
- selection
- shape deletion
- mobile/touch gestures
- export/crop
- undo/redo stack

`tldraw` provides these as a mature board/editor engine, so E-PaperLabs can focus on the ChatGPT submission flow.

## Sources

- OpenAI Apps SDK / MCP UI: `developers.openai.com/plugins/reference.md`
- OpenAI connect/test docs: `developers.openai.com/plugins/deploy/connect-chatgpt.md`
- MCP Apps spec: `modelcontextprotocol.io/extensions/apps/overview.md`
- tldraw package: `npmjs.com/package/tldraw`
