import { db, getSetting, rowToTitle, rowToReview } from '../../utils/db'

// The cinema page payload: settings + every title (with its dated reviews) +
// cheap diary counts. Deliberately NOT the full watch log — the Diary tab
// lazy-loads /api/cinema/diary. Never ships private notes.
export default defineEventHandler(async () => {
  const cinema = (await getSetting<{ musicUrl: string | null }>('cinema')) ?? { musicUrl: null }
  const autosync = (await getSetting<{ paused: boolean }>('autosync')) ?? { paused: false }

  const titlesRes = await db().execute('SELECT * FROM titles ORDER BY watched DESC, id DESC')
  const films = titlesRes.rows.map((r: any) => ({ ...rowToTitle(r), reviews: [] as any[] }))
  const byId = new Map(films.map((t) => [t.id, t]))

  // attach public reviews (newest first) to each title
  const reviews = await db().execute('SELECT id, title_id, reviewed, text, rating FROM reviews ORDER BY reviewed DESC, id DESC')
  for (const r of reviews.rows as any[]) {
    byId.get(Number(r.title_id))?.reviews.push(rowToReview(r))
  }

  // diary tab counts (watch records by title type) — cheap, instant badge/filters
  const dc = await db().execute(`
    SELECT t.type AS type, COUNT(*) AS n
    FROM watches w JOIN titles t ON t.id = w.title_id
    GROUP BY t.type`)
  let film = 0, series = 0
  for (const r of dc.rows as any[]) {
    if (String(r.type) === 'series') series = Number(r.n); else film += Number(r.n)
  }

  return { cinema, autosync, films, diaryCounts: { all: film + series, film, series } }
})
