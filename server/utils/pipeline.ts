import { resolveLetterboxdTmdb, letterboxdPosters } from './letterboxd'
import { enrichTitles } from './enrich'
import { importImdbRatings } from './imdb'

// After any sync/import, finish the data automatically so the owner never has
// to click buttons: (1) exact-match CSV films to TMDB via their Letterboxd URL,
// (2) fetch the missing TMDB details (runtime/creator/poster/imdb id),
// (3) fall back to Letterboxd artwork for whatever TMDB has no poster for,
// (4) pull IMDb ratings from the official dataset. Incremental — each step only
// touches titles that still need it — so it's cheap on later runs.
let running = false

export function pipelineBusy() {
  return running
}

export async function runPipeline(opts: { match?: boolean } = {}) {
  if (running) return { skipped: true as const }
  running = true
  const result = { matched: 0, enriched: 0, posters: 0, ratings: 0 }
  try {
    // 1) exact TMDB match for any unmatched Letterboxd films
    if (opts.match !== false) {
      let after = 0
      for (let i = 0; i < 200; i++) {
        const r = await resolveLetterboxdTmdb(30, after)
        result.matched += r.matched
        after = r.cursor
        if (r.done) break
      }
    }
    // 2) fetch TMDB details until nothing is missing
    for (let i = 0; i < 30; i++) {
      const r = await enrichTitles(120)
      result.enriched += r.enriched ?? 0
      if ((r.remaining ?? 0) === 0 || (r.enriched ?? 0) === 0) break
    }
    // 3) Letterboxd artwork for anything TMDB has no poster for
    {
      let after = 0
      for (let i = 0; i < 40; i++) {
        const r = await letterboxdPosters(25, after)
        result.posters += r.filled
        after = r.cursor
        if (r.done) break
      }
    }
    // 4) IMDb ratings from the daily dataset
    const rr = await importImdbRatings()
    result.ratings = rr.updated
  } catch (e: any) {
    console.error('[pipeline]', e?.message ?? e)
  } finally {
    running = false
  }
  return result
}

// fire-and-forget for request handlers — the sync returns immediately and the
// finishing work continues on the server
export function runPipelineInBackground(opts: { match?: boolean } = {}) {
  runPipeline(opts).catch((e) => console.error('[pipeline bg]', e?.message ?? e))
}
