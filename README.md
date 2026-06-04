# LifeSim

10 NPC-uri care trăiesc o săptămână în Iași. Click pe un personaj pentru a vedea ce face, generat în timp real cu un LLM.

## Run

```bash
npm install
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 14, TypeScript
- SQLite (sql.js) — caching povești + state NPC
- OpenRouter API (Claude Haiku) — generare povești
- Three.js / react-globe.gl — glob 3D
- Framer Motion — animații UI
