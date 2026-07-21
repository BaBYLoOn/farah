import { requireAdmin } from '../../utils/db'
import { importRatingsCsv } from '../../utils/ratings'
import { runPipelineInBackground } from '../../utils/pipeline'

// Upload Letterboxd ratings.csv — adds rated films that aren't already in the
// diary to the Watched list (with the rating, no diary record). Then the pipeline
// fills TMDB details + IMDb id/rating for the new titles.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'No file' })
  const res = await importRatingsCsv(file.data.toString('utf-8'))
  runPipelineInBackground({ match: true }) // resolve lb_uri → exact TMDB, enrich, IMDb ratings
  return res
})
