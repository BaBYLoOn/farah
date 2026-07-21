import { requireAdmin } from '../../utils/db'
import { syncTrakt } from '../../utils/trakt'
import { runPipelineInBackground } from '../../utils/pipeline'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const r = await syncTrakt()
  // Trakt carries tmdb + imdb ids, so just fetch details + IMDb ratings
  runPipelineInBackground({ match: false })
  return { ...r, processing: true }
})
