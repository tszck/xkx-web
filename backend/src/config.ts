import dotenv from 'dotenv'
dotenv.config()

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error('ERROR: DATABASE_URL environment variable must be set. Check .env file or system environment.')
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  worldDataSource: process.env.WORLD_DATA_SOURCE ?? 'json',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  tickIntervalMs: 2000,
  autoSaveIntervalTicks: 30,  // every 60s
  wsActionDebounceMs: 500,
} as const
