import { db } from '../../utils/db'

// Lazy-loaded when the Diary tab opens: flat watch records (newest first),
// joined to the already-loaded titles on the client. Small (ids only).
export default defineEventHandler(async () => {
  const res = await db().execute(
    'SELECT title_id, watched, season, episode, note FROM watches ORDER BY watched DESC, id DESC',
  )
  const records = res.rows.map((r: any) => ({
    titleId: Number(r.title_id),
    watched: String(r.watched),
    season: r.season == null ? null : Number(r.season),
    episode: r.episode == null ? null : Number(r.episode),
    note: String(r.note ?? ''),
  }))
  return { records }
})
