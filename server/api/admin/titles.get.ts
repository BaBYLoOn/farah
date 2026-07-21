import { db, requireAdmin, rowToTitle, rowToWatch, rowToReview } from '../../utils/db'

// full title list for the admin — private notes, the watch log, and the dated
// reviews attached to each title
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const res = await db().execute('SELECT * FROM titles ORDER BY watched DESC, id DESC')
  const titles = res.rows.map((r: any) => ({
    ...rowToTitle(r),
    notePrivate: String(r.note_private ?? ''),
    log: [] as any[],
    reviews: [] as any[],
  }))

  const byId = new Map(titles.map((t) => [t.id, t]))
  const watches = await db().execute('SELECT * FROM watches ORDER BY watched DESC, id DESC')
  for (const r of watches.rows as any[]) {
    byId.get(Number(r.title_id))?.log.push({ ...rowToWatch(r), notePrivate: String(r.note_private ?? '') })
  }
  const reviews = await db().execute('SELECT * FROM reviews ORDER BY reviewed DESC, id DESC')
  for (const r of reviews.rows as any[]) {
    byId.get(Number(r.title_id))?.reviews.push(rowToReview(r))
  }

  return titles
})
