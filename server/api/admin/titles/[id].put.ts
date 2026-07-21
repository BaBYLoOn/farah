import { db, requireAdmin, syncWatchCache } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const t = await readBody(event)
  const d = db()

  await d.execute({
    sql: `UPDATE titles SET title=?, year=?, type=?, by=?, runtime=?, my_rating=?, imdb=?, imdb_id=?, poster=?, note=?, note_private=?, favorite=?, edited=1
          WHERE id=?`,
    args: [t.title, t.year ?? null, t.type === 'series' ? 'series' : 'film', t.by ?? '', t.runtime ?? '',
           t.myRating ?? null, t.imdb ?? null, t.imdbId ?? null, t.poster ?? null,
           t.note ?? '', t.notePrivate ?? '', t.favorite ? 1 : 0, id],
  })

  // when the editor sends a log, it is the whole truth for this title
  if (Array.isArray(t.log)) {
    await d.execute({ sql: 'DELETE FROM watches WHERE title_id = ?', args: [id] })
    for (const w of t.log) {
      if (!w?.watched) continue
      await d.execute({
        sql: 'INSERT INTO watches (title_id, watched, season, episode, note, note_private) VALUES (?,?,?,?,?,?)',
        args: [id, String(w.watched).slice(0, 10), w.season ?? null, w.episode ?? null, w.note ?? '', w.notePrivate ?? ''],
      })
    }
    await syncWatchCache(id)
  }

  return { ok: true }
})
