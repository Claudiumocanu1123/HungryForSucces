'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NPCWithState, DayStage, STAGES } from '@/types'
import { getCityStageCoords } from '@/lib/cityCoords'
import { fetchRoute, reverseRoute, posOnRoute } from '@/lib/routeService'
import { FeedEvent } from './WorldFeed'
import DetailPanel from './DetailPanel'
import NPCPanel from './ui/NPCPanel'
import InfoPanel from './ui/InfoPanel'

// ── Constants ─────────────────────────────────────────────────────────────────
const IASI_CENTER: [number, number] = [47.1585, 27.6014]
const DICE = 'https://api.dicebear.com/7.x/adventurer/svg?seed='

const NPC_ACCENTS: Record<string, string> = {
  elena: '#a29bfe', mihai: '#fd79a8', ana: '#00cec9',
  bogdan: '#00b894', maria: '#fdcb6e', andrei: '#e17055',
  cristina: '#ffd700', radu: '#74b9ff', iulia: '#55efc4', dan: '#b2bec3',
}
const accent = (id: string) => NPC_ACCENTS[id] ?? '#7b7bf8'

const STAGE_ICON: Record<string, string> = {
  WAKE_UP:'🏠', MORNING:'☕', WORK:'💼', LUNCH:'🍽️',
  AFTERNOON:'⚡', COMMUTE:'🚗', EVENING:'🌆', NIGHT:'🌙',
}
const STAGE_LABEL: Record<string, string> = {
  WAKE_UP:'Acasă', MORNING:'Dimineață', WORK:'La serviciu',
  LUNCH:'Prânz', AFTERNOON:'Activitate', COMMUTE:'Navetă',
  EVENING:'Seară', NIGHT:'Noapte',
}

// ── Sky theme system ──────────────────────────────────────────────────────────
interface SkyFrame { t:number; top:string; mid:string; bot:string; starsA:number; warmth:number; sunA:number; moonA:number }
const SKY: SkyFrame[] = [
  { t:0,  top:'#020510', mid:'#070c28', bot:'#0d1040', starsA:1.0, warmth:0,   sunA:0,   moonA:0.9 },
  { t:5,  top:'#0d1a50', mid:'#7a2c00', bot:'#d45000', starsA:0.5, warmth:0.4, sunA:0,   moonA:0.5 },
  { t:6,  top:'#1e3a8a', mid:'#c2440a', bot:'#ff7b1a', starsA:0.1, warmth:0.7, sunA:0.7, moonA:0.1 },
  { t:7,  top:'#1976d2', mid:'#42a5f5', bot:'#90caf9', starsA:0,   warmth:0.3, sunA:1.0, moonA:0   },
  { t:10, top:'#0d47a1', mid:'#1976d2', bot:'#64b5f6', starsA:0,   warmth:0,   sunA:1.0, moonA:0   },
  { t:12, top:'#0b3d91', mid:'#1565c0', bot:'#42a5f5', starsA:0,   warmth:0,   sunA:1.0, moonA:0   },
  { t:15, top:'#0d47a1', mid:'#1976d2', bot:'#64b5f6', starsA:0,   warmth:0.1, sunA:1.0, moonA:0   },
  { t:17, top:'#5d1a00', mid:'#bf4c00', bot:'#ff8c00', starsA:0,   warmth:0.8, sunA:0.9, moonA:0   },
  { t:18, top:'#3a0a50', mid:'#8b2252', bot:'#e04000', starsA:0.1, warmth:0.9, sunA:0.4, moonA:0.3 },
  { t:20, top:'#15053a', mid:'#2a0a5a', bot:'#4a1060', starsA:0.7, warmth:0.2, sunA:0,   moonA:0.8 },
  { t:22, top:'#020510', mid:'#070c28', bot:'#0d1040', starsA:1.0, warmth:0,   sunA:0,   moonA:0.95},
  { t:24, top:'#020510', mid:'#070c28', bot:'#0d1040', starsA:1.0, warmth:0,   sunA:0,   moonA:0.9 },
]

function lerp(a:number,b:number,t:number){return a+(b-a)*t}
function hexToRgb(h:string){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}}
function lerpHex(h1:string,h2:string,t:number){
  const a=hexToRgb(h1),b=hexToRgb(h2)
  return `rgb(${Math.round(lerp(a.r,b.r,t))},${Math.round(lerp(a.g,b.g,t))},${Math.round(lerp(a.b,b.b,t))})`
}
function getSky(hour:number){
  let i=0
  for(let k=0;k<SKY.length-1;k++){if(hour>=SKY[k].t&&hour<SKY[k+1].t){i=k;break}}
  const a=SKY[i],b=SKY[Math.min(i+1,SKY.length-1)]
  const t=Math.max(0,Math.min(1,(hour-a.t)/Math.max(b.t-a.t,0.001)))
  return{
    top:lerpHex(a.top,b.top,t),mid:lerpHex(a.mid,b.mid,t),bot:lerpHex(a.bot,b.bot,t),
    starsA:lerp(a.starsA,b.starsA,t),warmth:lerp(a.warmth,b.warmth,t),
    sunA:lerp(a.sunA,b.sunA,t),moonA:lerp(a.moonA,b.moonA,t),
  }
}

// UI accent per time
function uiAccent(hour:number){
  if(hour<5||hour>=22) return{fg:'#7b7bf8',bg:'rgba(91,91,245,0.15)',border:'rgba(91,91,245,0.35)'}
  if(hour<8)  return{fg:'#ff9a3a',bg:'rgba(255,150,50,0.15)',border:'rgba(255,150,50,0.35)'}
  if(hour<13) return{fg:'#4fc3f7',bg:'rgba(79,195,247,0.12)',border:'rgba(79,195,247,0.30)'}
  if(hour<17) return{fg:'#00e5cc',bg:'rgba(0,229,204,0.10)',border:'rgba(0,229,204,0.28)'}
  if(hour<20) return{fg:'#ffb300',bg:'rgba(255,179,0,0.15)',border:'rgba(255,179,0,0.35)'}
  return{fg:'#9c27b0',bg:'rgba(156,39,176,0.12)',border:'rgba(156,39,176,0.30)'}
}

// Seeded RNG for stable star positions
function lcg(seed:number){let s=seed;return()=>{s=(1664525*s+1013904223)&0xffffffff;return(s>>>0)/0x100000000}}

// NPC spread (collision avoidance)
function spreadNPCs(npcs:NPCWithState[],stage:DayStage):Map<string,[number,number]>{
  const pos=new Map<string,[number,number]>()
  for(const n of npcs){const p=getCityStageCoords(n,stage);pos.set(n.id,[p[0],p[1]])}
  const MIN=0.0030
  for(let iter=0;iter<80;iter++){
    const arr=Array.from(pos.entries())
    for(let i=0;i<arr.length;i++){
      for(let j=i+1;j<arr.length;j++){
        const[id1,p1]=arr[i],[id2,p2]=arr[j]
        const dlat=p1[0]-p2[0],dlngRaw=p1[1]-p2[1],dlng=dlngRaw*0.65
        const dist=Math.sqrt(dlat*dlat+dlng*dlng)
        if(dist<MIN&&dist>0.000001){
          const f=(MIN-dist)/dist*0.5
          pos.set(id1,[p1[0]+dlat*f,p1[1]+dlngRaw*f])
          pos.set(id2,[p2[0]-dlat*f,p2[1]-dlngRaw*f])
        }
      }
    }
  }
  return pos
}

// Stage duration — keep in sync with simulationClock.ts and useDayTime.ts
const STAGE_DUR_MS=20_000

// Easing
function easeInOut(t:number){return t<0.5?2*t*t:-1+(4-2*t)*t}
function easeOut(t:number){return 1-(1-t)*(1-t)}

// ── NPC route data (pre-fetched per NPC) ──────────────────────────────────────
export interface NPCRoutes {
  toWork:   [number,number][]   // home → work  (MORNING stage)
  toLunch:  [number,number][]   // work → lunch spot (first half of LUNCH stage)
  fromLunch:[number,number][]   // lunch spot → work (second half of LUNCH stage)
  toHome:   [number,number][]   // work → home  (COMMUTE stage)
}

