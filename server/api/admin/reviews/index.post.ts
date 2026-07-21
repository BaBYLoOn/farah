import { db, requireAdmin } from '../../../utils/db'

// Add a dated note to a title. Public (private=0) shows on the site as a review;
// private (private=1) is admin-only. Each note carries its own date.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ titleId?: number; reviewed?: string; text?: string; private?: boolean }>(event)
  if (!body.titleId || !body.text?.trim()) throw createError({ statusCode: 400, statusMessage: 'Need a title and text' })
  const priv = body.private ? 1 : 0
  const guid = `manual-${priv ? 'priv' : 'pub'}-${body.titleId}-${Date.now()}`
  await db().execute({
    sql: 'INSERT INTO reviews (title_id, reviewed, text, rating, private, guid) VALUES (?,?,?,?,?,?)',
    args: [body.titleId, body.reviewed || null, body.text.trim(), null, priv, guid],
  })
  return { ok: true }
})
