import { Router } from 'express'
import authRouter from './auth'
import helpRouter from './help'
import playerRouter from './player'
import worldRouter from './world'

const router = Router()

router.use('/auth', authRouter)
router.use('/help', helpRouter)
router.use('/player', playerRouter)
router.use('/world', worldRouter)

export default router