// Micro-movement: envelope = sin(prog*π) so offset is zero at stage transitions
function addMicro(base:[number,number],prog:number,nowMs:number,id:string):[number,number]{
  const s=id.charCodeAt(0)*0.37+id.charCodeAt(1%id.length)*0.19
  const t=nowMs/1000
  const r=0.00018 // ~20 metres
  const env=Math.sin(prog*Math.PI) // 0 at edges, max at midpoint
  const lat=(Math.sin(t*0.18+s)*r+Math.sin(t*0.41+s*2.1)*r*0.45)*env
  const lng=(Math.cos(t*0.13+s*1.4)*r*0.7+Math.cos(t*0.37+s*0.8)*r*0.35)*env
  return[base[0]+lat,base[1]+lng]
}

// ── Compute NPC position for current moment ───────────────────────────────────
function computeNPCPos(
  npc:NPCWithState,
  si:number,
  elapsed:number,
  routes:Map<string,NPCRoutes>,
  spreadPos:Map<string,[number,number]>
):[number,number]{
  const prog=Math.min(Math.max(elapsed/STAGE_DUR_MS,0),1)
  const stage=STAGES[si]
  const r=routes.get(npc.id)
  const now=Date.now()

  // Travel stages — follow route exactly
  if(stage==='MORNING'&&r?.toWork?.length) return posOnRoute(r.toWork,easeInOut(prog))
  if(stage==='COMMUTE'&&r?.toHome?.length) return posOnRoute(r.toHome,easeInOut(prog))

  // Lunch — mini round trip inside the stage
  if(stage==='LUNCH'){
    if(prog<0.32&&r?.toLunch?.length) return posOnRoute(r.toLunch,easeInOut(prog/0.32))
    if(prog>0.68&&r?.fromLunch?.length) return posOnRoute(r.fromLunch,easeInOut((prog-0.68)/0.32))
    const lunchRaw=getCityStageCoords(npc,'LUNCH')
    return addMicro(lunchRaw,(prog-0.32)/(0.68-0.32),now,npc.id)
  }

  // Stationary stages — full sinusoidal blend raw→spread→raw:
  // • prog=0  → rawPos  (exact route endpoint — no jump on transition)
  // • prog=0.5 → spreadPos (collision-avoided, maximum spread at midpoint)
  // • prog=1  → rawPos  (exact route startpoint — no jump on transition)
  // sin(prog*π) gives smooth 0→1→0 curve, zero at BOTH boundaries regardless
  // of when the client polls. No step-function blend window.
  const rawPos=getCityStageCoords(npc,stage)
  const sp=spreadPos.get(npc.id)??rawPos
  const blend=Math.sin(prog*Math.PI)
  const base:[number,number]=[rawPos[0]+(sp[0]-rawPos[0])*blend, rawPos[1]+(sp[1]-rawPos[1])*blend]
  return addMicro(base,prog,now,npc.id)
}

// Is this stage a travel (commute) stage?
function isTravelStage(si:number):boolean{
  const s=STAGES[si]
  return s==='MORNING'||s==='COMMUTE'
}

// Activity label for display
function activityLabel(si:number,prog:number):{icon:string;text:string}{
  const s=STAGES[si]
  if(s==='MORNING') return{icon:'🚗',text:`Navetă spre serviciu`}
  if(s==='COMMUTE') return{icon:'🚗',text:`Navetă spre casă`}
  if(s==='LUNCH'){
    if(prog<0.32) return{icon:'🚶',text:'Spre prânz'}
    if(prog>0.68) return{icon:'🚶',text:'Înapoi la serviciu'}
    return{icon:'🍽️',text:'La prânz'}
  }
  if(s==='WORK'||s==='AFTERNOON') return{icon:'💼',text:'La serviciu'}
  if(s==='WAKE_UP') return{icon:'🏠',text:'Acasă'}
  if(s==='NIGHT') return{icon:'🌙',text:'Noapte'}
  if(s==='EVENING') return{icon:'🌆',text:'Seară'}
  return{icon:'📍',text:s}
}

// ── City Background — replaces Leaflet map ───────────────────────────────────
// Geographic bounds the panoramic image covers — calibrated to match
// the real Iași districts defined in cityCoords.ts (all NPC positions fall inside)
// Lat: 47.130–47.185, Lng: 27.553–47.650 with some padding on each side
const IMG_BOUNDS = { minLat:47.125, maxLat:47.190, minLng:27.550, maxLng:27.655 }
const BG_IMG = '/Gemini_Generated_Image_uz2m09uz2m09uz2m.png'
const BSIZE = 44  // NPC bubble diameter px

function latLngToPixel(lat:number,lng:number,dims:{w:number;h:number}):[number,number]{
  const x=(lng-IMG_BOUNDS.minLng)/(IMG_BOUNDS.maxLng-IMG_BOUNDS.minLng)*dims.w
  const y=(IMG_BOUNDS.maxLat-lat)/(IMG_BOUNDS.maxLat-IMG_BOUNDS.minLat)*dims.h
  return[x,y]
}

function getImgFilter(h:number):string{
  if(h>=22||h<5)  return'brightness(0.50) saturate(0.72)'
  if(h<7)         return'brightness(0.70) saturate(1.15) sepia(0.10)'
  if(h<9)         return'brightness(0.82) saturate(1.08)'
  if(h<17)        return'brightness(0.94) saturate(1.04)'
  if(h<20)        return'brightness(0.70) saturate(1.22) sepia(0.06)'
  return           'brightness(0.58) saturate(0.82)'
}

function getTimeOverlay(h:number):string{
  if(h>=22||h<5)  return'rgba(5,10,40,0.30)'
  if(h<7)         return'rgba(150,55,0,0.09)'
  if(h<17)        return'rgba(0,0,0,0)'
  if(h<20)        return'rgba(170,45,0,0.08)'
  return           'rgba(8,18,55,0.20)'
}

interface CityBgProps {
  npcs:NPCWithState[];stageIndex:number;startedAt:number
  activeInteractions:Set<string>;spreadPos:Map<string,[number,number]>
  routes:Map<string,NPCRoutes>;selectedId:string|null
  onSelect:(npc:NPCWithState)=>void
  timeOfDay:number;progress:number;dims:{w:number;h:number}
  ua:ReturnType<typeof uiAccent>
}

