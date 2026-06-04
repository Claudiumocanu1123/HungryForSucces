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

## Cum funcționează

**Simularea**
Server-ul rulează un timer care verifică la fiecare secundă dacă a trecut timpul pentru stagiul curent. Ziua are 8 stagii, fiecare 20 de secunde. Când se schimbă stagiul, fiecare NPC primește stats noi (energie, dispoziție, foame) bazate pe cine e el — un programator cu salariu mare reacționează diferit față de un artist cu bani puțini. Stările se țin în memorie pe parcursul zilei și se salvează în SQLite la final.

**Poveștile**
Când apeși pe un NPC, se face un request la OpenRouter cu contextul lui — ce a făcut azi, cum se simte, ce a făcut ieri. Răspunsul se salvează în baza de date. Dacă mai apasă cineva pe același personaj în același stagiu, primește din cache, nu se mai face un alt apel. Dacă doi oameni apasă simultan, tot un singur apel se face.

**Mișcarea pe hartă**
Fiecare NPC are o casă și un loc de muncă în cartiere reale din Iași, asignate fix pe baza ID-ului. Pozițiile se actualizează la 60fps direct pe DOM cu `transform`, fără să treacă prin React. Când e în navetă, urmează un traseu real calculat cu OSRM. Când stă pe loc, se împrăștie puțin față de ceilalți ca să nu stea toți grămadă.
