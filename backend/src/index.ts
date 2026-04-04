import express from 'express'
import http from 'http'
import rateLimit from 'express-rate-limit'
import { config } from './config'
import apiRouter from './api/router'
import { attachWsServer } from './ws/server'
import { worldLoader } from './engine/world/WorldLoader'

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  const allowList = config.corsOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (allowList.length === 0) return true
  return allowList.includes(origin)
}

async function main() {
  await worldLoader.load()

  const app = express()
  app.use(express.json())

  app.use((_req, res, next) => {
    const origin = _req.headers.origin
    if (isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin ?? '*')
      res.header('Vary', 'Origin')
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    if (_req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    next()
  })

  app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }), apiRouter)

  const server = http.createServer(app)
  attachWsServer(server)

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`xkx-web backend running on port ${config.port}`)
  })
}

main().catch(err => { console.error(err); process.exit(1) })
