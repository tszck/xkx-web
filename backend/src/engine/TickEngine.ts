// TickEngine is currently embedded in GameSession per-player tick.
// This module is reserved for future cross-session tick orchestration
// (e.g., world events, NPC patrol schedules, weather cycles).

export class TickEngine {
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners: Array<(tick: number) => void> = []
  private tick = 0

  start(intervalMs: number) {
    this.timer = setInterval(() => {
      this.tick++
      this.listeners.forEach(cb => cb(this.tick))
    }, intervalMs)
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  on(cb: (tick: number) => void) {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }
}

export const globalTick = new TickEngine()
