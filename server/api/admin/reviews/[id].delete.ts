import { db, requireAdmin } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad id' })
  await db().execute({ sql: 'DELETE FROM reviews WHERE id = ?', args: [id] })
  return { ok: true }
})
