module.exports = {
  apps: [{
    name: 'xkx-backend',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: process.env.DATABASE_URL || (() => { throw new Error('FATAL: DATABASE_URL must be set in environment or .env file'); })(),
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://tszck.github.io',
    },
    error_file: '/var/log/xkx/error.log',
    out_file: '/var/log/xkx/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