function CityBackground({
  npcs,stageIndex,startedAt,activeInteractions,spreadPos,routes,
  selectedId,onSelect,timeOfDay,progress,dims,ua
}:CityBgProps){
  const bubbleEls=useRef<Map<string,HTMLDivElement>>(new Map())
  const lastPosRef=useRef<Map<string,[number,number]>>(new Map())
  const rafRef=useRef<number|null>(null)

  // Mutable refs — rAF loop reads these without causing re-renders
  const siRef=useRef(stageIndex)
  const startedAtRef=useRef(startedAt)
  const routesRef=useRef(routes)
  const spreadPosRef=useRef(spreadPos)
  const dimsRef=useRef(dims)
  siRef.current=stageIndex
  startedAtRef.current=startedAt
  routesRef.current=routes
  spreadPosRef.current=spreadPos
  dimsRef.current=dims

  const imgFilter=useMemo(()=>getImgFilter(timeOfDay),[timeOfDay])
  const overlay  =useMemo(()=>getTimeOverlay(timeOfDay),[timeOfDay])

  // 60fps loop — updates CSS transforms directly, zero React state
  useEffect(()=>{
    const animate=()=>{
      rafRef.current=requestAnimationFrame(animate)
      const elapsed=Date.now()-startedAtRef.current
      const si=siRef.current
      const d=dimsRef.current
      npcs.forEach(npc=>{
        const el=bubbleEls.current.get(npc.id)
        if(!el||!d.w)return
        const target=computeNPCPos(npc,si,elapsed,routesRef.current,spreadPosRef.current)
        const prev=lastPosRef.current.get(npc.id)
        const pos:[number,number]=prev
          ?[prev[0]+(target[0]-prev[0])*0.14,prev[1]+(target[1]-prev[1])*0.14]
          :target
        lastPosRef.current.set(npc.id,pos)
        const[x,y]=latLngToPixel(pos[0],pos[1],d)
        el.style.transform=`translate(${x-BSIZE/2}px,${y-BSIZE/2}px)`
      })
    }
    rafRef.current=requestAnimationFrame(animate)
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[npcs])

  // SVG route paths
  const routePaths=useMemo(()=>{
    if(!dims.w||!dims.h)return[]
    return npcs.flatMap(npc=>{
      const r=routes.get(npc.id)
      if(!r)return[]
      const ac=accent(npc.id)
      const isSel=selectedId===npc.id
      const segments=[r.toWork,r.toLunch,r.fromLunch,r.toHome].filter(s=>s&&s.length>1)
      return segments.map((seg,i)=>{
        const d=seg.map((pt,j)=>{
          const[x,y]=latLngToPixel(pt[0],pt[1],dims)
          return`${j===0?'M':'L'}${x.toFixed(1)} ${y.toFixed(1)}`
        }).join(' ')
        return{key:`${npc.id}-${i}`,d,color:ac,selected:isSel}
      })
    })
  },[routes,dims,npcs,selectedId])

  return(
    <div style={{position:'absolute',inset:0,overflow:'hidden',userSelect:'none'}}>
      {/* Panoramic city image */}
      <img src={BG_IMG} draggable={false} alt=""
        style={{
          position:'absolute',inset:0,width:'100%',height:'100%',
          objectFit:'cover',objectPosition:'center',
          filter:imgFilter,transition:'filter 4s ease',
          pointerEvents:'none',
        }}
      />

      {/* Time-of-day colour tint */}
      <div style={{
        position:'absolute',inset:0,
        background:overlay,transition:'background 4s ease',
        pointerEvents:'none',zIndex:1,
      }}/>

      {/* Vignette — frames the view, adds depth */}
      <div style={{
        position:'absolute',inset:0,
        background:'radial-gradient(ellipse 88% 82% at 50% 52%, transparent 30%, rgba(2,4,20,0.88) 100%)',
        pointerEvents:'none',zIndex:2,
      }}/>

      {/* Route SVG overlay */}
      {routePaths.length>0&&(
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',pointerEvents:'none',zIndex:3}}>
          {routePaths.map(rp=>(
            <path key={rp.key} d={rp.d} fill="none"
              stroke={rp.color}
              strokeWidth={rp.selected?2.5:1}
              strokeOpacity={rp.selected?0.65:0.16}
              strokeDasharray={rp.selected?undefined:'5 9'}
              strokeLinecap="round" strokeLinejoin="round"
            />
          ))}
        </svg>
      )}

      {/* NPC bubbles — positioned by rAF loop */}
      {npcs.map((npc,idx)=>{
        const ac=accent(npc.id)
        const isSel=selectedId===npc.id
        const isActive=activeInteractions.has(npc.id)
        const firstName=npc.name.split(' ')[0]
        const mood=npc.currentState?.mood??70
        const energy=npc.currentState?.energy??70
        const isSleeping=energy<15||mood<15

        // Synchronous initial position so no flash at (0,0)
        const initTarget=computeNPCPos(npc,stageIndex,Date.now()-startedAt,routes,spreadPos)
        const[ix,iy]=dims.w?latLngToPixel(initTarget[0],initTarget[1],dims):[0,0]

        return(
          <div key={npc.id}
            ref={el=>{if(el)bubbleEls.current.set(npc.id,el);else bubbleEls.current.delete(npc.id)}}
            onClick={()=>onSelect(npc)}
            style={{
              position:'absolute',top:0,left:0,
              transform:`translate(${ix-BSIZE/2}px,${iy-BSIZE/2}px)`,
              cursor:'pointer',zIndex:isSel?100:isActive?50:10+idx,
              filter:isSleeping?'saturate(0.2) brightness(0.55)':undefined,
            }}
          >
            {/* Ambient glow */}
            <div style={{
              position:'absolute',
              width:BSIZE+28,height:BSIZE+28,
              top:-(28/2),left:-(28/2),
              borderRadius:'50%',
              background:`radial-gradient(circle,${isActive?'#10b981':ac}50 0%,transparent 68%)`,
              animation:isActive?'iasiGlow 1.4s ease-in-out infinite':'iasiGlow 3s ease-in-out infinite',
              animationDelay:`${idx*0.35}s`,
            }}/>

            {/* Avatar ring */}
            <div style={{
              width:BSIZE,height:BSIZE,borderRadius:'50%',
              overflow:'hidden',position:'relative',
              border:`2.5px solid ${isSel?'#ffffff':isActive?'#10b981':ac}`,
              boxShadow:[
                '0 4px 18px rgba(0,0,0,0.75)',
                '0 0 0 1.5px rgba(0,0,0,0.45)',
                isSel?'0 0 0 4px rgba(255,255,255,0.22), 0 0 22px rgba(255,255,255,0.28)':`0 0 16px ${ac}88`,
                isActive?'0 0 0 4px rgba(16,185,129,0.28)':'',
              ].filter(Boolean).join(','),
              animation:'iasiFloat 3s ease-in-out infinite',
              animationDelay:`${idx*0.28}s`,
              background:'#0d1230',
            }}>
              <img src={`${DICE}${encodeURIComponent(firstName)}`}
                width={BSIZE} height={BSIZE}
                style={{display:'block',borderRadius:'50%'}}
                loading="lazy" draggable={false}
              />
              {isSel&&<div style={{position:'absolute',inset:-5,borderRadius:'50%',border:'2px solid #fff',animation:'iasiRingW 1.2s ease-out infinite'}}/>}
              {isActive&&<div style={{position:'absolute',inset:-6,borderRadius:'50%',border:'1.5px solid #10b981',animation:'iasiRing 1.5s ease-out infinite'}}/>}
            </div>

            {/* Needle */}
            <div style={{width:2,height:11,borderRadius:'0 0 2px 2px',background:`linear-gradient(${ac}cc,transparent)`,margin:'-1px auto 0'}}/>

            {/* Name chip */}
            <div style={{
              background:'rgba(4,6,24,0.88)',
              border:`1px solid ${isSel?'rgba(255,255,255,0.35)':ac+'44'}`,
              borderRadius:7,padding:'2px 7px',
              display:'flex',alignItems:'center',gap:4,
              whiteSpace:'nowrap',backdropFilter:'blur(12px)',
              marginTop:1,
            }}>
              <span style={{fontSize:9,fontWeight:700,color:'#fff'}}>{firstName}</span>
              {isActive&&<span style={{fontSize:8,color:'#10b981',fontWeight:700}}>●</span>}
            </div>
          </div>
        )
      })}

      {/* Stage progress bar */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:'rgba(255,255,255,0.04)',zIndex:20}}>
        <div style={{
          height:'100%',width:`${progress*100}%`,
          background:`linear-gradient(90deg,${ua.fg},${ua.fg}cc)`,
          boxShadow:`0 0 8px ${ua.fg}`,
          transition:'width 1s linear',
        }}/>
      </div>
    </div>
  )
}

// Weather simulation
function getWeather(hour:number){
  if(hour<6)  return{icon:'🌙',desc:'Cer senin',temp:12,hum:55,wind:8,pres:1016}
  if(hour<9)  return{icon:'🌤',desc:'Parțial înnorat',temp:15,hum:60,wind:10,pres:1015}
  if(hour<13) return{icon:'☀️',desc:'Însorit',temp:20,hum:45,wind:12,pres:1013}
  if(hour<17) return{icon:'☀️',desc:'Însorit',temp:24,hum:40,wind:14,pres:1012}
  if(hour<20) return{icon:'🌅',desc:'Însorit',temp:20,hum:50,wind:11,pres:1013}
  return{icon:'🌙',desc:'Cer senin',temp:15,hum:58,wind:7,pres:1015}
}

