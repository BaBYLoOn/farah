import { db } from './db'
import { parseCsv } from './csv'

// Letterboxd `ratings.csv` (Date, Name, Year, Letterboxd URI, Rating) lists every
// rated film — including some she rated but never logged in the diary. For any
// rated film NOT already among our titles, add it to the WATCHED list with its
// rating, but do NOT create a diary/watch record for it (she didn't log a date).
// Films already present are left untouched.
export async function importRatingsCsv(text: string) {
  const rows = parseCsv(text)
  if (!rows.length) throw createError({ statusCode: 400, statusMessage: 'Empty CSV' })
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (n: string) => header.indexOf(n)
  const iName = col('name'), iYear = col('year'), iUri = col('letterboxd uri'), iRating = col('rating')
  if (iName === -1 || iRating === -1) {
    throw createError({ statusCode: 400, statusMessage: 'Not a Letterboxd ratings.csv (need Name + Rating columns)' })
  }

  const d = db()
  let added = 0, skipped = 0, present = 0
  for (const r of rows.slice(1)) {
    const title = (r[iName] ?? '').trim()
    if (!title) { skipped++; continue }
    const year = iYear !== -1 ? Number(r[iYear]) || null : null
    const uri = iUri !== -1 ? (r[iUri] ?? '').trim().replace(/\/$/, '') + '/' : ''
    const stars = Number(r[iRating])
    const rating = Number.isNaN(stars) ? null : stars * 2 // Letterboxd stars → /10

    // already have this film (from the diary or a previous import)? leave it be
    const existing = await d.execute({
      sql: `SELECT id FROM titles
            WHERE (? != '' AND lb_uri = ?)
               OR (lower(title) = lower(?) AND (year = ? OR ? IS NULL))
            LIMIT 1`,
      args: [uri, uri, title, year, year],
    })
    if (existing.rows.length) { present++; continue }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    // watched = NULL and watches = 0 → shows in Watched with its rating, but has
    // no diary record and no rewatch tally
    await d.execute({
      sql: `INSERT INTO titles (slug, title, year, type, by, runtime, my_rating, imdb, watched, watches, lb_uri)
            VALUES (?,?,?,'film','','',?,NULL,NULL,0,?)`,
      args: [slug, title, year, rating, uri || ''],
    })
    added++
  }
  return { added, present, skipped }
}
