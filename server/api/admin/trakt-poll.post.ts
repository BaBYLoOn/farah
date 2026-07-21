import { requireAdmin } from '../../utils/db'
import { devicePoll } from '../../utils/trakt'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await devicePoll()
})