// ── Sky Canvas ────────────────────────────────────────────────────────────────
function SkyCanvas({timeOfDay,sky,width,height}:{timeOfDay:number;sky:ReturnType<typeof getSky>;width:number;height:number}){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const rafRef=useRef<number|null>(null)
  const lastRef=useRef(0)

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d');if(!ctx)return
    const rng=lcg(42)
    const stars=Array.from({length:220},()=>({x:rng(),y:rng()*0.6,r:rng()*1.4+0.3}))

    const draw=(ts:number)=>{
      rafRef.current=requestAnimationFrame(draw)
      if(ts-lastRef.current<40)return
      lastRef.current=ts
      const W=canvas.width,H=canvas.height

      // Sky gradient — covers top half, fades to transparent at bottom
      const grad=ctx.createLinearGradient(0,0,0,H)
      grad.addColorStop(0,sky.top)
      grad.addColorStop(0.45,sky.mid)
      grad.addColorStop(0.75,sky.bot)
      grad.addColorStop(1,'rgba(0,0,0,0)')
      ctx.clearRect(0,0,W,H)
      ctx.fillStyle=grad
      ctx.fillRect(0,0,W,H)

      // Warmth overlay at horizon
      if(sky.warmth>0.05){
        const wGrad=ctx.createRadialGradient(W*0.5,H*0.8,0,W*0.5,H*0.8,W*0.6)
        wGrad.addColorStop(0,`rgba(255,140,0,${sky.warmth*0.35})`)
        wGrad.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=wGrad
        ctx.fillRect(0,0,W,H)
      }

      // Stars
      if(sky.starsA>0.05){
        stars.forEach(s=>{
          ctx.beginPath()
          ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2)
          ctx.fillStyle=`rgba(255,255,255,${s.r/1.7*sky.starsA})`
          ctx.fill()
        })
      }

      // Sun arc position
      const DAY_S=5,DAY_E=19.5
      const sunT=Math.max(0,Math.min(1,(timeOfDay-DAY_S)/(DAY_E-DAY_S)))
      const sunAngle=Math.PI-sunT*Math.PI
      const sunX=W*0.5+W*0.46*Math.cos(sunAngle)
      const sunY=H*0.85-H*0.88*Math.sin(Math.max(0,sunT*(1-sunT)*4)*(Math.PI/2))
      const isDaytime=timeOfDay>=DAY_S&&timeOfDay<DAY_E

      // Sun
      if(isDaytime&&sky.sunA>0.05&&sunY<H+40){
        const sg=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,60)
        sg.addColorStop(0,`rgba(255,248,180,${sky.sunA})`)
        sg.addColorStop(0.2,`rgba(255,220,50,${sky.sunA*0.85})`)
        sg.addColorStop(0.5,`rgba(255,150,0,${sky.sunA*0.4})`)
        sg.addColorStop(1,'rgba(255,100,0,0)')
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sunX,sunY,60,0,Math.PI*2);ctx.fill()
        // core
        ctx.beginPath();ctx.arc(sunX,sunY,16,0,Math.PI*2)
        ctx.fillStyle=`rgba(255,255,220,${sky.sunA})`
        ctx.fill()
      }

      // Moon
      const moonHour=(timeOfDay+12)%24
      const moonT=Math.max(0,Math.min(1,(moonHour-DAY_S)/(DAY_E-DAY_S)))
      const moonAngle=Math.PI-moonT*Math.PI
      const moonX=W*0.5+W*0.46*Math.cos(moonAngle)
      const moonY=H*0.85-H*0.88*Math.sin(Math.max(0,moonT*(1-moonT)*4)*(Math.PI/2))
      const isMoonUp=moonHour>=DAY_S&&moonHour<DAY_E
      if(isMoonUp&&sky.moonA>0.05&&moonY<H+30){
        const mg=ctx.createRadialGradient(moonX,moonY,0,moonX,moonY,28)
        mg.addColorStop(0,`rgba(220,235,255,${sky.moonA*0.3})`)
        mg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=mg;ctx.beginPath();ctx.arc(moonX,moonY,28,0,Math.PI*2);ctx.fill()
        ctx.beginPath();ctx.arc(moonX,moonY,12,0,Math.PI*2)
        ctx.fillStyle=`rgba(210,228,255,${sky.moonA*0.9})`;ctx.fill()
        ctx.beginPath();ctx.arc(moonX+5,moonY,10,0,Math.PI*2)
        ctx.fillStyle=`rgba(5,8,30,${sky.moonA*0.8})`;ctx.fill()
      }
    }
    rafRef.current=requestAnimationFrame(draw)
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[sky,timeOfDay])

  return(
    <canvas ref={canvasRef} width={width} height={height}
      style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:5}}
    />
  )
}

// ── Cloud Layer ───────────────────────────────────────────────────────────────
function CloudLayer({sky}:{sky:ReturnType<typeof getSky>}){
  const alpha=sky.starsA<0.8?0.06+sky.warmth*0.05:0
  if(alpha<0.01)return null
  return(
    <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:4,overflow:'hidden'}}>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{
          position:'absolute',
          width:`${180+i*70}px`,height:`${45+i*18}px`,
          background:`rgba(255,255,255,${alpha})`,
          borderRadius:'50%',filter:'blur(22px)',
          top:`${8+i*6}%`,left:`${-10+i*22}%`,
          animation:`cloudDrift ${22+i*9}s linear infinite`,
          animationDelay:`${i*-4}s`,
        }}/>
      ))}
    </div>
  )
}

// ── NPC Map Layer (Leaflet) ───────────────────────────────────────────────────
interface NPCLayerProps {
  npcs:NPCWithState[];stage:DayStage;stageIndex:number;startedAt:number
  activeInteractions:Set<string>
  interactionPairs:Array<[string,string]>;spreadPos:Map<string,[number,number]>
  routes:Map<string,NPCRoutes>
  selectedId:string|null;onSelect:(npc:NPCWithState)=>void
}

