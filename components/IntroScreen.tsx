'use client'

import { useState, useCallback } from 'react'
import { NPCWithState } from '@/types'
import { PlayerProfile, NPCPersonalization } from '@/lib/usePlayerProfile'

const DICE_BASE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'București':   { lat: 44.4268, lng: 26.1025 },
  'Cluj-Napoca': { lat: 46.7712, lng: 23.6236 },
  'Iași':        { lat: 47.1585, lng: 27.6014 },
  'Timișoara':   { lat: 45.7489, lng: 21.2087 },
  'Brașov':      { lat: 45.6579, lng: 25.6012 },
  'Sibiu':       { lat: 45.7983, lng: 24.1256 },
  'Constanța':   { lat: 44.1598, lng: 28.6348 },
  'Craiova':     { lat: 44.3302, lng: 23.7949 },
}

const NPC_EMOJIS = ['⭐','💫','🎯','🔥','💎','🌟','✨','🎭','🌙','🎪']

// Globe marker emojis (shown on glob as player pin)
const GLOBE_EMOJIS = ['🧑','👩','👨','🧔','👩‍💻','👨‍💻','🧑‍🎓','🧑‍🎨','👩‍⚕️','👨‍🔧','🦸','🧙']

interface IntroScreenProps {
  npcs: NPCWithState[]
  onComplete: (profile: Omit<PlayerProfile, 'hasCompletedIntro'>) => void
}

type Step = 'welcome' | 'location' | 'customize'

function randomSeed() {
  return Math.random().toString(36).slice(2, 10)
}

