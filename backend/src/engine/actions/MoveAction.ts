import type { GameSession } from '../GameSession'
import { movementService } from '../movement/MovementService'

export class MoveAction {
  async execute(session: GameSession, payload: { direction: string }) {
    await movementService.move(session, payload.direction)
  }
}
