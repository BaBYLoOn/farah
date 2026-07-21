import { db, requireAdmin } from '../../utils/db'

// Persist a hand-dragged favourites order: fav_sort = position in the list.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { ids } = await readBody(event)
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids array required' })
  const d = db()
  for (let i = 0; i < ids.length; i++) {
    await d.execute({ sql: 'UPDATE titles SET fav_sort = ? WHERE id = ?', args: [i + 1, Number(ids[i])] })
  }
  return { ok: true }
})
