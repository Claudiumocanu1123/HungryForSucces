'use client'

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
const LandingGlobe = dynamic(() => import('./LandingGlobe'), { ssr: false, loading: () => null })
const ParticleNetwork = dynamic(() => import('./ParticleNetwork'), { ssr: false, loading: () => null })

// ── NPC data (matches seed.ts exactly) ───────────────────────────────────────
const NPCS = [
  { id:'elena',    name:'Elena Popescu',   age:45, profession:'Bibliotecară',  city:'Iași', budget:2800,  traits:['introvertită','sensibilă','iubitoare de cărți'], color:'#818cf8' },
  { id:'mihai',    name:'Mihai Ionescu',   age:32, profession:'Bucătar',        city:'Iași', budget:3500,  traits:['pasionat','creativ','temperamental'],           color:'#f97316' },
  { id:'ana',      name:'Ana Cristea',     age:38, profession:'Doctor',         city:'Iași', budget:7000,  traits:['dedicată','stresată','empatică'],               color:'#10b981' },
  { id:'bogdan',   name:'Bogdan Dumitru',  age:28, profession:'Programator',    city:'Iași', budget:6500,  traits:['night owl','gamer','procrastinator'],           color:'#7b7bf8' },
  { id:'maria',    name:'Maria Stănescu',  age:52, profession:'Profesoară',     city:'Iași', budget:2200,  traits:['maternă','tradițională','răbdătoare'],          color:'#e879f9' },
  { id:'andrei',   name:'Andrei Moldovan', age:24, profession:'Artist',         city:'Iași', budget:1200,  traits:['haotic','visător','impulsiv'],                  color:'#fb7185' },
  { id:'cristina', name:'Cristina Bălan',  age:41, profession:'Antreprenoare',  city:'Iași', budget:15000, traits:['ambițioasă','eficientă','controlată'],         color:'#38bdf8' },
  { id:'radu',     name:'Radu Georgescu',  age:68, profession:'Pensionar',      city:'Iași', budget:1800,  traits:['nostalgic','înțelept','singur'],               color:'#a78bfa' },
  { id:'iulia',    name:'Iulia Popa',      age:21, profession:'Studentă',       city:'Iași', budget:900,   traits:['sociabilă','anxioasă','energică'],             color:'#34d399' },
  { id:'dan',      name:'Dan Barbu',       age:35, profession:'Mecanic',        city:'Iași', budget:3200,  traits:['practic','loial','family-oriented'],           color:'#fbbf24' },
]

const DICEBEAR = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

// Ambient particles for the right-side space visual
const PARTICLES = [
  { top:'14%', left:'18%', size:3, dur:9,  del:0   },
  { top:'32%', left:'8%',  size:2, dur:12, del:1.8 },
  { top:'58%', left:'14%', size:4, dur:8,  del:3.2 },
  { top:'78%', left:'22%', size:2, dur:11, del:0.6 },
  { top:'10%', left:'82%', size:3, dur:10, del:2.1 },
  { top:'46%', left:'88%', size:2, dur:9,  del:4.0 },
  { top:'68%', left:'78%', size:4, dur:13, del:1.0 },
  { top:'85%', left:'62%', size:2, dur:8,  del:3.6 },
  { top:'24%', left:'54%', size:3, dur:11, del:2.4 },
  { top:'72%', left:'46%', size:2, dur:9,  del:0.9 },
  { top:'40%', left:'70%', size:3, dur:10, del:1.5 },
  { top:'55%', left:'34%', size:2, dur:12, del:3.8 },
]

// ── Star field ────────────────────────────────────────────────────────────────
const StarField = React.memo(function StarField() {
  const [stars, setStars] = useState<Array<{x:number;y:number;r:number;op:number;dur:number;del:number}>>([])
  useEffect(() => {
    setStars(Array.from({ length: 70 }, () => ({
      x: Math.random()*100, y: Math.random()*100,
      r: Math.random() < 0.78 ? 0.8 : 1.5,
      op: Math.random()*0.55+0.15,
      dur: 3+Math.random()*4, del: Math.random()*7,
    })))
  }, [])
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
      {stars.map((s,i) => (
        <div key={i} style={{
          position:'absolute', left:`${s.x}%`, top:`${s.y}%`,
          width:s.r*2, height:s.r*2, borderRadius:'50%',
          background:`rgba(255,255,255,${s.op})`,
          animation:`twinkle ${s.dur}s ease-in-out ${s.del}s infinite`,
        }} />
      ))}
    </div>
  )
})