export default function IntroScreen({ npcs, onComplete }: IntroScreenProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🧑')
  const [avatarSeed, setAvatarSeed] = useState('')   // empty = use name
  const [city, setCity] = useState('București')
  const [personalizations, setPersonalizations] = useState<Record<string, NPCPersonalization>>({})

  const effectiveSeed = avatarSeed || name || 'default'

  const handleRandomize = useCallback(() => {
    setAvatarSeed(randomSeed())
  }, [])

  const updateNpc = (id: string, field: keyof NPCPersonalization, value: string) => {
    setPersonalizations((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleComplete = () => {
    const coords = CITY_COORDS[city] || { lat: 44.4268, lng: 26.1025 }
    onComplete({
      name: name.trim() || 'Jucător',
      emoji,
      avatarSeed: effectiveSeed,
      lat: coords.lat,
      lng: coords.lng,
      city,
      npcPersonalizations: personalizations,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(238,240,248,0.85)', backdropFilter: 'blur(10px)' }}
    >
      <div className="fixed inset-0 pointer-events-none stars" />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(91,91,245,0.2)',
          boxShadow: '0 0 80px rgba(91,91,245,0.1), 0 24px 64px rgba(20,20,50,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '28px 32px 20px', textAlign: 'center', borderBottom: '1px solid rgba(22,22,42,0.07)' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#5b5bf5', letterSpacing: '-0.03em' }}>LifeSim</div>
          <div style={{ fontSize: 10, color: 'rgba(22,22,42,0.3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 3 }}>
            Simulare de viață · România
          </div>
          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {(['welcome', 'location', 'customize'] as Step[]).map((s, i) => {
              const stepIdx = ['welcome', 'location', 'customize'].indexOf(step)
              const thisIdx = i
              return (
                <div key={s} style={{
                  width: step === s ? 20 : 8,
                  height: 8, borderRadius: 4,
                  background: step === s ? '#5b5bf5' : thisIdx < stepIdx ? 'rgba(91,91,245,0.4)' : 'rgba(22,22,42,0.12)',
                  transition: 'all 0.3s ease',
                }} />
              )
            })}
          </div>
        </div>

        <div style={{ padding: '24px 32px', maxHeight: '65vh', overflowY: 'auto', scrollbarWidth: 'none' }}>

          {/* ── STEP 1: Avatar + Name ── */}
          {step === 'welcome' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#16162a', marginBottom: 6 }}>
                  Creează-ți profilul
                </h2>
                <p style={{ fontSize: 12, color: 'rgba(22,22,42,0.4)', lineHeight: 1.6 }}>
                  Urmărește 10 personaje care trăiesc o săptămână simulată în România.
                </p>
              </div>

              {/* DiceBear Avatar Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  {/* Glow ring */}
                  <div style={{
                    position: 'absolute', inset: -6, borderRadius: '50%',
                    border: '2px solid rgba(91,91,245,0.4)',
                    boxShadow: '0 0 24px rgba(91,91,245,0.3), 0 0 48px rgba(91,91,245,0.1)',
                  }} />
                  <div style={{
                    width: 120, height: 120, borderRadius: '50%',
                    overflow: 'hidden', background: 'rgba(20,20,45,1)',
                    border: '3px solid rgba(91,91,245,0.25)',
                    position: 'relative',
                  }}>
                    <img
                      key={effectiveSeed}
                      src={`${DICE_BASE}${encodeURIComponent(effectiveSeed)}`}
                      alt="Avatar"
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Randomize */}
                  <button
                    onClick={handleRandomize}
                    style={{
                      padding: '7px 16px', borderRadius: 10,
                      background: 'rgba(91,91,245,0.1)', border: '1px solid rgba(91,91,245,0.3)',
                      color: '#5b5bf5', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,91,245,0.2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,91,245,0.1)' }}
                  >
                    🎲 Alt avatar
                  </button>

                  {/* Reset to name */}
                  {avatarSeed && (
                    <button
                      onClick={() => setAvatarSeed('')}
                      style={{
                        padding: '7px 12px', borderRadius: 10,
                        background: 'rgba(22,22,42,0.05)', border: '1px solid rgba(22,22,42,0.1)',
                        color: 'rgba(22,22,42,0.4)', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'Inter,sans-serif', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,22,42,0.1)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,22,42,0.05)' }}
                    >
                      ↺ Reset
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 10, color: 'rgba(22,22,42,0.2)', textAlign: 'center' }}>
                  {avatarSeed ? 'Avatar randomizat' : name ? `Bazat pe numele tău` : 'Introduce-ți numele pentru avatar personalizat'}
                </div>
              </div>

              {/* Name input */}
              <div>
                <label style={{ fontSize: 11, color: 'rgba(22,22,42,0.4)', display: 'block', marginBottom: 8, letterSpacing: '0.04em' }}>
                  NUMELE TĂU
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep('location') }}
                  placeholder="Introdu numele tău..."
                  maxLength={30}
                  style={{
                    width: '100%', background: 'rgba(22,22,42,0.04)',
                    border: '1px solid rgba(22,22,42,0.1)', borderRadius: 12,
                    padding: '12px 16px', color: '#16162a', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'Inter,sans-serif',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(91,91,245,0.5)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(22,22,42,0.1)' }}
                />
              </div>

              {/* Globe emoji selector (small, secondary) */}
              <div>
                <label style={{ fontSize: 11, color: 'rgba(22,22,42,0.3)', display: 'block', marginBottom: 8, letterSpacing: '0.04em' }}>
                  EMOJI PE GLOB (markerul tău pe hartă)
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {GLOBE_EMOJIS.map((av) => (
                    <button
                      key={av}
                      onClick={() => setEmoji(av)}
                      style={{
                        fontSize: 18, padding: '6px', borderRadius: 10, cursor: 'pointer',
                        background: emoji === av ? 'rgba(255,215,0,0.2)' : 'rgba(22,22,42,0.03)',
                        border: emoji === av ? '1px solid rgba(255,215,0,0.5)' : '1px solid rgba(22,22,42,0.07)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Location ── */}
          {step === 'location' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#16162a', marginBottom: 6 }}>Unde locuiești?</h2>
                <p style={{ fontSize: 12, color: 'rgba(22,22,42,0.4)', lineHeight: 1.6 }}>
                  Markerul tău va apărea pe glob cu emoji-ul ales.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.keys(CITY_COORDS).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCity(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                      background: city === c ? 'rgba(255,215,0,0.12)' : 'rgba(22,22,42,0.03)',
                      border: city === c ? '1px solid rgba(255,215,0,0.45)' : '1px solid rgba(22,22,42,0.07)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (city !== c) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,22,42,0.06)' }}
                    onMouseLeave={(e) => { if (city !== c) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,22,42,0.03)' }}
                  >
                    <span style={{ fontSize: 18 }}>{city === c ? '📍' : '🏙️'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: city === c ? '#ffd700' : 'rgba(22,22,42,0.75)', fontFamily: 'Inter,sans-serif' }}>
                      {c}
                    </span>
                  </button>
                ))}
              </div>

              {/* Preview card */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 14,
                background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,215,0,0.4)', background: 'rgba(20,20,45,1)', flexShrink: 0 }}>
                  <img src={`${DICE_BASE}${encodeURIComponent(effectiveSeed)}`} alt="avatar" style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffd700' }}>
                    {emoji} {name || 'Tu'} · {city}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(22,22,42,0.3)', marginTop: 2 }}>
                    Acesta e profilul tău în simulare
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Customize NPCs ── */}
          {step === 'customize' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#16162a', marginBottom: 6 }}>Personalizează personajele</h2>
                <p style={{ fontSize: 12, color: 'rgba(22,22,42,0.4)', lineHeight: 1.6 }}>
                  Opțional — aliasuri sau note private. Nu afectează simularea.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {npcs.map((npc) => {
                  const p = personalizations[npc.id] || {}
                  const firstName = npc.name.split(' ')[0]
                  return (
                    <div key={npc.id} style={{
                      borderRadius: 12, padding: '12px 14px',
                      background: 'rgba(22,22,42,0.03)', border: '1px solid rgba(22,22,42,0.07)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(91,91,245,0.3)', background: 'rgba(20,20,45,1)', flexShrink: 0 }}>
                          <img src={`${DICE_BASE}${encodeURIComponent(firstName)}`} alt={firstName} style={{ width: '100%', height: '100%', display: 'block' }} loading="lazy" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#16162a' }}>{npc.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(22,22,42,0.35)' }}>{npc.profession} · {npc.city}</div>
                        </div>
                        {/* Quick emoji labels */}
                        <div style={{ display: 'flex', gap: 3 }}>
                          {NPC_EMOJIS.slice(0, 5).map((em) => (
                            <button key={em} onClick={() => updateNpc(npc.id, 'emoji', em)} style={{
                              fontSize: 14, padding: '3px', borderRadius: 6, cursor: 'pointer',
                              background: p.emoji === em ? 'rgba(91,91,245,0.2)' : 'transparent',
                              border: p.emoji === em ? '1px solid rgba(91,91,245,0.4)' : '1px solid transparent',
                            }}>
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          value={p.alias || ''}
                          onChange={(e) => updateNpc(npc.id, 'alias', e.target.value)}
                          placeholder='Alias (ex: "Prietenul meu")'
                          maxLength={25}
                          style={{ background: 'rgba(22,22,42,0.04)', border: '1px solid rgba(22,22,42,0.08)', borderRadius: 8, padding: '7px 10px', color: '#16162a', fontSize: 11, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                        />
                        <input
                          value={p.note || ''}
                          onChange={(e) => updateNpc(npc.id, 'note', e.target.value)}
                          placeholder="Notă personală..."
                          maxLength={50}
                          style={{ background: 'rgba(22,22,42,0.04)', border: '1px solid rgba(22,22,42,0.08)', borderRadius: 8, padding: '7px 10px', color: '#16162a', fontSize: 11, outline: 'none', fontFamily: 'Inter,sans-serif' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ padding: '16px 32px 24px', borderTop: '1px solid rgba(22,22,42,0.07)', display: 'flex', gap: 10 }}>
          {step !== 'welcome' && (
            <button
              onClick={() => setStep(step === 'location' ? 'welcome' : 'location')}
              style={{ padding: '10px 18px', borderRadius: 12, fontSize: 13, color: 'rgba(22,22,42,0.45)', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(22,22,42,0.1)', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(22,22,42,0.45)' }}
            >
              ← Înapoi
            </button>
          )}

          {step === 'welcome' && (
            <button
              onClick={() => { if (name.trim()) setStep('location') }}
              disabled={!name.trim()}
              style={{
                flex: 1, padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed',
                background: name.trim() ? 'rgba(91,91,245,0.15)' : 'rgba(22,22,42,0.04)',
                border: name.trim() ? '1px solid rgba(91,91,245,0.45)' : '1px solid rgba(22,22,42,0.08)',
                color: name.trim() ? '#5b5bf5' : 'rgba(22,22,42,0.2)',
                fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
              }}
            >
              Continuă →
            </button>
          )}

          {step === 'location' && (
            <button
              onClick={() => setStep('customize')}
              style={{ flex: 1, padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.35)', color: '#ffd700', fontFamily: 'Inter,sans-serif', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,215,0,0.2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,215,0,0.12)' }}
            >
              Continuă →
            </button>
          )}

          {step === 'customize' && (
            <>
              <button
                onClick={handleComplete}
                style={{ flex: 1, padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', fontFamily: 'Inter,sans-serif', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.22)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.12)' }}
              >
                🚀 Începe simularea
              </button>
              <button
                onClick={handleComplete}
                style={{ padding: '11px 16px', borderRadius: 12, fontSize: 11, color: 'rgba(22,22,42,0.3)', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(22,22,42,0.07)', fontFamily: 'Inter,sans-serif' }}
              >
                Sari peste
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
