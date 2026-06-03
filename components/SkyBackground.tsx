'use client'

import { useEffect, useRef } from 'react'
import { DayTheme } from '@/lib/dayTheme'

interface Props {
  timeOfDay: number
  theme: DayTheme
  /** Space mode: render only stars on black — no sky gradient, sun, or clouds */
  spaceMode?: boolean
}

// ── Deterministic LCG RNG ─────────────────────────────────────────────────────
function lcg(s: number) { return ((s * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff }

// ── 240 stars (more = richer night sky) ──────────────────────────────────────
const STARS = Array.from({ length: 240 }, (_, i) => {
  let s = (i + 1) * 1234567
  const x     = lcg(s = lcg(s) * 1e9 | 0)
  const y     = lcg(s = lcg(s) * 1e9 | 0) * 0.80
  const r     = 0.3 + lcg(s = lcg(s) * 1e9 | 0) * 1.6
  const phase = lcg(s = lcg(s) * 1e9 | 0) * Math.PI * 2
  const speed = 0.3 + lcg(s = lcg(s) * 1e9 | 0) * 1.8
  const blue  = lcg(s) > 0.7   // some stars are bluish-white
  return { x, y, r, phase, speed, blue }
})

// ── 9 cloud layers at different heights/speeds ────────────────────────────────
const CLOUD_DEFS = [
  { baseX: 0.02, y: 0.09, w: 0.30, h: 0.060, drift: 0.70, layer: 0 },
  { baseX: 0.35, y: 0.06, w: 0.38, h: 0.070, drift: 0.50, layer: 0 },
  { baseX: 0.68, y: 0.12, w: 0.28, h: 0.055, drift: 0.90, layer: 0 },
  { baseX: 0.12, y: 0.22, w: 0.22, h: 0.042, drift: 1.10, layer: 1 },
  { baseX: 0.50, y: 0.18, w: 0.18, h: 0.038, drift: 0.80, layer: 1 },
  { baseX: 0.78, y: 0.26, w: 0.24, h: 0.045, drift: 1.20, layer: 1 },
  { baseX: 0.22, y: 0.32, w: 0.16, h: 0.032, drift: 1.40, layer: 2 },
  { baseX: 0.55, y: 0.35, w: 0.14, h: 0.028, drift: 1.60, layer: 2 },
  { baseX: 0.85, y: 0.30, w: 0.18, h: 0.034, drift: 1.30, layer: 2 },
]

export default function SkyBackground({ timeOfDay, theme, spaceMode = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const todRef    = useRef(timeOfDay)
  const themeRef  = useRef(theme)
  const startRef  = useRef(performance.now())

  useEffect(() => { todRef.current   = timeOfDay }, [timeOfDay])
  useEffect(() => { themeRef.current = theme     }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let lastDraw = 0

    const draw = (ts: number) => {
      rafRef.current = requestAnimationFrame(draw)
      if (ts - lastDraw < 32) return
      lastDraw = ts

      const tod = todRef.current
      const th  = themeRef.current
      const W   = canvas.width
      const H   = canvas.height
      const sec = (ts - startRef.current) / 1000

      ctx.clearRect(0, 0, W, H)

      if (spaceMode) {
        // ── SPACE MODE: deep black with nebula tint + stars only ─────────────
        const space = ctx.createRadialGradient(W*0.5, H*0.4, 0, W*0.5, H*0.5, Math.max(W,H)*0.8)
        space.addColorStop(0,   'rgba(4,6,20,1)')
        space.addColorStop(0.5, 'rgba(2,4,14,1)')
        space.addColorStop(1,   'rgba(1,2,8,1)')
        ctx.fillStyle = space
        ctx.fillRect(0, 0, W, H)

        // Subtle nebula band
        const neb = ctx.createLinearGradient(0, H*0.1, W, H*0.7)
        neb.addColorStop(0,   'transparent')
        neb.addColorStop(0.3, 'rgba(30,18,60,0.18)')
        neb.addColorStop(0.6, 'rgba(10,25,55,0.14)')
        neb.addColorStop(1,   'transparent')
        ctx.fillStyle = neb
        ctx.fillRect(0, 0, W, H)

        // Stars (all always visible in space)
        for (const st of STARS) {
          const twinkle = 0.5 + 0.5 * Math.sin(sec * st.speed + st.phase)
          const op = (0.4 + 0.6 * twinkle) * (st.r > 1.2 ? 1 : 0.7)
          const sx = st.x * W, sy = st.y * H
          if (st.r > 1.1 && op > 0.3) {
            const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, st.r * 5)
            halo.addColorStop(0, `rgba(${st.blue ? '180,200,255' : '215,225,255'},${(op*0.20).toFixed(3)})`)
            halo.addColorStop(1, 'transparent')
            ctx.beginPath(); ctx.arc(sx, sy, st.r*5, 0, Math.PI*2)
            ctx.fillStyle = halo; ctx.fill()
          }
          ctx.beginPath(); ctx.arc(sx, sy, st.r, 0, Math.PI*2)
          ctx.fillStyle = `rgba(${st.blue ? '185,205,255' : '215,225,255'},${op.toFixed(3)})`
          ctx.fill()
        }

        // Vignette
        const vig = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.85)
        vig.addColorStop(0, 'transparent')
        vig.addColorStop(1, 'rgba(0,0,8,0.55)')
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
        return  // skip sky/sun/cloud drawing
      }

      // ── 1. Sky gradient ─────────────────────────────────────────────────────
      const { top, mid, horizon } = skyColors(tod)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H)
      skyGrad.addColorStop(0,    top)
      skyGrad.addColorStop(0.45, mid)
      skyGrad.addColorStop(1,    horizon)
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, W, H)

      // ── 2. Milky Way band (night only) ──────────────────────────────────────
      const sOp = th.starsOpacity
      if (sOp > 0.25) {
        ctx.save()
        ctx.translate(W * 0.5, H * 0.38)
        ctx.rotate(-0.38)
        const mw = ctx.createLinearGradient(-W * 0.8, 0, W * 0.8, 0)
        mw.addColorStop(0,    'transparent')
        mw.addColorStop(0.25, `rgba(140,155,220,${(sOp * 0.055).toFixed(3)})`)
        mw.addColorStop(0.5,  `rgba(165,178,235,${(sOp * 0.10).toFixed(3)})`)
        mw.addColorStop(0.75, `rgba(140,155,220,${(sOp * 0.055).toFixed(3)})`)
        mw.addColorStop(1,    'transparent')
        ctx.fillStyle = mw
        ctx.fillRect(-W * 0.8, -H * 0.12, W * 1.6, H * 0.24)
        ctx.restore()
      }

      // ── 3. Stars ────────────────────────────────────────────────────────────
      if (sOp > 0.01) {
        for (const st of STARS) {
          const twinkle = 0.4 + 0.6 * Math.sin(sec * st.speed + st.phase)
          const op = sOp * twinkle
          if (op < 0.02) continue
          const sx = st.x * W, sy = st.y * H
          const starColor = st.blue ? `rgba(180,200,255,` : `rgba(215,225,255,`
          // Halo for brighter stars
          if (st.r > 1.0 && op > 0.15) {
            const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, st.r * 6)
            halo.addColorStop(0, `rgba(190,210,255,${(op * 0.22).toFixed(3)})`)
            halo.addColorStop(1, 'transparent')
            ctx.beginPath(); ctx.arc(sx, sy, st.r * 6, 0, Math.PI * 2)
            ctx.fillStyle = halo; ctx.fill()
          }
          ctx.beginPath(); ctx.arc(sx, sy, st.r, 0, Math.PI * 2)
          ctx.fillStyle = `${starColor}${op.toFixed(3)})`
          ctx.fill()
        }
      }

      // ── 4. Moon ─────────────────────────────────────────────────────────────
      const mVis = moonVisibility(tod) * Math.max(sOp, 0.1)
      if (mVis > 0.02) {
        const [mx, my] = moonPos(tod, W, H)
        const mr = Math.min(W, H) * 0.036

        // Outer halo glow
        const mHalo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 6)
        mHalo.addColorStop(0, `rgba(200,218,255,${(mVis * 0.22).toFixed(3)})`)
        mHalo.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(mx, my, mr * 6, 0, Math.PI * 2)
        ctx.fillStyle = mHalo; ctx.fill()

        // Moon disk with subtle shading
        const mGrd = ctx.createRadialGradient(mx - mr * 0.28, my - mr * 0.28, 0, mx, my, mr)
        mGrd.addColorStop(0,    `rgba(248,252,255,${mVis.toFixed(3)})`)
        mGrd.addColorStop(0.60, `rgba(212,224,242,${mVis.toFixed(3)})`)
        mGrd.addColorStop(1,    `rgba(155,175,210,${mVis.toFixed(3)})`)
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2)
        ctx.fillStyle = mGrd; ctx.fill()

        // Crater marks
        ctx.globalAlpha = mVis * 0.13
        for (const [cdx, cdy, cr] of [[0.30, 0.20, 0.18], [-0.22, 0.38, 0.12], [0.08, -0.32, 0.10], [-0.35, -0.15, 0.08]] as [number,number,number][]) {
          ctx.beginPath()
          ctx.arc(mx + cdx * mr, my + cdy * mr, cr * mr, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(110,132,175,1)'
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // Moon horizon reflection glow
        if (mVis > 0.4 && my < H * 0.7) {
          const mRef = ctx.createLinearGradient(0, H * 0.78, 0, H)
          mRef.addColorStop(0, `rgba(180,200,240,${(mVis * 0.06).toFixed(3)})`)
          mRef.addColorStop(1, 'transparent')
          ctx.fillStyle = mRef
          ctx.fillRect(0, H * 0.78, W, H * 0.22)
        }
      }

      // ── 5. Horizon atmospheric glow (sunrise / sunset) ──────────────────────
      const hGlowInt = horizonGlow(tod)
      if (hGlowInt > 0.01) {
        const { gc } = sunriseColor(tod)
        const hg = ctx.createLinearGradient(0, H * 0.40, 0, H)
        hg.addColorStop(0,    'transparent')
        hg.addColorStop(0.50, rgbaFrom(gc, hGlowInt * 0.20))
        hg.addColorStop(1,    rgbaFrom(gc, hGlowInt * 0.48))
        ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H)

        // Lower horizon band
        const hb = ctx.createLinearGradient(0, H * 0.70, 0, H)
        hb.addColorStop(0, rgbaFrom(gc, hGlowInt * 0.32))
        hb.addColorStop(1, rgbaFrom(gc, hGlowInt * 0.10))
        ctx.fillStyle = hb; ctx.fillRect(0, H * 0.70, W, H * 0.30)
      }

      // ── 6. Sun ──────────────────────────────────────────────────────────────
      const { sx: sunX, sy: sunY, sv: sunVis } = sunPosition(tod, W, H)
      if (sunVis > 0.01) {
        const sr = Math.min(W, H) * 0.038
        const { disk: dsk, corona: crn } = sunColors(tod)

        // Crepuscular rays at sunrise/sunset
        if (hGlowInt > 0.2) {
          ctx.save()
          ctx.globalAlpha = hGlowInt * 0.09
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2
            const rayLen = Math.min(W, H) * 1.4
            const rayW = 0.025
            ctx.beginPath()
            ctx.moveTo(sunX, sunY)
            ctx.lineTo(sunX + Math.cos(angle - rayW) * rayLen, sunY + Math.sin(angle - rayW) * rayLen)
            ctx.lineTo(sunX + Math.cos(angle + rayW) * rayLen, sunY + Math.sin(angle + rayW) * rayLen)
            ctx.closePath()
            const rg = ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * rayLen, sunY + Math.sin(angle) * rayLen)
            rg.addColorStop(0, crn.replace('rgb', 'rgba').replace(')', ',1)'))
            rg.addColorStop(1, 'transparent')
            ctx.fillStyle = rg
            ctx.fill()
          }
          ctx.restore()
        }

        // Outermost scatter
        const c3 = ctx.createRadialGradient(sunX, sunY, sr, sunX, sunY, sr * 24)
        c3.addColorStop(0, rgbaFrom(crn, sunVis * 0.10))
        c3.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(sunX, sunY, sr * 24, 0, Math.PI * 2)
        ctx.fillStyle = c3; ctx.fill()

        // Wide corona
        const c2 = ctx.createRadialGradient(sunX, sunY, sr * 0.4, sunX, sunY, sr * 9)
        c2.addColorStop(0, rgbaFrom(crn, sunVis * 0.32))
        c2.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(sunX, sunY, sr * 9, 0, Math.PI * 2)
        ctx.fillStyle = c2; ctx.fill()

        // Inner glow
        const c1 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sr * 3.5)
        c1.addColorStop(0,   rgbaFrom(dsk, sunVis))
        c1.addColorStop(0.5, rgbaFrom(crn, sunVis * 0.65))
        c1.addColorStop(1,   'transparent')
        ctx.beginPath(); ctx.arc(sunX, sunY, sr * 3.5, 0, Math.PI * 2)
        ctx.fillStyle = c1; ctx.fill()

        // Disk
        const cd = ctx.createRadialGradient(sunX - sr * 0.25, sunY - sr * 0.25, 0, sunX, sunY, sr)
        cd.addColorStop(0,   `rgba(255,255,240,${sunVis.toFixed(3)})`)
        cd.addColorStop(0.5, rgbaFrom(dsk, sunVis))
        cd.addColorStop(1,   rgbaFrom(crn, sunVis * 0.9))
        ctx.beginPath(); ctx.arc(sunX, sunY, sr, 0, Math.PI * 2)
        ctx.fillStyle = cd; ctx.fill()
      }

      // ── 7. Always-visible horizon haze ──────────────────────────────────────
      const hazeOp = tod >= 6 && tod <= 20 ? 0.12 : 0.05
      const hazeGrd = ctx.createLinearGradient(0, H * 0.75, 0, H)
      hazeGrd.addColorStop(0, 'transparent')
      hazeGrd.addColorStop(1, `rgba(30,50,90,${hazeOp})`)
      ctx.fillStyle = hazeGrd
      ctx.fillRect(0, H * 0.75, W, H * 0.25)

      // ── 8. Clouds ───────────────────────────────────────────────────────────
      const cOp = cloudOpacity(tod)
      if (cOp > 0.005) {
        for (const c of CLOUD_DEFS) {
          const layerSpeed = 1 - c.layer * 0.25  // farther layers drift slower
          const drift = (sec * c.drift * layerSpeed * 0.006) % 1.4
          const cx = ((c.baseX + drift) % 1.4 - 0.15) * W
          const cy = c.y * H
          const layerOp = cOp * (1 - c.layer * 0.18)
          drawCloud(ctx, cx, cy, c.w * W, c.h * H, layerOp, tod)
        }
      }

      // ── 9. Subtle vignette ──────────────────────────────────────────────────
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.9)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, 'rgba(0,0,0,0.28)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', display: 'block' }}
    />
  )
}

