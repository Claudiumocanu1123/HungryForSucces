'use client'

import { useState, useEffect, useCallback } from 'react'

export interface NPCPersonalization {
  alias?: string
  emoji?: string
  note?: string
}

export interface PlayerProfile {
  name: string
  emoji: string
  avatarSeed: string   // DiceBear seed — defaults to name if empty
  lat: number
  lng: number
  city: string
  npcPersonalizations: Record<string, NPCPersonalization>
  hasCompletedIntro: boolean
}

const DEFAULT_PROFILE: PlayerProfile = {
  name: '',
  emoji: '🧑',
  avatarSeed: '',
  lat: 45.9432,
  lng: 24.9668,
  city: 'România',
  npcPersonalizations: {},
  hasCompletedIntro: false,
}

const STORAGE_KEY = 'lifesim_player_profile'

export function usePlayerProfile() {
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) })
      }
    } catch {}
    setLoaded(true)
  }, [])

  const saveProfile = useCallback((updates: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const updateNpcPersonalization = useCallback((npcId: string, data: Partial<NPCPersonalization>) => {
    setProfile((prev) => {
      const next = {
        ...prev,
        npcPersonalizations: {
          ...prev.npcPersonalizations,
          [npcId]: { ...prev.npcPersonalizations[npcId], ...data },
        },
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { profile, saveProfile, updateNpcPersonalization, loaded }
}
