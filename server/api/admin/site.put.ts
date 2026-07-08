import { requireAdmin } from '~/server/utils/auth'
import { saveSite } from '~/server/utils/site'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  return await saveSite(body)
})
