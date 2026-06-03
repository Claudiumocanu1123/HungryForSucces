import { getDb, persistDb } from './db'
import { NPC } from '@/types'

// All NPCs live in Iași — a living city where everyone can meet in person
const IASI_LAT = 47.1585
const IASI_LNG = 27.6014

const SEED_NPCS: NPC[] = [
  {
    id: 'elena', name: 'Elena Popescu', age: 45, profession: 'Bibliotecară',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['introvertită', 'sensibilă', 'iubitoare de cărți'],
    friends: ['mihai'], base_energy: 75, base_social: 20, budget_ron: 2800,
    system_prompt: 'Ești un narator care descrie o bibliotecară introvertită de 45 ani din Iași. Ton calm, poetic, melancolic. Referințe la liniște, cărți, rutină, timp care trece lent. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'mihai', name: 'Mihai Ionescu', age: 32, profession: 'Bucătar',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['pasionat', 'creativ', 'temperamental'],
    friends: ['elena', 'dan'], base_energy: 85, base_social: 70, budget_ron: 3500,
    system_prompt: 'Ești un narator care descrie un bucătar pasionat și temperamental de 32 ani din Iași. Ton viu, energic, senzorial — mirosuri, gusturi, căldură. Uneori frustrat, mereu intens. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'ana', name: 'Ana Cristea', age: 38, profession: 'Doctor',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['dedicată', 'stresată', 'empatică'],
    friends: ['cristina', 'iulia'], base_energy: 70, base_social: 50, budget_ron: 7000,
    system_prompt: 'Ești un narator care descrie o doctoriță dedicată și stresată de 38 ani din Iași. Ton alert, precis, ușor epuizat. Referințe la responsabilitate, pacienți, oboseală acumulată. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'bogdan', name: 'Bogdan Dumitru', age: 28, profession: 'Programator',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['night owl', 'gamer', 'procrastinator'],
    friends: ['dan', 'andrei'], base_energy: 60, base_social: 30, budget_ron: 6500,
    system_prompt: 'Ești un narator care descrie un programator night owl și gamer de 28 ani din Iași. Ton sarcastic, relaxat, referințe la tech, monitoare, noapte târziu, procrastinare. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'maria', name: 'Maria Stănescu', age: 52, profession: 'Profesoară',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['maternă', 'tradițională', 'răbdătoare'],
    friends: ['radu', 'elena'], base_energy: 70, base_social: 65, budget_ron: 2200,
    system_prompt: 'Ești un narator care descrie o profesoară maternă și tradițională de 52 ani din Iași. Ton cald, grijuliu, ușor nostalgic. Referințe la familie, ordine, valori, răbdare. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'andrei', name: 'Andrei Moldovan', age: 24, profession: 'Artist',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['haotic', 'visător', 'impulsiv'],
    friends: ['iulia', 'bogdan'], base_energy: 65, base_social: 60, budget_ron: 1200,
    system_prompt: 'Ești un narator care descrie un artist sărac și visător de 24 ani din Iași. Ton haotic, poetic, impulsiv. Referințe la lipsuri financiare, creativitate, vise mari, realitate dură. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'cristina', name: 'Cristina Bălan', age: 41, profession: 'Antreprenoare',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['ambițioasă', 'eficientă', 'controlată'],
    friends: ['ana', 'mihai'], base_energy: 90, base_social: 55, budget_ron: 15000,
    system_prompt: 'Ești un narator care descrie o antreprenoare ambițioasă și controlată de 41 ani din Iași. Ton eficient, rece, calculat. Referințe la timp, productivitate, decizii, putere. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'radu', name: 'Radu Georgescu', age: 68, profession: 'Pensionar',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['nostalgic', 'înțelept', 'singur'],
    friends: ['maria', 'dan'], base_energy: 55, base_social: 40, budget_ron: 1800,
    system_prompt: 'Ești un narator care descrie un pensionar nostalgic și înțelept de 68 ani din Iași. Ton lent, contemplativ, singur. Referințe la trecut, amintiri, liniștea bătrâneții, izolare. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'iulia', name: 'Iulia Popa', age: 21, profession: 'Studentă',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['sociabilă', 'anxioasă', 'energică'],
    friends: ['andrei', 'ana'], base_energy: 80, base_social: 85, budget_ron: 900,
    system_prompt: 'Ești un narator care descrie o studentă sociabilă și anxioasă de 21 ani din Iași. Ton energic dar nervos, referințe la examene, bani puțini, prieteni, viitor incert. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
  {
    id: 'dan', name: 'Dan Barbu', age: 35, profession: 'Mecanic',
    city: 'Iași', lat: IASI_LAT, lng: IASI_LNG,
    traits: ['practic', 'loial', 'family-oriented'],
    friends: ['mihai', 'bogdan', 'radu'], base_energy: 80, base_social: 60, budget_ron: 3200,
    system_prompt: 'Ești un narator care descrie un mecanic practic și loial de 35 ani din Iași. Ton simplu, direct, căldură de om de rând. Referințe la muncă fizică, familie, lucruri concrete. 3-4 propoziții scurte, prezent, persoana a 3-a, română.',
  },
]

export async function seedNPCs() {
  const database = await getDb()

  // Always migrate any NPC not already in Iași (handles old data)
  database.run(
    `UPDATE npcs SET city = 'Iași', lat = ${IASI_LAT}, lng = ${IASI_LNG} WHERE city != 'Iași' OR city IS NULL`
  )

  const existing = database.exec('SELECT COUNT(*) as cnt FROM npcs')
  const count = existing[0]?.values[0]?.[0] as number
  if (count > 0) return

  const stmt = database.prepare(`
    INSERT OR IGNORE INTO npcs
      (id, name, profession, age, city, lat, lng, traits, friends, base_energy, base_social, budget_ron, system_prompt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const npc of SEED_NPCS) {
    stmt.run([
      npc.id, npc.name, npc.profession, npc.age, npc.city,
      npc.lat, npc.lng,
      JSON.stringify(npc.traits),
      JSON.stringify(npc.friends),
      npc.base_energy, npc.base_social, npc.budget_ron,
      npc.system_prompt,
    ])
  }
  stmt.free()
  persistDb()
}

export function getAllNPCs(database: import('sql.js').Database): NPC[] {
  const result = database.exec('SELECT * FROM npcs')
  if (!result[0]) return []
  const cols = result[0].columns
  return result[0].values.map((row) => {
    const obj: Record<string, unknown> = {}
    cols.forEach((col, i) => { obj[col] = row[i] })
    return {
      ...obj,
      traits: JSON.parse(obj.traits as string || '[]'),
      friends: JSON.parse(obj.friends as string || '[]'),
    } as NPC
  })
}
