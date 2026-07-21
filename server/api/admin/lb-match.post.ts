import { requireAdmin } from '../../utils/db'
import { resolveLetterboxdTmdb } from '../../utils/letterboxd'

// Resolve exact TMDB ids from the stored Letterboxd film URLs, in batches.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const after = Number(body?.after ?? 0) || 0
  return await resolveLetterboxdTmdb(30, after)
})