// ── Helper: rgb(r,g,b) → rgba(r,g,b,a) string ────────────────────────────────
function rgbaFrom(rgb: string, a: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`)
}

// ── Sky color palette ─────────────────────────────────────────────────────────
function skyColors(tod: number) {
  if (tod < 5.2)             return { top: '#01020a', mid: '#020614', horizon: '#05091e' }
  if (tod < 5.8)             return { top: '#09051e', mid: '#1e0c3a', horizon: '#3c1222' }
  if (tod < 6.5)             return { top: '#1e0c08', mid: '#0e1c32', horizon: '#d44e12' }
  if (tod < 8.0)             return { top: '#0c1c3a', mid: '#1e4872', horizon: '#d0a02a' }
  if (tod < 10)              return { top: '#061426', mid: '#103058', horizon: '#1e4880' }
  if (tod < 16)              return { top: '#071828', mid: '#0e2c52', horizon: '#1c4470' }
  if (tod < 17.5)            return { top: '#081020', mid: '#122a4a', horizon: '#1e3a60' }
  if (tod < 18.5)            return { top: '#220a08', mid: '#0c1020', horizon: '#d04a18' }
  if (tod < 19.5)            return { top: '#240810', mid: '#1e0c32', horizon: '#8c0a22' }
  if (tod < 21)              return { top: '#100828', mid: '#1c0c42', horizon: '#3e0e32' }
  if (tod < 23)              return { top: '#060818', mid: '#0c1030', horizon: '#0e1434' }
  return                            { top: '#01020a', mid: '#020614', horizon: '#05091e' }
}

// ── Sun ───────────────────────────────────────────────────────────────────────
function sunPosition(tod: number, W: number, H: number) {
  if (tod < 5.5 || tod > 18.8) return { sx: W * 0.5, sy: H * 1.3, sv: 0 }
  const norm = (tod - 5.5) / 13.3
  const arc  = Math.sin(norm * Math.PI)
  const sv   = Math.min(arc * 4, 1)
  const sx   = W * (0.12 + norm * 0.76)
  const sy   = H * (0.84 - arc * 0.70)
  return { sx, sy, sv }
}

function sunColors(tod: number) {
  if (tod < 7   || tod > 17.5) return { disk: 'rgb(255,128,28)',  corona: 'rgb(255,58,5)'   }
  if (tod < 9   || tod > 16)   return { disk: 'rgb(255,208,78)',  corona: 'rgb(255,148,28)'  }
  return                               { disk: 'rgb(255,252,200)', corona: 'rgb(255,212,100)' }
}

// ── Moon ──────────────────────────────────────────────────────────────────────
function moonVisibility(tod: number): number {
  if (tod >= 20)  return Math.min((tod - 20) / 1.0, 1)
  if (tod <= 5.2) return 1
  if (tod <= 6.5) return Math.max(0, (6.5 - tod) / 1.3)
  return 0
}

function moonPos(tod: number, W: number, H: number): [number, number] {
  let phase: number
  if (tod >= 20)      phase = (tod - 20) / 12
  else if (tod <= 6)  phase = (tod + 4) / 12
  else                phase = 0
  phase = Math.max(0, Math.min(1, phase))
  const arc = Math.sin(phase * Math.PI)
  return [W * (0.85 - phase * 0.70), H * (0.78 - arc * 0.60)]
}

// ── Sunrise / sunset glow ─────────────────────────────────────────────────────
function horizonGlow(tod: number): number {
  if (tod >= 5.5 && tod <= 7.8) return Math.sin(((tod - 5.5) / 2.3) * Math.PI)
  if (tod >= 16.5 && tod <= 19.5) return Math.sin(((tod - 16.5) / 3.0) * Math.PI)
  return 0
}

function sunriseColor(tod: number) {
  return tod < 10 || tod > 17 ? { gc: 'rgb(224,72,8)' } : { gc: 'rgb(204,98,16)' }
}

// ── Clouds ────────────────────────────────────────────────────────────────────
function cloudOpacity(tod: number): number {
  if (tod < 5.5 || tod > 20.5) return 0.07
  if (tod < 7   || tod > 19)   return 0.30
  return 0.46
}

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, opacity: number, tod: number) {
  const night = tod < 6 || tod > 20
  const [r, g, b] = night ? [28, 38, 62] : [238, 244, 255]
  ctx.save()
  ctx.globalAlpha = opacity
  const blobs: [number, number, number, number][] = [
    [0,        0,      w * 0.52, h * 0.78],
    [-w * 0.32, h*0.10, w * 0.38, h * 0.68],
    [ w * 0.32, h*0.10, w * 0.38, h * 0.68],
    [-w * 0.18,-h*0.30, w * 0.30, h * 0.55],
    [ w * 0.18,-h*0.24, w * 0.28, h * 0.50],
    [-w * 0.48, h*0.22, w * 0.24, h * 0.48],
    [ w * 0.48, h*0.18, w * 0.22, h * 0.45],
  ]
  for (const [dx, dy, rx, ry] of blobs) {
    const grd = ctx.createRadialGradient(cx+dx, cy+dy, 0, cx+dx, cy+dy, Math.max(rx, ry))
    grd.addColorStop(0,   `rgba(${r},${g},${b},0.90)`)
    grd.addColorStop(0.5, `rgba(${r},${g},${b},0.38)`)
    grd.addColorStop(1,   `rgba(${r},${g},${b},0)`)
    ctx.beginPath()
    ctx.ellipse(cx+dx, cy+dy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = grd
    ctx.fill()
  }
  ctx.restore()
}
