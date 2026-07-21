import { requireAdmin } from '../../utils/db'
import { enrichTitles } from '../../utils/enrich'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await enrichTitles(120)
})
