'use client'

import { useEffect, useState } from 'react'
import { computeTheme, stageProgressToHour, DayTheme } from './dayTheme'

const STAGE_DURATION_MS = 20_000

interface SimLike {
  stageIndex: number
  startedAt: number
}

export interface DayTimeResult {
  timeOfDay: number   // 0–24 continuous float
  theme: DayTheme
}

export function useDayTime(sim: SimLike): DayTimeResult {
  const [timeOfDay, setTimeOfDay] = useState<number>(() =>
    stageProgressToHour(sim.stageIndex, 0)
  )

  useEffect(() => {
    const tick = () => {
      const elapsed  = Date.now() - sim.startedAt
      const progress = Math.min(elapsed / STAGE_DURATION_MS, 1)
      setTimeOfDay(stageProgressToHour(sim.stageIndex, progress))
    }
    tick()
    const id = setInterval(tick, 1000)   // 1s is plenty — stage lasts 20s
    return () => clearInterval(id)
  }, [sim.stageIndex, sim.startedAt])

  return { timeOfDay, theme: computeTheme(timeOfDay) }
}
