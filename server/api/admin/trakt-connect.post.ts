import { requireAdmin } from '../../utils/db'
import { deviceCode } from '../../utils/trakt'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await deviceCode()
})
