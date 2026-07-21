import { requireAdmin } from '../../utils/db'
import { importReviewsCsv } from '../../utils/reviews'

// Full-history reviews backfill from the Letterboxd `reviews.csv` export. Match
// each review to a film that must already be in the diary (upload diary.csv
// first) and attach it as a dated review. RSS keeps recent reviews fresh.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No file' })
  const res = await importReviewsCsv(file.data.toString('utf-8'))
  return res
})
