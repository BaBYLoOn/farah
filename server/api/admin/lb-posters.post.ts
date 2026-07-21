import { requireAdmin } from '../../utils/db'
import { letterboxdPosters } from '../../utils/letterboxd'

// Fill posters from Letterboxd for titles TMDB has no artwork for.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { after = 0, limit = 25 } = await readBody<{ after?: number; limit?: number }>(event).catch(() => ({} as any))
  return await letterboxdPosters(Number(limit) || 25, Number(after) || 0)
})
