import { Router, Request, Response } from 'express'
import { worldLoader } from '../engine/world/WorldLoader'

const router = Router()

router.get('/rooms', (_req: Request, res: Response) => {
  const rooms = worldLoader.getAllRoomSummaries()
  res.json(rooms)
})

router.get('/room/:id(*)', (req: Request, res: Response) => {
  const room = worldLoader.getRoom(req.params['id'] as string)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json(room)
})

router.get('/npc/:id(*)', (req: Request, res: Response) => {
  const npc = worldLoader.getNpc(req.params['id'] as string)
  if (!npc) return res.status(404).json({ error: 'NPC not found' })
  res.json(npc)
})

router.get('/item/:id(*)', (req: Request, res: Response) => {
  const item = worldLoader.getItem(req.params['id'] as string)
  if (!item) return res.status(404).json({ error: 'Item not found' })
  res.json(item)
})

router.get('/skill/:id', (req: Request, res: Response) => {
  const skill = worldLoader.getSkill(req.params['id'] as string)
  if (!skill) return res.status(404).json({ error: 'Skill not found' })
  res.json(skill)
})

export default router
