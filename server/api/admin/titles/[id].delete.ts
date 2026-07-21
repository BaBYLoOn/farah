import { db, requireAdmin } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  await db().execute({ sql: 'DELETE FROM watches WHERE title_id = ?', args: [id] })
  await db().execute({ sql: 'DELETE FROM titles WHERE id = ?', args: [id] })
  return { ok: true }
})
