import { handleMcpRequest } from '../lib/mcp-app.mjs'

export const config = {
  maxDuration: 30,
}

export default async function handler(req, res) {
  await handleMcpRequest(req, res)
}
