import { requireAdmin } from '../../utils/db'
import { runPipelineInBackground, pipelineBusy } from '../../utils/pipeline'

// Manual trigger for the same finishing pipeline that runs after every sync:
// exact-match → fetch TMDB details → IMDb ratings. Runs in the background so
// the request returns immediately.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (pipelineBusy()) return { processing: true, alreadyRunning: true }
  runPipelineInBackground({ match: true })
  return { processing: true }
})
