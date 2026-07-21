import { db, requireAdmin } from '../../utils/db'

// Flip a title's favourite flag without touching its watch log. Turning a
// favourite ON appends it to the end of its type's order.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id, on } = await readBody(event)
  const tid = Number(id)
  const d = db()

  if (on) {
    const t = await d.execute({ sql: 'SELECT type FROM titles WHERE id = ?', args: [tid] })
    const type = String((t.rows[0] as any)?.type ?? 'film')
    const max = await d.execute({
      sql: 'SELECT COALESCE(MAX(fav_sort), 0) AS m FROM titles WHERE favorite = 1 AND type = ?',
      args: [type],
    })
    const next = Number((max.rows[0] as any).m) + 1
    await d.execute({ sql: 'UPDATE titles SET favorite = 1, fav_sort = ? WHERE id = ?', args: [next, tid] })
  } else {
    await d.execute({ sql: 'UPDATE titles SET favorite = 0 WHERE id = ?', args: [tid] })
  }
  return { ok: true }
})
