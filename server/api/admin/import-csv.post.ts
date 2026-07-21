import { db, requireAdmin, syncWatchCache } from '../../utils/db'
import { parseCsv } from '../../utils/csv'
import { runPipelineInBackground } from '../../utils/pipeline'

// Imports a full Letterboxd history from the official data export
// (letterboxd.com → Settings → Data → Export: diary.csv or watched.csv).
// Columns used: Date, Name, Year, Letterboxd URI, Rating, Rewatch, Watched Date.
// Every row becomes ONE watch record (rewatches included); ratings are
// Letterboxd stars ×2 → the 10-point system.

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No file' })

  const rows = parseCsv(file.data.toString('utf-8'))
  if (!rows.length) throw createError({ statusCode: 400, statusMessage: 'Empty CSV' })

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const iName = col('name')
  const iYear = col('year')
  const iUri = col('letterboxd uri')
  const iRating = col('rating')
  const iWatched = col('watched date') !== -1 ? col('watched date') : col('date')
  if (iName === -1 || iWatched === -1) {
    throw createError({ statusCode: 400, statusMessage: 'Not a Letterboxd export (need Name + Watched Date columns)' })
  }

  const d = db()
  let imported = 0
  let records = 0
  let skipped = 0
  // the CSV is the FULL film diary — collect what should exist so we can
  // reconcile (remove films/watches the user deleted on Letterboxd)
  const keepWatch = new Set<string>() // `${titleId}|${watched}`
  const keepTitle = new Set<number>()

  for (const r of rows.slice(1)) {
    const title = r[iName]?.trim()
    const watched = r[iWatched]?.trim()
    if (!title || !watched) { skipped++; continue }

    const year = Number(r[iYear] ?? 0) || null
    const rating = iRating !== -1 && r[iRating] ? Number(r[iRating]) * 2 : null
    // the Letterboxd film URL — the key to an EXACT TMDB match later
    const lbUri = iUri !== -1 ? (r[iUri] ?? '').trim() : ''

    const existing = await d.execute({
      sql: `SELECT id, edited FROM titles WHERE lower(title) = lower(?) AND (year = ? OR ? IS NULL) LIMIT 1`,
      args: [title, year, year],
    })

    let titleId: number
    if (existing.rows.length) {
      const row: any = existing.rows[0]
      titleId = Number(row.id)
      await d.execute({ sql: "UPDATE titles SET lb_uri = CASE WHEN lb_uri = '' OR lb_uri IS NULL THEN ? ELSE lb_uri END WHERE id = ?", args: [lbUri, titleId] })
      if (Number(row.edited) !== 1 && rating != null) {
        await d.execute({ sql: 'UPDATE titles SET my_rating = ? WHERE id = ?', args: [rating, titleId] })
      }
    } else {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const ins = await d.execute({
        sql: `INSERT INTO titles (slug, title, year, type, by, runtime, my_rating, imdb, watched, watches, poster, lb_uri)
              VALUES (?,?,?,'film','','',?,NULL,?,1,NULL,?)`,
        args: [slug, title, year, rating, watched, lbUri],
      })
      titleId = Number(ins.lastInsertRowid)
      imported++
    }

    keepTitle.add(titleId)
    keepWatch.add(`${titleId}|${watched}`)

    // one record per (title, date) — no duplicates on re-upload
    const dup = await d.execute({
      sql: 'SELECT 1 FROM watches WHERE title_id = ? AND watched = ? AND season IS NULL',
      args: [titleId, watched],
    })
    if (!dup.rows.length) {
      await d.execute({ sql: 'INSERT INTO watches (title_id, watched) VALUES (?, ?)', args: [titleId, watched] })
      records++
    }
    await syncWatchCache(titleId)
  }

  // reconcile: drop film watch records + films no longer in the export.
  // guarded so a tiny/wrong file can't wipe the library.
  let removed = 0
  if (keepWatch.size >= 5) {
    const filmWatches = await d.execute("SELECT w.id, w.title_id, w.watched FROM watches w JOIN titles t ON t.id=w.title_id WHERE t.type='film' AND w.season IS NULL")
    for (const w of filmWatches.rows as any[]) {
      if (!keepWatch.has(`${Number(w.title_id)}|${String(w.watched)}`)) {
        await d.execute({ sql: 'DELETE FROM watches WHERE id = ?', args: [Number(w.id)] })
        removed++
      }
    }
    // films with no watches left and not hand-edited → gone
    const emptyFilms = await d.execute("SELECT id FROM titles WHERE type='film' AND edited=0 AND id NOT IN (SELECT DISTINCT title_id FROM watches)")
    for (const t of emptyFilms.rows as any[]) {
      await d.execute({ sql: 'DELETE FROM titles WHERE id = ?', args: [Number(t.id)] })
    }
    for (const id of keepTitle) await syncWatchCache(id)
  }

  // exact-match the new films to TMDB (via their Letterboxd URLs) then fetch
  // all the missing details + IMDb ratings — automatically, in the background
  runPipelineInBackground({ match: true })

  return { imported, records, removed, skipped, processing: true }
})

