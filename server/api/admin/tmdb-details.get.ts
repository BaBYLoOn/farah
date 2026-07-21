import { requireAdmin } from '../../utils/db'
import { fmtRuntime, seriesRuntime } from '../../utils/enrich'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = useRuntimeConfig()
  const key = cfg.tmdbApiKey as string
  const omdbKey = cfg.omdbApiKey as string
  const id = Number(getQuery(event).id)
  const type = String(getQuery(event).type) === 'series' ? 'series' : 'film'
  if (!key || !id) throw createError({ statusCode: 400, statusMessage: 'Missing key or id' })

  const kind = type === 'series' ? 'tv' : 'movie'
  const det = await $fetch<any>(
    `https://api.themoviedb.org/3/${kind}/${id}?api_key=${key}&append_to_response=credits,external_ids`,
    { timeout: 15_000 },
  )

  const by = type === 'series'
    ? (det.created_by?.[0]?.name ?? '')
    : (det.credits?.crew?.find((c: any) => c.job === 'Director')?.name ?? '')

  let imdb: number | null = null
  const imdbId = det.external_ids?.imdb_id ?? det.imdb_id ?? null
  if (omdbKey && imdbId) {
    try {
      const om = await $fetch<any>(`https://www.omdbapi.com/?apikey=${omdbKey}&i=${imdbId}`, { timeout: 15_000 })
      const r = Number.parseFloat(om?.imdbRating)
      if (!Number.isNaN(r)) imdb = r
    } catch { /* stays null */ }
  }

  return {
    tmdbId: id,
    imdbId,
    type,
    title: det.title ?? det.name,
    year: Number((det.release_date ?? det.first_air_date ?? '').slice(0, 4)) || null,
    by,
    // series runtime = a typical episode, never the total run
    runtime: type === 'series' ? seriesRuntime(det) : fmtRuntime(det.runtime),
    imdb,
    poster: det.poster_path ? `https://image.tmdb.org/t/p/w500${det.poster_path}` : null,
  }
})
