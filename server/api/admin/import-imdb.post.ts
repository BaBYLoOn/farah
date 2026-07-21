import { db, requireAdmin } from '../../utils/db'
import { parseCsv } from '../../utils/csv'

// Imports the official IMDb ratings export (imdb.com → Your Ratings → Export).
// Columns: Const, Your Rating, Date Rated, Title, Original Title, URL,
// Title Type, IMDb Rating, Runtime (mins), Year, Genres, Num Votes,
// Release Date, Directors.

function fmtRuntime(min: number): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

const FILM_TYPES = new Set(['movie', 'tvmovie', 'video', 'short', 'tvshort'])
const SERIES_TYPES = new Set(['tvseries', 'tvminiseries'])

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No file' })

  const rows = parseCsv(file.data.toString('utf-8'))
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? []
  const col = (n: string) => header.indexOf(n)
  const iConst = col('const')
  const iMine = col('your rating')
  const iDate = col('date rated')
  const iTitle = col('title')
  const iType = col('title type')
  const iImdb = col('imdb rating')
  const iRt = col('runtime (mins)')
  const iYear = col('year')
  const iDir = col('directors')
  if (iConst === -1 || iMine === -1 || iTitle === -1) {
    throw createError({ statusCode: 400, statusMessage: 'Not an IMDb ratings export (need Const / Your Rating / Title columns)' })
  }

  const d = db()
  let imported = 0
  let updated = 0
  let skipped = 0

  for (const r of rows.slice(1)) {
    const tt = r[iConst]?.trim()
    const title = r[iTitle]?.trim()
    const mine = Number(r[iMine] ?? 0) || null
    if (!tt || !title) { skipped++; continue }

    const rawType = (r[iType] ?? '').trim().toLowerCase().replace(/\s+/g, '')
    let type: 'film' | 'series'
    if (SERIES_TYPES.has(rawType)) type = 'series'
    else if (FILM_TYPES.has(rawType) || rawType === '') type = 'film'
    else { skipped++; continue } // episodes, games, etc.

    const year = Number(r[iYear] ?? 0) || null
    const imdbRating = Number(r[iImdb] ?? 0) || null
    const runtime = fmtRuntime(Number(r[iRt] ?? 0) || 0)
    const director = (r[iDir] ?? '').split(',')[0].trim() // main director only
    const rated = (r[iDate] ?? '').trim() || null

    const existing = await d.execute({
      sql: 'SELECT id FROM titles WHERE lower(title) = lower(?) AND (year = ? OR ? IS NULL) LIMIT 1',
      args: [title, year, year],
    })

    if (existing.rows.length) {
      // his explicit IMDb rating always wins; other fields only fill blanks —
      // the Const column is the tt id, which powers the poster→IMDb links
      await d.execute({
        sql: `UPDATE titles SET
                my_rating = COALESCE(?, my_rating),
                imdb = COALESCE(imdb, ?),
                imdb_id = COALESCE(imdb_id, ?),
                runtime = CASE WHEN runtime = '' THEN ? ELSE runtime END,
                by = CASE WHEN by = '' THEN ? ELSE by END
              WHERE id = ?`,
        args: [mine, imdbRating, tt, runtime, director, existing.rows[0].id],
      })
      updated++
    } else {
      const guid = `imdb-${tt}`
      const seen = await d.execute({ sql: 'SELECT 1 FROM sync_log WHERE guid = ?', args: [guid] })
      if (seen.rows.length) { skipped++; continue }
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      await d.execute({
        sql: `INSERT INTO titles (slug, title, year, type, by, runtime, my_rating, imdb, imdb_id, watched, watches, poster)
              VALUES (?,?,?,?,?,?,?,?,?,?,1,NULL)`,
        args: [slug, title, year, type, director, runtime, mine, imdbRating, tt,
               rated ?? new Date().toISOString().slice(0, 10)],
      })
      await d.execute({ sql: 'INSERT INTO sync_log (guid) VALUES (?)', args: [guid] })
      imported++
    }
  }

  return { imported, updated, skipped }
})
