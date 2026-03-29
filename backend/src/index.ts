import express from 'express'
import http from 'http'
import rateLimit from 'express-rate-limit'
import { config } from './config'
import apiRouter from './api/router'
import { attachWsServer } from './ws/server'
import { worldLoader } from './engine/world/WorldLoader'

async function main() {
  await worldLoader.load()

  const app = express()
  app.use(express.json())

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.corsOrigin)
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    next()
  })

  app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }), apiRouter)

  const server = http.createServer(app)
  attachWsServer(server)

  server.listen(config.port, () => {
    console.log(`xkx-web backend running on port ${config.port}`)
  })
}

main().catch(err => { console.error(err); process.exit(1) })