// ── Per-character animated headline ──────────────────────────────────────────
// Each character animates individually (fade + slide + blur).
// Words are wrapped in white-space:nowrap so line-breaks only happen
// between words — never mid-word.
function AnimatedHeadline({ text, startDelay }: { text: string; startDelay: number }) {
  const lines = text.split('\n')
  let gi = 0
  return (
    <h1 style={{
      margin:0, padding:0,
      fontFamily:'Inter, system-ui, sans-serif',
      fontSize:'clamp(52px, 5.5vw, 78px)',
      fontWeight:800, color:'#fff',
      letterSpacing:'-0.035em', lineHeight:1.02,
    }}>
      {lines.map((line, li) => {
        const words = line.split(' ')
        return (
          <div key={li} style={{ display:'block' }}>
            {words.map((word, wi) => {
              const isLast = wi === words.length - 1
              // Increment gi once for the inter-word space so delays feel natural
              if (wi > 0) gi++
              return (
                <span key={`${li}-${wi}`} style={{
                  display:'inline-block',
                  whiteSpace:'nowrap',
                  marginRight: isLast ? 0 : '0.26em',
                }}>
                  {word.split('').map((ch, ci) => {
                    const delay = startDelay + gi++ * 60
                    return (
                      <span key={`${li}-${wi}-${ci}`} style={{
                        display:'inline-block',
                        animation:`charReveal 1000ms cubic-bezier(0.175,0.885,0.32,1.275) ${delay}ms both`,
                      }}>{ch}</span>
                    )
                  })}
                </span>
              )
            })}
          </div>
        )
      })}
    </h1>
  )
}

// ── Orb visual (right side, no Three.js sphere) ───────────────────────────────
function OrbVisual({ size, transitioning }: { size: number; transitioning: boolean }) {
  return (
    <div style={{
      position:'relative',
      width:size, height:size,
      transform: transitioning ? 'scale(2.8)' : 'scale(1)',
      opacity: transitioning ? 0 : 1,
      transition: transitioning
        ? 'transform 1.6s cubic-bezier(0.4,0,0.2,1), opacity 1.2s ease'
        : 'none',
      animation: transitioning ? 'none' : 'orbFloat 6s ease-in-out infinite, orbScale 8s ease-in-out infinite',
    }}>
      {/* Deep outer glow */}
      <div style={{
        position:'absolute',
        top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        width:size*1.8, height:size*1.8,
        borderRadius:'50%',
        background:'radial-gradient(ellipse, rgba(91,91,245,0.10) 0%, rgba(59,130,246,0.05) 35%, transparent 65%)',
        filter:'blur(40px)',
        pointerEvents:'none',
      }} />

      {/* Atmospheric ring 1 */}
      <div style={{
        position:'absolute', top:'-7%', left:'-7%', width:'114%', height:'114%',
        borderRadius:'50%', pointerEvents:'none',
        border:'1px solid rgba(91,91,245,0.18)',
        boxShadow:'0 0 60px rgba(91,91,245,0.08), inset 0 0 60px rgba(91,91,245,0.05)',
        animation:'ringPulse 4s ease-in-out infinite',
      }} />

      {/* Atmospheric ring 2 */}
      <div style={{
        position:'absolute', top:'-15%', left:'-15%', width:'130%', height:'130%',
        borderRadius:'50%', pointerEvents:'none',
        border:'1px solid rgba(91,91,245,0.09)',
        animation:'ringPulse 4s ease-in-out 1s infinite',
      }} />

      {/* Atmospheric ring 3 */}
      <div style={{
        position:'absolute', top:'-24%', left:'-24%', width:'148%', height:'148%',
        borderRadius:'50%', pointerEvents:'none',
        border:'1px solid rgba(91,91,245,0.05)',
      }} />

      {/* Ambient particles */}
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position:'absolute', top:p.top, left:p.left,
          width:p.size, height:p.size, borderRadius:'50%',
          background:'rgba(160,190,255,0.9)',
          boxShadow:'0 0 8px rgba(160,190,255,0.6)',
          animation:`particleFloat ${p.dur}s ease-in-out ${p.del}s infinite`,
          pointerEvents:'none',
        }} />
      ))}

      {/* Particle network animation — the "real animation", no sphere */}
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', overflow:'hidden' }}>
        <ParticleNetwork width={size} height={size} />
      </div>
    </div>
  )
}

