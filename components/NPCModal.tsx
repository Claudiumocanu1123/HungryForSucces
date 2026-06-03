'use client'

import { useState, useEffect } from 'react'
import { NPC } from '@/types'

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'București': { lat: 44.4268, lng: 26.1025 },
  'Cluj-Napoca': { lat: 46.7712, lng: 23.6236 },
  'Iași': { lat: 47.1585, lng: 27.6014 },
  'Timișoara': { lat: 45.7489, lng: 21.2087 },
  'Brașov': { lat: 45.6579, lng: 25.6012 },
}

const TRAIT_OPTIONS = [
  'introvertit', 'extrovertit', 'ambițios', 'relaxat',
  'creativ', 'practic', 'anxios', 'optimist', 'night owl',
]

interface NPCModalProps {
  npc?: NPC | null
  existingNPCs: NPC[]
  onSave: (data: Partial<NPC> & { id?: string }) => void
  onClose: () => void
}

function generateSystemPrompt(name: string, profession: string, age: number, traits: string[]): string {
  const traitStr = traits.join(', ')
  return `Ești un narator care descrie un/o ${profession} de ${age} ani. Trăsături: ${traitStr}. 3-4 propoziții scurte, prezent, persoana a 3-a, română.`
}

export default function NPCModal({ npc, existingNPCs, onSave, onClose }: NPCModalProps) {
  const [name, setName] = useState(npc?.name || '')
  const [age, setAge] = useState(npc?.age || 25)
  const [profession, setProfession] = useState(npc?.profession || '')
  const [city, setCity] = useState(npc?.city || 'București')
  const [budget, setBudget] = useState(npc?.budget_ron || 3000)
  const [traits, setTraits] = useState<string[]>(npc?.traits || [])
  const [friends, setFriends] = useState<string[]>(npc?.friends || [])

  const toggleTrait = (t: string) => {
    setTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  const toggleFriend = (id: string) => {
    setFriends((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleSave = () => {
    if (!name.trim() || !profession.trim()) return
    const coords = CITY_COORDS[city] || { lat: 44.4268, lng: 26.1025 }
    const system_prompt = generateSystemPrompt(name, profession, age, traits)
    onSave({
      id: npc?.id,
      name: name.trim(),
      profession: profession.trim(),
      age,
      city,
      lat: coords.lat,
      lng: coords.lng,
      traits,
      friends,
      base_energy: npc?.base_energy || 75,
      base_social: npc?.base_social || 50,
      budget_ron: budget,
      system_prompt,
    })
  }

  const budgetLabel = budget < 1500 ? 'Buget mic' : budget <= 6000 ? 'Buget mediu' : 'Buget mare'
  const budgetColor = budget < 1500 ? '#ff4444' : budget <= 6000 ? '#ffd700' : '#00ff88'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: 'rgba(8,8,24,0.95)',
          border: '1px solid rgba(0,212,255,0.3)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">
            {npc ? 'Editează NPC' : 'NPC Nou'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nume</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Elena Popescu"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/60"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Vârstă</label>
              <input
                type="number"
                value={age}
                min={16} max={90}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Profesie</label>
              <input
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Profesor"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/60"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Oraș</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/60"
              >
                {Object.keys(CITY_COORDS).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Budget lunar: <span style={{ color: budgetColor }}>{budget.toLocaleString()} RON — {budgetLabel}</span>
            </label>
            <input
              type="range"
              min={500} max={20000} step={100}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>500 RON</span>
              <span>20.000 RON</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Trăsături de personalitate</label>
            <div className="flex flex-wrap gap-2">
              {TRAIT_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTrait(t)}
                  className="px-3 py-1 rounded-full text-xs transition-all"
                  style={{
                    background: traits.includes(t) ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.05)',
                    border: traits.includes(t) ? '1px solid rgba(0,212,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    color: traits.includes(t) ? '#00d4ff' : '#9ca3af',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {existingNPCs.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-2">Prieteni</label>
              <div className="flex flex-wrap gap-2">
                {existingNPCs
                  .filter((n) => n.id !== npc?.id)
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => toggleFriend(n.id)}
                      className="px-3 py-1 rounded-full text-xs transition-all"
                      style={{
                        background: friends.includes(n.id) ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
                        border: friends.includes(n.id) ? '1px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.1)',
                        color: friends.includes(n.id) ? '#ffd700' : '#9ca3af',
                      }}
                    >
                      {n.name.split(' ')[0]}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,212,255,0.15))',
              border: '1px solid rgba(0,212,255,0.5)',
              color: '#00d4ff',
            }}
          >
            Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
