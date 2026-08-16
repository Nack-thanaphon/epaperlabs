import { handleIncidentReport } from '../lib/mcp-app.mjs'

export const config = {
  maxDuration: 30,
}

export default async function handler(req, res) {
  await handleIncidentReport(req, res)
}
