import { requireAdmin } from '../../utils/db'
import { refreshTmdb } from '../../utils/enrich'

// Force-refresh posters + IMDb ratings for already-linked titles. Walked in
// batches from the admin (cursor + done), so long catalogues don't time out.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const after = Number(body?.after ?? 0) || 0
  const includeEdited = body?.includeEdited === true
  return await refreshTmdb(80, after, includeEdited)
})
