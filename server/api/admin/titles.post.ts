import { db, requireAdmin, syncWatchCache } from '../../utils/db'
import { downloadPoster } from '../../utils/enrich'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const t = await readBody(event)
  const slug = String(t.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const watched = t.watched ?? new Date().toISOString().slice(0, 10)
  const r = await db().execute({
    sql: `INSERT INTO titles (tmdb_id, imdb_id, slug, title, year, type, by, runtime, my_rating, imdb, watched, watches, poster, note, note_private, edited)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,1)`,
    args: [t.tmdbId ?? null, t.imdbId ?? null, slug, t.title ?? 'Untitled', t.year ?? null,
           t.type === 'series' ? 'series' : 'film', t.by ?? '', t.runtime ?? '',
           t.myRating ?? null, t.imdb ?? null, watched,
           t.poster ?? null, t.note ?? '', t.notePrivate ?? ''],
  })
  const id = Number(r.lastInsertRowid)

  // grab a local fallback for the remote poster so it survives a TMDB outage
  if (typeof t.poster === 'string' && t.poster.startsWith('http')) {
    const local = await downloadPoster(t.poster, id)
    if (local) await db().execute({ sql: 'UPDATE titles SET poster_local = ? WHERE id = ?', args: [local, id] })
  }

  // the first watch goes straight into the log
  if (watched) {
    await db().execute({ sql: 'INSERT INTO watches (title_id, watched) VALUES (?, ?)', args: [id, watched] })
    await syncWatchCache(id)
  }
  return { ok: true, id }
})
