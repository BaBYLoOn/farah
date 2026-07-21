import { ensureDb, getSetting } from '../utils/db'
import { syncLetterboxd } from '../utils/letterboxd'
import { syncTrakt } from '../utils/trakt'
import { runPipeline } from '../utils/pipeline'

// Ensures the cinema tables exist at boot (the cinema endpoints query the DB
// directly), then keeps data fresh every 6h: Letterboxd RSS (diaries then
// reviews) + Trakt (once connected) + the finishing pipeline. A manual pause
// (admin toggle) stops all automatic pulls.
export default defineNitroPlugin(async () => {
  await ensureDb()

  const run = async () => {
    const paused = await getSetting<{ paused?: boolean }>('autosync').catch(() => null)
    if (paused?.paused) return

    await syncLetterboxd().catch((e) => console.error('[letterboxd sync]', e?.message ?? e))
    const token = await getSetting<any>('trakt_token').catch(() => null)
    if (token?.access_token) {
      await syncTrakt().catch((e) => console.error('[trakt sync]', e?.message ?? e))
    }
    await runPipeline({ match: true }).catch((e) => console.error('[pipeline]', e?.message ?? e))
  }
  setTimeout(run, 60_000)
  setInterval(run, 6 * 60 * 60 * 1000)
})