function NPCMapLayer({npcs,stage,stageIndex,startedAt,activeInteractions,interactionPairs,spreadPos,routes,selectedId,onSelect}:NPCLayerProps){
  const map=useMap()
  const markersRef=useRef<Map<string,L.Marker>>(new Map())
  const linesRef=useRef<L.Polyline[]>([])
  const routeRef=useRef<L.Polyline[]>([])
  const wpRef=useRef<L.Marker[]>([])
  const trailRef=useRef<Map<string,L.Polyline>>(new Map())
  const trailPtsRef=useRef<Map<string,[number,number][]>>(new Map())
  const lastPosRef=useRef<Map<string,[number,number]>>(new Map())
  const rafRef=useRef<number|null>(null)

  // Mutable refs synced every render — animation loop reads these directly
  const siRef=useRef(stageIndex)
  const startedAtRef=useRef(startedAt)
  const routesRef=useRef(routes)
  const spreadPosRef=useRef(spreadPos)
  const activeRef=useRef(activeInteractions)
  const selectedRef=useRef(selectedId)
  // Sync every render (cheap, no effect needed)
  siRef.current=stageIndex
  startedAtRef.current=startedAt
  routesRef.current=routes
  spreadPosRef.current=spreadPos
  activeRef.current=activeInteractions
  selectedRef.current=selectedId

  // Stable createIcon — uses si/prog args, NOT stage prop → empty deps → never stale
  const createIcon=useCallback((npc:NPCWithState,isActive:boolean,isSelected:boolean,delay:number,si:number,prog:number)=>{
    const ac=accent(npc.id)
    const glowC=isActive?'#10b981':ac
    const mood=npc.currentState?.mood??70
    const energy=npc.currentState?.energy??70
    const isSleeping=energy<15||mood<15
    const firstName=npc.name.split(' ')[0]
    const sz=isSelected?50:42
    const satStyle=isSleeping?'filter:saturate(0.25) brightness(0.6);':''
    const selectRing=isSelected?`<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid #fff;animation:iasiRingW 1.2s ease-out infinite;"></div>`:''
    const activeRing=isActive?`<div style="position:absolute;inset:-6px;border-radius:50%;border:1.5px solid #10b981;animation:iasiRing 1.5s ease-out infinite;"></div>`:''
    const act=activityLabel(si,prog)
    const isMoving=isTravelStage(si)||(STAGES[si]==='LUNCH'&&(prog<0.32||prog>0.68))
    return L.divIcon({
      html:`
        <div class="iasi-pin" style="animation-delay:${delay}s;${satStyle}${isMoving?'animation-duration:1.2s;':''}">
          <div class="iasi-glow" style="background:${glowC};${isMoving?'animation-duration:0.8s;':''}"></div>
          <div class="iasi-av" style="width:${sz}px;height:${sz}px;border-color:${glowC};box-shadow:0 4px 18px rgba(0,0,0,0.55),0 0 0 2.5px rgba(255,255,255,0.12),0 0 20px ${glowC}44;">
            ${selectRing}${activeRing}
            ${isMoving?`<div style="position:absolute;inset:0;border-radius:50%;border:2px solid ${glowC};animation:iasiRing 1.2s ease-out infinite;z-index:2;"></div>`:''}
            <img src="${DICE}${encodeURIComponent(firstName)}" width="${sz}" height="${sz}" style="border-radius:50%;display:block;" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('beforeend','<div style=\\'width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.floor(sz*0.44)}px;font-weight:900;color:#fff;background:${ac};\\'>'+\`${npc.name[0]}\`+'</div>')" />
          </div>
          <div class="iasi-needle" style="background:linear-gradient(${glowC}cc,transparent);"></div>
          <div class="iasi-lbl" style="border-color:${glowC}44;${isSelected?'background:rgba(5,8,28,0.97);border-color:'+glowC+'88;':''}">
            <span style="font-size:10px;font-weight:700;color:#fff;">${firstName}</span>
            <span style="font-size:10px;">${act.icon}</span>
            ${isActive?'<span style="font-size:8px;color:#10b981;font-weight:700;">●</span>':''}
          </div>
          ${isMoving?`<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:${glowC}22;border:1px solid ${glowC}88;border-radius:4px;padding:1px 5px;font-size:7px;color:${glowC};font-family:Inter,sans-serif;white-space:nowrap;font-weight:700;">EN ROUTE</div>`:''}
        </div>`,
      className:'iasi-icon',
      iconSize:[60,76],iconAnchor:[30,76],popupAnchor:[0,-76],
    })
  },[]) // ← STABLE — no stage/stageIndex in deps

  // ── Effect 1: Create markers + trails ONCE (only when npcs list changes) ─────
  // Markers created once — stage/routes/spreadPos updates go through refs only
  useEffect(()=>{
    markersRef.current.forEach(m=>m.remove()); markersRef.current.clear()
    trailRef.current.forEach(l=>l.remove()); trailRef.current.clear()
    trailPtsRef.current.clear()
    lastPosRef.current.clear()

    const si=siRef.current
    const elapsed=Date.now()-startedAtRef.current
    const prog=Math.min(elapsed/STAGE_DUR_MS,1)

    npcs.forEach((npc,idx)=>{
      const pos=computeNPCPos(npc,si,elapsed,routesRef.current,spreadPosRef.current)
      const isActive=activeRef.current.has(npc.id)
      const isSel=selectedRef.current===npc.id
      const icon=createIcon(npc,isActive,isSel,(idx*0.25)%2,si,prog)
      const marker=L.marker(pos,{icon,zIndexOffset:isSel?2000:isActive?1000:idx*10})
      marker.addTo(map)
      marker.on('click',()=>onSelect(npc))
      markersRef.current.set(npc.id,marker)

      const trail=L.polyline([],{color:accent(npc.id),weight:3,opacity:0.85,smoothFactor:1})
      trail.addTo(map); trailRef.current.set(npc.id,trail)
      trailPtsRef.current.set(npc.id,[])
    })

    return()=>{
      markersRef.current.forEach(m=>m.remove()); markersRef.current.clear()
      trailRef.current.forEach(l=>l.remove()); trailRef.current.clear()
      trailPtsRef.current.clear()
      lastPosRef.current.clear()
    }
  },[npcs,map,onSelect,createIcon])

  // ── Effect 2: Route lines + waypoints (stage/selection/routes change) ─────────
  useEffect(()=>{
    routeRef.current.forEach(l=>l.remove()); routeRef.current=[]
    wpRef.current.forEach(m=>m.remove()); wpRef.current=[]

    const mkWp=(emoji:string,sz:number,pos:[number,number],ac:string,zOff:number)=>{
      const icon=L.divIcon({
        html:`<div style="width:${sz}px;height:${sz}px;border-radius:${Math.round(sz/4)}px;background:${ac}30;border:1.5px solid ${ac}66;display:flex;align-items:center;justify-content:center;font-size:${Math.round(sz*0.56)}px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${emoji}</div>`,
        className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2],
      })
      const m=L.marker(pos,{icon,zIndexOffset:zOff,interactive:false})
      m.addTo(map); wpRef.current.push(m)
    }

    npcs.forEach(npc=>{
      const ac=accent(npc.id)
      const isSel=selectedId===npc.id
      const r=routes.get(npc.id)
      const allSP=STAGES.map(s=>getCityStageCoords(npc,s))
      const dayPath:[number,number][]=[
        ...(r?.toWork??[allSP[0],allSP[2]]),
        ...(r?.toLunch??[allSP[2],allSP[3]]),
        ...(r?.fromLunch??[allSP[3],allSP[2]]),
        ...(r?.toHome??[allSP[4],allSP[0]]),
      ]

      // Solid past portion
      const tw=r?.toWork?.length??2,tl=r?.toLunch?.length??2,fl=r?.fromLunch?.length??2
      const pastN=stageIndex<=1?tw:stageIndex<=3?tw+tl:stageIndex<=5?tw+tl+fl:tw+tl+fl+(r?.toHome?.length??2)
      if(pastN>1){
        const pl=L.polyline(dayPath.slice(0,Math.min(pastN,dayPath.length)),{color:ac,weight:isSel?2.5:1.5,opacity:isSel?0.75:0.28,smoothFactor:1})
        pl.addTo(map); routeRef.current.push(pl)
      }
      // Dashed future
      if(dayPath.length>1){
        const fl2=L.polyline(dayPath,{color:ac,weight:isSel?1.5:1,opacity:isSel?0.35:0.12,dashArray:'5 10',smoothFactor:1})
        fl2.addTo(map); routeRef.current.push(fl2)
      }

      mkWp('🏠',16,allSP[0],ac,-300)
      mkWp('💼',16,allSP[2],ac,-300)

      if(isSel){
        [{p:allSP[0],ic:'🏠',lb:'Acasă',i:0},{p:allSP[2],ic:'💼',lb:'Serviciu',i:2},
         {p:allSP[3],ic:'🍽️',lb:'Prânz',i:3},{p:allSP[6],ic:'🌆',lb:'Seară',i:6}
        ].forEach(({p,ic,lb,i})=>{
          const past=i<=stageIndex
          const wp=L.divIcon({
            html:`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              <div style="width:26px;height:26px;border-radius:7px;background:${past?ac+'55':'rgba(10,14,40,0.9)'};border:2px solid ${past?ac:'rgba(255,255,255,0.22)'};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 3px 10px rgba(0,0,0,0.6);">${ic}</div>
              <div style="background:rgba(3,5,20,0.92);border:1px solid ${past?ac+'55':'rgba(255,255,255,0.12)'};border-radius:5px;padding:2px 6px;font-size:8px;font-weight:700;color:rgba(255,255,255,0.75);font-family:Inter,sans-serif;white-space:nowrap;">${lb}</div>
            </div>`,
            className:'',iconSize:[60,42],iconAnchor:[30,13],
          })
          const m=L.marker(p as [number,number],{icon:wp,zIndexOffset:-200,interactive:false})
          m.addTo(map); wpRef.current.push(m)
        })
      }
    })

    return()=>{
      routeRef.current.forEach(l=>l.remove()); routeRef.current=[]
      wpRef.current.forEach(m=>m.remove()); wpRef.current=[]
    }
  },[npcs,stageIndex,selectedId,routes,map])

  // ── Effect 3: Interaction lines ───────────────────────────────────────────────
  useEffect(()=>{
    linesRef.current.forEach(l=>l.remove()); linesRef.current=[]
    interactionPairs.forEach(([id1,id2])=>{
      const p1=markersRef.current.get(id1)?.getLatLng()
      const p2=markersRef.current.get(id2)?.getLatLng()
      if(!p1||!p2)return
      const n1=npcs.find(n=>n.id===id1)
      const ac=n1?accent(n1.id):'#10b981'
      const line=L.polyline([[p1.lat,p1.lng],[p2.lat,p2.lng]],{color:ac,weight:2,opacity:0.65,dashArray:'6 4',className:'iasi-interaction-line'})
      line.addTo(map); linesRef.current.push(line)
    })
    return()=>{linesRef.current.forEach(l=>l.remove()); linesRef.current=[]}
  },[interactionPairs,npcs,map])

  // ── Effect 4: 60fps rAF — reads only from refs, minimal React deps ───────────
  useEffect(()=>{
    let lastIconUpdate=0
    const MAX_TRAIL=80
    const animate=()=>{
      rafRef.current=requestAnimationFrame(animate)
      const now=Date.now()
      const elapsed=now-startedAtRef.current
      const si=siRef.current
      npcs.forEach(npc=>{
        const marker=markersRef.current.get(npc.id)
        if(!marker)return
        const target=computeNPCPos(npc,si,elapsed,routesRef.current,spreadPosRef.current)
        // Smooth interpolation toward target position — hides any discontinuities
        const prev=lastPosRef.current.get(npc.id)
        const pos:[number,number]=prev
          ?[prev[0]+(target[0]-prev[0])*0.14, prev[1]+(target[1]-prev[1])*0.14]
          :target
        lastPosRef.current.set(npc.id,pos)
        marker.setLatLng(pos)
        if(isTravelStage(si)){
          const pts=trailPtsRef.current.get(npc.id)??[]
          pts.push(pos)
          if(pts.length>MAX_TRAIL) pts.splice(0,pts.length-MAX_TRAIL)
          trailPtsRef.current.set(npc.id,pts)
          trailRef.current.get(npc.id)?.setLatLngs(pts)
        } else if((trailPtsRef.current.get(npc.id)?.length??0)>0){
          trailPtsRef.current.set(npc.id,[])
          trailRef.current.get(npc.id)?.setLatLngs([])
        }
      })
      if(now-lastIconUpdate>1000){
        lastIconUpdate=now
        const prog=Math.min(elapsed/STAGE_DUR_MS,1)
        npcs.forEach((npc,idx)=>{
          const marker=markersRef.current.get(npc.id)
          if(!marker)return
          marker.setIcon(createIcon(npc,activeRef.current.has(npc.id),selectedRef.current===npc.id,(idx*0.25)%2,si,prog))
        })
      }
    }
    rafRef.current=requestAnimationFrame(animate)
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[npcs,createIcon]) // ← minimal: only npcs changes trigger restart

  return null
}

// ── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel({npcs,activeInteractions,selectedId,onSelect,ua}:{
  npcs:NPCWithState[];activeInteractions:Set<string>;selectedId:string|null
  onSelect:(id:string)=>void;ua:ReturnType<typeof uiAccent>
}){
  return(
    <div style={{
      width:220,flexShrink:0,display:'flex',flexDirection:'column',
      background:'rgba(3,5,20,0.88)',borderRight:'1px solid rgba(255,255,255,0.07)',
      backdropFilter:'blur(18px)',
    }}>
      <div style={{padding:'10px 14px 7px',borderBottom:'1px solid rgba(255,255,255,0.06)',
        display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.7)',letterSpacing:'0.06em'}}>PERSOANE</span>
        <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,
          background:ua.bg,border:`1px solid ${ua.border}`,color:ua.fg,fontWeight:700}}>
          {npcs.length}/10
        </span>
      </div>
      <div style={{flex:1,overflowY:'auto',scrollbarWidth:'none'}}>
        {npcs.map((npc,i)=>{
          const ac=accent(npc.id)
          const mood=npc.currentState?.mood??70
          const energy=npc.currentState?.energy??70
          const isActive=activeInteractions.has(npc.id)
          const isSelected=selectedId===npc.id
          const firstName=npc.name.split(' ')[0]
          const stageLabel=STAGE_LABEL[npc.currentState?.stage??'WAKE_UP']??''
          return(
            <div key={npc.id} onClick={()=>onSelect(npc.id)}
              style={{
                padding:'8px 12px',
                borderBottom:'1px solid rgba(255,255,255,0.035)',
                display:'flex',alignItems:'center',gap:10,cursor:'pointer',
                background:isSelected?`${ac}14`:'transparent',
                borderLeft:isSelected?`3px solid ${ac}`:'3px solid transparent',
                transition:'all 0.15s',
              }}
              onMouseEnter={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'}}
              onMouseLeave={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background='transparent'}}
            >
              {/* Avatar */}
              <div style={{
                width:36,height:36,borderRadius:'50%',flexShrink:0,overflow:'hidden',
                border:`2px solid ${isActive?'#10b981':ac}`,
                boxShadow:isActive?`0 0 12px rgba(16,185,129,0.5)`:`0 0 8px ${ac}44`,
                animation:isActive?'lpPulse 1.8s ease-in-out infinite':'none',
              }}>
                <img src={`${DICE}${encodeURIComponent(firstName)}`}
                  width={36} height={36} style={{display:'block',borderRadius:'50%'}}
                  onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}}
                />
              </div>
              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,fontWeight:700,color:'#fff'}}>{firstName}</span>
                  {isActive&&<span style={{fontSize:8,color:'#10b981',fontWeight:700}}>●</span>}
                </div>
                <div style={{fontSize:9,color:ac,opacity:0.75,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  • {stageLabel}
                </div>
                {/* Bars */}
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{fontSize:7,color:'rgba(255,255,255,0.35)',width:32}}>Energie</span>
                    <div style={{flex:1,height:3,background:'rgba(255,255,255,0.08)',borderRadius:2}}>
                      <div style={{height:'100%',width:`${energy}%`,borderRadius:2,
                        background:energy>50?'#10b981':energy>25?'#f59e0b':'#ef4444',
                        transition:'width 2s ease'}}/>
                    </div>
                    <span style={{fontSize:7,color:'rgba(255,255,255,0.35)',width:22,textAlign:'right'}}>{energy}%</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{fontSize:7,color:'rgba(255,255,255,0.35)',width:32}}>Fericire</span>
                    <div style={{flex:1,height:3,background:'rgba(255,255,255,0.08)',borderRadius:2}}>
                      <div style={{height:'100%',width:`${mood}%`,borderRadius:2,
                        background:mood>70?'#7b7bf8':mood>40?'#f59e0b':'#ef4444',
                        transition:'width 2s ease'}}/>
                    </div>
                    <span style={{fontSize:7,color:'rgba(255,255,255,0.35)',width:22,textAlign:'right'}}>{mood}%</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Right Panel ───────────────────────────────────────────────────────────────
function RightPanel({npcs,events,activeInteractions,day,stage,timeOfDay,ua,onSelect}:{
  npcs:NPCWithState[];events:FeedEvent[];activeInteractions:Set<string>
  day:number;stage:DayStage;timeOfDay:number
  ua:ReturnType<typeof uiAccent>;onSelect:(id:string)=>void
}){
  const weather=useMemo(()=>getWeather(timeOfDay),[timeOfDay])
  const notifs=useMemo(()=>{
    const list:string[]=[]
    for(const n of npcs){
      const e=n.currentState?.energy??70,m=n.currentState?.mood??70
      if(e<25)list.push(`${n.name.split(' ')[0]} are energie critică`)
      else if(m<25)list.push(`${n.name.split(' ')[0]} se simte rău`)
    }
    if(activeInteractions.size>0)list.push(`${activeInteractions.size} interacțiuni active acum`)
    return list.slice(0,4)
  },[npcs,activeInteractions])

  const EVENT_ICONS:Record<string,string>={INTERACTION:'🤝',ACTIVITY:'⚡',MOOD_CHANGE:'😊'}

  return(
    <div style={{
      width:210,flexShrink:0,display:'flex',flexDirection:'column',
      background:'rgba(3,5,20,0.88)',borderLeft:'1px solid rgba(255,255,255,0.07)',
      backdropFilter:'blur(18px)',overflowY:'auto',scrollbarWidth:'none',
    }}>
      {/* Weather */}
      <div style={{padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.07em',marginBottom:6}}>VREMEA</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{fontSize:26}}>{weather.icon}</span>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:'#fff',lineHeight:1}}>{weather.temp}°C</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginTop:2}}>{weather.desc}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
          {([['Umiditate', weather.hum + '%'], ['Vant', weather.wind + 'km/h'], ['Presiune', weather.pres + 'hPa']] as [string,string][]).map((item) => {
            const [k, v] = item
            return (
              <div key={k} style={{background:'rgba(255,255,255,0.04)',borderRadius:6,padding:'4px 6px',textAlign:'center'}}>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.30)'}}>{k === 'Vant' ? 'Vânt' : k}</div>
                <div style={{fontSize:9,fontWeight:600,color:'rgba(255,255,255,0.65)'}}>{v}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Events */}
      <div style={{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.07em',marginBottom:6}}>EVENIMENTE</div>
        {events.slice(0,5).map(ev=>{
          const npc=npcs.find(n=>n.id===ev.npcId)
          const ac=npc?accent(npc.id):'#7b7bf8'
          return(
            <div key={ev.id} onClick={()=>onSelect(ev.npcId)}
              style={{display:'flex',alignItems:'flex-start',gap:7,padding:'4px 0',cursor:'pointer',
                borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
              <div style={{width:22,height:22,borderRadius:6,background:ac+'22',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11}}>
                {EVENT_ICONS[ev.type]||'📌'}
              </div>
              <div>
                <div style={{fontSize:8,color:'rgba(255,255,255,0.30)'}}>{ev.time}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.60)',lineHeight:1.3,
                  overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                  {ev.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Notifications */}
      <div style={{padding:'8px 12px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'0.07em'}}>NOTIFICĂRI</span>
          {notifs.length>0&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:8,
            background:'rgba(239,68,68,0.18)',color:'#ef4444',fontWeight:700}}>{notifs.length}</span>}
        </div>
        {notifs.length===0&&<div style={{fontSize:10,color:'rgba(255,255,255,0.20)',textAlign:'center',padding:'10px 0'}}>Totul e în regulă</div>}
        {notifs.map((n,i)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:7,padding:'5px 0',
            borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
            <div style={{width:22,height:22,borderRadius:6,
              background:n.includes('critic')||n.includes('rău')?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)',
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10}}>
              {n.includes('critic')||n.includes('rău')?'⚠️':'💬'}
            </div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.55)',lineHeight:1.3,paddingTop:3}}>{n}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bottom Timeline ───────────────────────────────────────────────────────────
function BottomTimeline({timeOfDay,day,progress,ua}:{timeOfDay:number;day:number;progress:number;ua:ReturnType<typeof uiAccent>}){
  const phases=[
    {id:'DIMINEAȚA',t:6,grad:'linear-gradient(135deg,#1e3a8a,#c44a00,#ff9a3a)',desc:'Orașul se trezește la viață'},
    {id:'DUPĂ-AMIAZA',t:12,grad:'linear-gradient(135deg,#0d47a1,#1976d2,#64b5f6)',desc:'Activitate intensă în oraș'},
    {id:'APUS',t:18,grad:'linear-gradient(135deg,#5d1a00,#bf4c00,#ff8c00)',desc:'Lumina devine aurie'},
    {id:'NOAPTEA',t:24,grad:'linear-gradient(135deg,#020510,#070c28,#1a1040)',desc:'Orașul adoarme încet'},
  ]
  const sliderPct=(timeOfDay/24)*100
  const sliderGrad='linear-gradient(90deg,#ff8c00 0%,#ffcc00 25%,#4fc3f7 50%,#ff6b00 75%,#7b7bf8 100%)'

  return(
    <div style={{
      flexShrink:0,background:'rgba(2,4,16,0.95)',
      borderTop:'1px solid rgba(255,255,255,0.07)',
      backdropFilter:'blur(16px)',padding:'10px 16px 0',
    }}>
      {/* Phase cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginBottom:10}}>
        {phases.map(ph=>{
          const isCurrent=timeOfDay>=ph.t-6&&timeOfDay<ph.t
          const isPast=timeOfDay>=ph.t
          const phBorder = isCurrent ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)'
          const phOpacity = (isPast && !isCurrent) ? 0.55 : 1
          const phShadow = isCurrent ? ('0 0 20px ' + ua.fg + '44') : 'none'
          const phTimeLabel = ph.t === 24 ? '00:00' : (String(ph.t).padStart(2, '0') + ':00')
          return(
            <div key={ph.id} style={{
              borderRadius:10,overflow:'hidden',position:'relative',height:70,
              border:phBorder,
              opacity:phOpacity,
              boxShadow:phShadow,
              transition:'all 0.4s',
            }}>
              <div style={{position:'absolute',inset:0,background:ph.grad,opacity:0.85}}/>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.6),transparent)'}}/>
              <div style={{position:'absolute',top:6,left:8}}>
                <div style={{fontSize:9,fontWeight:800,color:'#fff',letterSpacing:'0.06em'}}>{ph.id}</div>
                <div style={{fontSize:8,color:'rgba(255,255,255,0.55)',marginTop:1}}>{phTimeLabel}</div>
              </div>
              <div style={{position:'absolute',bottom:5,left:8,right:8}}>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.60)',lineHeight:1.2}}>{ph.desc}</div>
              </div>
              {isCurrent&&<div style={{
                position:'absolute',top:5,right:7,width:6,height:6,borderRadius:'50%',
                background:'#fff',boxShadow:'0 0 8px #fff',animation:'blink 1.2s ease-in-out infinite',
              }}/>}
            </div>
          )
        })}
      </div>
      {/* Timeline slider */}
      <div style={{position:'relative',height:14,marginBottom:4}}>
        <div style={{position:'absolute',inset:'4px 0',borderRadius:4,background:'rgba(255,255,255,0.06)'}}/>
        <div style={{position:'absolute',top:4,left:0,height:6,width:`${sliderPct}%`,
          borderRadius:4,background:sliderGrad,transition:'width 1s linear'}}/>
        <div style={{
          position:'absolute',top:0,left:`calc(${sliderPct}% - 7px)`,
          width:14,height:14,borderRadius:'50%',
          background:ua.fg,boxShadow:`0 0 10px ${ua.fg}`,
          border:'2px solid #fff',transition:'left 1s linear',
        }}/>
        {/* Hour markers */}
        {[0,6,12,18,24].map(h=>(
          <div key={h} style={{
            position:'absolute',left:`${(h/24)*100}%`,top:-12,
            fontSize:7,color:'rgba(255,255,255,0.30)',transform:'translateX(-50%)',
          }}>{String(h).padStart(2,'0')}:00</div>
        ))}
      </div>
    </div>
  )
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({onBack,ua,simPaused,onToggleSim}:{
  onBack:()=>void;ua:ReturnType<typeof uiAccent>;simPaused?:boolean;onToggleSim?:()=>void
}){
  const [active,setActive]=useState('Hartă')
  const tabs=[
    {id:'Hartă',icon:'🌐'},{id:'Persoane',icon:'👥'},
    {id:'nav',icon:null},{id:'Activități',icon:'📅'},{id:'Setări',icon:'⚙️'},
  ]
  return(
    <div style={{
      height:50,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
      background:'rgba(2,4,16,0.98)',borderTop:'1px solid rgba(255,255,255,0.07)',
      backdropFilter:'blur(20px)',gap:4,padding:'0 20px',
    }}>
      {tabs.map(tab=>{
        if(tab.id==='nav')return(
          <div key="nav" style={{display:'flex',gap:6,alignItems:'center',margin:'0 8px'}}>
            <button onClick={onBack} style={{
              width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.08)',
              border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.6)',
              cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',
            }}>«</button>
            <div style={{
              width:42,height:42,borderRadius:'50%',
              background:ua.bg,border:`2px solid ${ua.fg}`,
              boxShadow:`0 0 20px ${ua.fg}66`,
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,
            }}>🏙️</div>
            <button onClick={onToggleSim} style={{
              width:32,height:32,borderRadius:'50%',
              background:simPaused?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.12)',
              border:`1px solid ${simPaused?'rgba(16,185,129,0.45)':'rgba(239,68,68,0.35)'}`,
              color:simPaused?'#10b981':'#ef4444',
              cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>{simPaused?'▶':'■'}</button>
          </div>
        )
        return(
          <button key={tab.id} onClick={()=>setActive(tab.id)} style={{
            display:'flex',flexDirection:'column',alignItems:'center',gap:2,
            padding:'4px 14px',borderRadius:10,cursor:'pointer',
            background:active===tab.id?ua.bg:'transparent',
            border:active===tab.id?`1px solid ${ua.border}`:'1px solid transparent',
            color:active===tab.id?ua.fg:'rgba(255,255,255,0.35)',
            transition:'all 0.15s',fontFamily:'Inter,sans-serif',
          }}>
            <span style={{fontSize:14}}>{tab.icon}</span>
            <span style={{fontSize:8,fontWeight:active===tab.id?700:400}}>{tab.id}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Map helpers ───────────────────────────────────────────────────────────────
function MapController({onBack}:{onBack:()=>void}){
  const map=useMap()
  useEffect(()=>{
    // Disable default zoom/attribution
    map.attributionControl?.setPrefix('')
    // Smooth zoom
    const c=map as any
    if(c._zoomAnimated)c._zoomAnimated=true
  },[map])
  return null
}

// ── Main Component ─────────────────────────────────────────────────────────────
export interface IasiCityViewProps {
  npcs:NPCWithState[];day:number;stage:DayStage;stageIndex:number
  startedAt:number;progress:number;timeOfDay:number
  activeInteractions:Set<string>;interactionPairs:Array<[string,string]>
  events:FeedEvent[];onBack:()=>void
  simPaused?:boolean;onToggleSim?:()=>void
}

export default function IasiCityView({
  npcs,day,stage,stageIndex,startedAt,progress,timeOfDay,
  activeInteractions,interactionPairs,events,
  onBack,simPaused,onToggleSim,
}:IasiCityViewProps){
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const mapAreaRef=useRef<HTMLDivElement>(null)
  const [mapDims,setMapDims]=useState({w:800,h:500})

  const sky=useMemo(()=>getSky(timeOfDay),[timeOfDay])
  const ua=useMemo(()=>uiAccent(timeOfDay),[timeOfDay])
  const spreadPos=useMemo(()=>spreadNPCs(npcs,stage),[npcs,stage])
  const weather=useMemo(()=>getWeather(timeOfDay),[timeOfDay])

  // ── Pre-fetch routes for all NPCs (OSRM with approx fallback) ────────────────
  const [npcRoutes,setNpcRoutes]=useState<Map<string,NPCRoutes>>(()=>new Map())

  useEffect(()=>{
    if(!npcs.length)return
    let cancelled=false

    const buildRoutes=async()=>{
      const entries=await Promise.all(npcs.map(async npc=>{
        const home=getCityStageCoords(npc,'WAKE_UP')
        const work=getCityStageCoords(npc,'WORK')
        const lunch=getCityStageCoords(npc,'LUNCH')

        // Fetch all 4 legs in parallel
        const[toWork,toLunch,fromLunch,toHome]=await Promise.all([
          fetchRoute(home,work),
          fetchRoute(work,lunch),
          fetchRoute(lunch,work),
          fetchRoute(work,home),
        ])
        return[npc.id,{toWork,toLunch,fromLunch,toHome}] as [string,NPCRoutes]
      }))

      if(!cancelled){
        setNpcRoutes(new Map(entries))
      }
    }

    // Start with approx routes immediately (no wait)
    const approxEntries:Array<[string,NPCRoutes]>=npcs.map(npc=>{
      const home=getCityStageCoords(npc,'WAKE_UP')
      const work=getCityStageCoords(npc,'WORK')
      const lunch=getCityStageCoords(npc,'LUNCH')
      const mid=(a:[number,number],b:[number,number]):[number,number]=>[
        (a[0]+b[0])/2,(a[1]+b[1])/2
      ]
      return[npc.id,{
        toWork:[home,mid(home,work),work],
        toLunch:[work,mid(work,lunch),lunch],
        fromLunch:[lunch,mid(lunch,work),work],
        toHome:[work,mid(work,home),home],
      }]
    })
    setNpcRoutes(new Map(approxEntries))

    // Then upgrade with real OSRM routes
    buildRoutes()
    return()=>{cancelled=true}
  },[npcs])

  useEffect(()=>{
    const el=mapAreaRef.current;if(!el)return
    const ro=new ResizeObserver(entries=>{
      const{width,height}=entries[0].contentRect
      setMapDims({w:Math.floor(width),h:Math.floor(height)})
    })
    ro.observe(el)
    const r=el.getBoundingClientRect()
    setMapDims({w:Math.floor(r.width),h:Math.floor(r.height)})
    return()=>ro.disconnect()
  },[])

  const timeStr=`${String(Math.floor(timeOfDay)).padStart(2,'0')}:${String(Math.floor((timeOfDay%1)*60)).padStart(2,'0')}`
  const isDaytime=timeOfDay>=6&&timeOfDay<19.5

  const handleSelectNpc=useCallback((npc:NPCWithState)=>{
    setSelectedId(prev=>prev===npc.id?null:npc.id)
  },[])
  const handleSelectById=useCallback((id:string)=>{
    setSelectedId(prev=>prev===id?null:id)
  },[])

  // Inject all CSS
  useEffect(()=>{
    const id='iasi-city-css'
    if(document.getElementById(id))return
    const s=document.createElement('style')
    s.id=id
    s.textContent=`
      @keyframes iasiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
      @keyframes iasiGlow{0%,100%{opacity:0.28;transform:scale(1)}50%{opacity:0.55;transform:scale(1.35)}}
      @keyframes iasiRing{0%{transform:scale(1);opacity:0.75}100%{transform:scale(2.4);opacity:0}}
      @keyframes iasiRingW{0%{transform:scale(1);opacity:0.9}100%{transform:scale(2.2);opacity:0}}
      @keyframes lpPulse{0%,100%{box-shadow:0 0 8px rgba(16,185,129,0.4)}50%{box-shadow:0 0 18px rgba(16,185,129,0.7)}}
      @keyframes cloudDrift{from{transform:translateX(-10%)}to{transform:translateX(110%)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
      @keyframes iasiEnter{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:scale(1)}}
      @keyframes lineFlow{to{stroke-dashoffset:-20}}
      .iasi-icon{background:none!important;border:none!important;}
      .iasi-pin{display:flex;flex-direction:column;align-items:center;cursor:pointer;animation:iasiFloat 3s ease-in-out infinite;}
      .iasi-glow{position:absolute;width:52px;height:52px;border-radius:50%;filter:blur(10px);animation:iasiGlow 2.5s ease-in-out infinite;}
      .iasi-av{border-radius:50%;overflow:hidden;border:2.5px solid;position:relative;z-index:1;flex-shrink:0;}
      .iasi-needle{width:2.5px;height:18px;border-radius:0 0 2px 2px;margin-top:-1px;}
      .iasi-lbl{background:rgba(4,6,24,0.90);border:1px solid;border-radius:7px;padding:2px 8px;display:flex;align-items:center;gap:4px;white-space:nowrap;backdrop-filter:blur(10px);}
      .iasi-interaction-line{animation:lineFlow 1.5s linear infinite;}
      .leaflet-container{background:#030612!important;}
      .leaflet-tile-pane{filter:brightness(0.88) saturate(1.1);}
    `
    document.head.appendChild(s)
    return()=>{}
  },[])

  return(
    <div style={{
      display:'flex',flexDirection:'column',flex:1,overflow:'hidden',
      animation:'iasiEnter 0.8s ease-out',
      background:'#030612',fontFamily:'Inter,system-ui,sans-serif',
    }}>
      {/* ── Main Row (no internal header — TopNav in page.tsx covers it) ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        <NPCPanel
          npcs={npcs}
          selectedId={selectedId}
          activeInteractions={activeInteractions}
          interactionPairs={interactionPairs}
          onSelect={handleSelectNpc}
        />

        {/* Center — panoramic city background */}
        <div ref={mapAreaRef} style={{flex:1,position:'relative',overflow:'hidden'}}>
          <CityBackground
            npcs={npcs}
            stageIndex={stageIndex}
            startedAt={startedAt}
            activeInteractions={activeInteractions}
            spreadPos={spreadPos}
            routes={npcRoutes}
            selectedId={selectedId}
            onSelect={handleSelectNpc}
            timeOfDay={timeOfDay}
            progress={progress}
            dims={mapDims}
            ua={ua}
          />
        </div>

        {selectedId ? (
          <DetailPanel
            npc={npcs.find(n=>n.id===selectedId)??null}
            day={day}
            stage={stage}
            onClose={()=>setSelectedId(null)}
            allNpcs={npcs}
          />
        ) : (
          <InfoPanel
            npcs={npcs}
            events={events}
            activeInteractions={activeInteractions}
            day={day}
            stage={stage}
            stageIndex={stageIndex}
            startedAt={startedAt}
            timeOfDay={timeOfDay}
            onSelectNpc={handleSelectById}
          />
        )}
      </div>

      {/* ── Bottom Timeline ── */}
      <BottomTimeline timeOfDay={timeOfDay} day={day} progress={progress} ua={ua}/>

      {/* ── Bottom Nav ── */}
      <BottomNav onBack={onBack} ua={ua} simPaused={simPaused} onToggleSim={onToggleSim}/>
    </div>
  )
}
