import { requireAdmin } from '../../utils/db'
import { resolveLetterboxdTmdb } from '../../utils/letterboxd'

// Resolve exact TMDB ids from the stored Letterboxd film URLs, in batches.
// `recheck: true` also re-verifies titles that already carry an id, which is how
// a wrong fuzzy match (right name, wrong film) gets found and corrected.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const after = Number(body?.after ?? 0) || 0
  const limit = Number(body?.limit ?? 30) || 30
  return await resolveLetterboxdTmdb(limit, after, { recheck: Boolean(body?.recheck) })
})