// ── Phase types ───────────────────────────────────────────────────────────────
type Phase = 'hero' | 'transitioning' | 'characters' | 'entering'

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage({ onStart }: { onStart: () => void }) {
  const [mounted,     setMounted]     = useState(false)
  const [phase,       setPhase]       = useState<Phase>('hero')
  const [orbSize,     setOrbSize]     = useState(560)
  const [npcList,     setNpcList]     = useState([...NPCS])
  const [shuffleKey,  setShuffleKey]  = useState(0)
  const [isShuffling, setIsShuffling] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () => setOrbSize(Math.min(680, Math.max(380, Math.round(window.innerWidth * 0.41))))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const handleEnterSim = useCallback(() => {
    setPhase('transitioning')
    setTimeout(() => setPhase('characters'), 1650)
  }, [])

  const handleBeginObserving = useCallback(() => {
    setPhase('entering')
    setTimeout(() => onStart(), 800)
  }, [onStart])

  const handleRandomize = useCallback(() => {
    if (isShuffling) return
    setIsShuffling(true)
    setTimeout(() => {
      setNpcList(prev => [...prev].sort(() => Math.random() - 0.5))
      setShuffleKey(k => k + 1)
      setIsShuffling(false)
    }, 420)
  }, [isShuffling])

  if (!mounted) return <div style={{ position:'fixed', inset:0, background:'#050816' }} />

  return (
    <div style={{
      position:'fixed', inset:0,
      background:'radial-gradient(ellipse at 50% -10%, #0a0f2c 0%, #050816 65%)',
      overflow:'hidden',
      fontFamily:'Inter, system-ui, -apple-system, sans-serif',
      opacity: phase === 'entering' ? 0 : 1,
      transition: phase === 'entering' ? 'opacity 800ms ease' : 'none',
    }}>
      <StarField />

      {/* Nebula glow */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-25%', right:'0%', width:'60vw', height:'60vw', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(91,91,245,0.07) 0%, transparent 60%)', filter:'blur(60px)' }} />
        <div style={{ position:'absolute', bottom:'0%', left:'-10%', width:'50vw', height:'50vw', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 60%)', filter:'blur(60px)' }} />
      </div>

      {/* ═══════════════════════════ HERO + TRANSITIONING ═══════════════════════ */}
      {(phase === 'hero' || phase === 'transitioning') && (
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center',
          animation: phase === 'hero' ? 'heroEnter 800ms cubic-bezier(0.175,0.885,0.32,1.275) both' : 'none',
        }}>

          {/* ── Left: copy ── */}
          <div style={{
            width:'45%',
            padding:'0 0 0 max(48px, 6vw)',
            flexShrink:0,
            opacity: phase === 'transitioning' ? 0 : 1,
            transform: phase === 'transitioning' ? 'translateX(-40px)' : 'translateX(0)',
            transition: phase === 'transitioning' ? 'opacity 0.8s ease, transform 0.8s ease' : 'none',
          }}>

            {/* Live badge */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'6px 14px', borderRadius:100,
              background:'rgba(16,185,129,0.10)', border:'1px solid rgba(16,185,129,0.28)',
              marginBottom:36,
              animation:'slideUp 600ms ease 0ms both',
            }}>
              <span style={{
                width:6, height:6, borderRadius:'50%',
                background:'#10b981', boxShadow:'0 0 8px #10b981',
                display:'inline-block',
                animation:'livePulse 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.65)', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase' }}>
                Live Simulation
              </span>
            </div>

            {/* Headline — per-character animation */}
            <div style={{ marginBottom:28 }}>
              <AnimatedHeadline
                text={"A Living World of\nAutonomous Characters"}
                startDelay={150}
              />
            </div>

            {/* Subheading */}
            <p style={{
              fontSize:'clamp(16px, 1.5vw, 22px)',
              color:'rgba(255,255,255,0.44)',
              lineHeight:1.65,
              margin:'0 0 40px 0',
              maxWidth:480,
              animation:'slideUp 600ms ease 250ms both',
            }}>
              Watch NPCs work, socialize, travel<br />
              and build relationships in real time.
            </p>

            {/* Buttons */}
            <div style={{
              display:'flex', gap:14,
              animation:'slideUp 600ms ease 350ms both',
            }}>
              <button
                onClick={handleEnterSim}
                style={{
                  padding:'15px 36px', borderRadius:14, fontSize:15, fontWeight:700,
                  background:'linear-gradient(135deg, #5b5bf5 0%, #7c3aed 100%)',
                  border:'none', color:'#fff', cursor:'pointer',
                  boxShadow:'0 8px 32px rgba(91,91,245,0.45), 0 0 0 1px rgba(91,91,245,0.3)',
                  transition:'transform 200ms ease, box-shadow 200ms ease',
                  letterSpacing:'0.01em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 16px 48px rgba(91,91,245,0.6), 0 0 0 1px rgba(91,91,245,0.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(91,91,245,0.45), 0 0 0 1px rgba(91,91,245,0.3)'
                }}
              >
                Enter Simulation
              </button>

              <button
                style={{
                  padding:'15px 28px', borderRadius:14, fontSize:15, fontWeight:600,
                  background:'rgba(255,255,255,0.055)',
                  border:'1px solid rgba(255,255,255,0.12)',
                  color:'rgba(255,255,255,0.55)', cursor:'pointer',
                  backdropFilter:'blur(16px)',
                  transition:'all 200ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.055)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                }}
              >
                Explore World
              </button>
            </div>

            {/* Location tag */}
            <div style={{
              marginTop:32,
              display:'inline-flex', alignItems:'center', gap:7,
              animation:'slideUp 600ms ease 450ms both',
            }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981', display:'inline-block' }} />
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)', letterSpacing:'0.06em' }}>
                10 personaje independente · Iași, România
              </span>
            </div>
          </div>

          {/* ── Right: ambient space visual (no sphere) ── */}
          <div style={{
            flex:1, height:'100%',
            display:'flex', alignItems:'center', justifyContent:'center',
            position:'relative',
            animation:'slideUp 800ms cubic-bezier(0.175,0.885,0.32,1.275) 450ms both',
          }}>
            <OrbVisual size={orbSize} transitioning={phase === 'transitioning'} />
          </div>
        </div>
      )}

      {/* ═════════════════════════ CHARACTER SELECTION ══════════════════════════ */}
      {phase === 'characters' && (
        <div style={{
          position:'absolute', inset:0,
          display:'flex', flexDirection:'column',
          animation:'heroEnter 500ms ease both',
          overflow:'hidden',
        }}>
          {/* Top bar */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'20px 40px 0',
            flexShrink:0,
          }}>
            <button
              onClick={() => setPhase('hero')}
              style={{
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:10, padding:'8px 16px', color:'rgba(255,255,255,0.45)',
                fontSize:13, cursor:'pointer', transition:'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            >
              ← Înapoi
            </button>

            {/* Mini Earth globe top-right */}
            <div style={{
              animation:'orbFloat 6s ease-in-out infinite',
              marginRight:-10, marginTop:-10,
              filter:'drop-shadow(0 0 28px rgba(91,91,245,0.35))',
            }}>
              <div style={{
                width:210, height:210, position:'relative',
                borderRadius:'50%', overflow:'hidden',
                border:'1px solid rgba(91,91,245,0.22)',
                boxShadow:'0 0 60px rgba(91,91,245,0.18), inset 0 0 30px rgba(59,130,246,0.08)',
              }}>
                <LandingGlobe width={210} height={210} cinematic={false} />
              </div>
            </div>
          </div>

          {/* Header */}
          <div style={{ textAlign:'center', padding:'16px 40px 18px', flexShrink:0, animation:'slideUp 450ms ease 0ms both' }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'5px 16px', borderRadius:100,
              background:'rgba(91,91,245,0.12)', border:'1px solid rgba(91,91,245,0.28)',
              marginBottom:12,
            }}>
              <span style={{ fontSize:11, color:'rgba(123,123,248,0.95)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Locuitorii Iașiului
              </span>
            </div>
            <AnimatedHeadline text={"Cunoaște cele 10\nvieți independente"} startDelay={80} />
            <p style={{ margin:'8px 0 0', fontSize:13, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>
              Tu observi — ei trăiesc.
            </p>
          </div>

          {/* Scrollable card grid */}
          <div style={{ flex:1, overflowY:'auto', padding:'0 32px', scrollbarWidth:'none' }}>
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(5, 1fr)',
              gap:12,
              maxWidth:1400,
              margin:'0 auto',
              paddingBottom:16,
            }}>
              {npcList.map((npc, i) => (
                <NpcCard key={`${npc.id}-${shuffleKey}`} npc={npc} index={i} isShuffling={isShuffling} />
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:12,
            padding:'16px 40px 24px',
            flexShrink:0,
            animation:'slideUp 450ms ease 350ms both',
          }}>
            <button
              onClick={handleRandomize}
              style={{
                padding:'12px 22px', borderRadius:12, fontSize:14, fontWeight:600,
                background: isShuffling ? 'rgba(91,91,245,0.15)' : 'rgba(255,255,255,0.05)',
                border: isShuffling ? '1px solid rgba(91,91,245,0.35)' : '1px solid rgba(255,255,255,0.1)',
                color: isShuffling ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.55)',
                cursor: isShuffling ? 'default' : 'pointer',
                display:'flex', alignItems:'center', gap:7,
                transition:'all 300ms ease',
              }}
              onMouseEnter={e => { if (!isShuffling) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={e => { if (!isShuffling) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
            >
              <span style={{
                display:'inline-block',
                animation: isShuffling ? 'diceRoll 420ms cubic-bezier(0.175,0.885,0.32,1.275)' : 'none',
              }}>🎲</span>
              {isShuffling ? 'Se amestecă...' : 'Randomize'}
            </button>

            <button
              onClick={handleBeginObserving}
              style={{
                padding:'12px 36px', borderRadius:12, fontSize:15, fontWeight:700,
                background:'linear-gradient(135deg, #5b5bf5 0%, #7c3aed 100%)',
                border:'none', color:'#fff', cursor:'pointer',
                boxShadow:'0 8px 28px rgba(91,91,245,0.42)',
                transition:'transform 200ms, box-shadow 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(91,91,245,0.58)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 28px rgba(91,91,245,0.42)' }}
            >
              Începe Observarea →
            </button>
          </div>
        </div>
      )}

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes charReveal {
          from { opacity:0; transform:translateY(36px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes heroEnter {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes orbFloat {
          0%, 100% { transform:translateY(-12px); }
          50%      { transform:translateY(12px);  }
        }
        @keyframes orbScale {
          0%, 100% { scale:1;    }
          50%      { scale:1.02; }
        }
        @keyframes ringPulse {
          0%, 100% { opacity:1;   }
          50%      { opacity:0.4; }
        }
        @keyframes particleFloat {
          0%   { transform:translate(0,0);       opacity:0.55; }
          25%  { transform:translate(9px,-20px); opacity:1;    }
          50%  { transform:translate(-6px,-10px);opacity:0.7;  }
          75%  { transform:translate(6px,-24px); opacity:0.9;  }
          100% { transform:translate(0,0);       opacity:0.55; }
        }
        @keyframes twinkle {
          0%, 100% { opacity:1;    }
          50%      { opacity:0.12; }
        }
        @keyframes livePulse {
          0%, 100% { opacity:1;   box-shadow:0 0 8px #10b981;  }
          50%      { opacity:0.5; box-shadow:0 0 16px #10b981; }
        }
        @keyframes nebulaShift {
          0%, 100% { opacity:0.8; transform:scale(1);    }
          50%      { opacity:1;   transform:scale(1.05); }
        }
        @keyframes cardOut {
          0%   { transform:scale(1) translateY(0);     opacity:1;   filter:blur(0px); }
          40%  { transform:scale(0.9) translateY(-8px); opacity:0.5; filter:blur(1px); }
          100% { transform:scale(0.82) translateY(-4px); opacity:0;  filter:blur(3px); }
        }
        @keyframes diceRoll {
          0%   { transform:rotate(0deg)   scale(1);   }
          20%  { transform:rotate(-25deg) scale(1.4); }
          50%  { transform:rotate(30deg)  scale(1.3); }
          75%  { transform:rotate(-10deg) scale(1.1); }
          100% { transform:rotate(0deg)   scale(1);   }
        }
      `}</style>
    </div>
  )
}

// ── NPC Card ─────────────────────────────────────────────────────────────────
function NpcCard({ npc, index, isShuffling }: { npc: typeof NPCS[number]; index: number; isShuffling: boolean }) {
  return (
    <div
      style={{
        height:180,
        borderRadius:16,
        padding:'14px 14px 12px',
        background:'rgba(255,255,255,0.04)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        border:'1px solid rgba(255,255,255,0.09)',
        display:'flex', flexDirection:'column', gap:8,
        animation: isShuffling
          ? `cardOut 400ms ease both`
          : `slideUp 450ms ease ${index*40}ms both`,
        transition:'transform 250ms ease, box-shadow 250ms ease, border-color 250ms ease, background 250ms ease',
        cursor:'default',
        position:'relative',
        overflow:'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-6px) scale(1.02)'
        el.style.boxShadow = `0 20px 48px rgba(0,0,0,0.4), 0 0 0 1px ${npc.color}40`
        el.style.borderColor = `${npc.color}50`
        el.style.background = 'rgba(255,255,255,0.07)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.boxShadow = ''
        el.style.borderColor = 'rgba(255,255,255,0.09)'
        el.style.background = 'rgba(255,255,255,0.04)'
      }}
    >
      {/* Accent top bar */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, ${npc.color}aa, transparent)`,
        borderRadius:'16px 16px 0 0',
      }} />

      {/* Top row: avatar + name/profession */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:44, height:44, borderRadius:'50%', overflow:'hidden', flexShrink:0,
          border:`1.5px solid ${npc.color}55`,
          background:`${npc.color}18`,
        }}>
          <img
            src={`${DICEBEAR}${encodeURIComponent(npc.id)}`}
            alt={npc.name}
            style={{ width:'100%', height:'100%', display:'block' }}
            loading="lazy"
          />
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {npc.name}
          </div>
          <div style={{ fontSize:10, fontWeight:600, color:npc.color, marginTop:1, opacity:0.9 }}>
            {npc.profession}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'flex', gap:6 }}>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.38)', background:'rgba(255,255,255,0.06)', borderRadius:5, padding:'2px 7px' }}>
          {npc.age} ani
        </span>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.38)', background:'rgba(255,255,255,0.06)', borderRadius:5, padding:'2px 7px' }}>
          📍 {npc.city}
        </span>
        <span style={{ fontSize:10, fontWeight:600, color:'rgba(212,160,23,0.85)', background:'rgba(212,160,23,0.08)', borderRadius:5, padding:'2px 7px', whiteSpace:'nowrap' }}>
          {npc.budget >= 1000 ? `${(npc.budget/1000).toFixed(1)}k` : npc.budget} RON
        </span>
      </div>

      {/* Traits */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, flex:1, alignContent:'flex-start' }}>
        {npc.traits.map(t => (
          <span key={t} style={{
            fontSize:9, color:`${npc.color}cc`,
            background:`${npc.color}15`,
            border:`1px solid ${npc.color}25`,
            borderRadius:5, padding:'2px 6px',
          }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
