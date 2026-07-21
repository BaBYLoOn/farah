import { requireAdmin } from '../../utils/db'
import { syncLetterboxd } from '../../utils/letterboxd'
import { runPipelineInBackground } from '../../utils/pipeline'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const sync = await syncLetterboxd()
  // finish the data automatically (match/enrich/ratings) in the background —
  // RSS already carries the TMDB id, so no Letterboxd matching needed here
  runPipelineInBackground({ match: false })
  return { ...sync, processing: true }
})
