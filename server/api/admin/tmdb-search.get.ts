import { requireAdmin } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = String(getQuery(event).q ?? '').trim()
  const key = useRuntimeConfig().tmdbApiKey as string
  if (!key) throw createError({ statusCode: 400, statusMessage: 'No TMDB API key configured' })
  if (q.length < 2) return []

  const r = await $fetch<any>('https://api.themoviedb.org/3/search/multi', {
    params: { api_key: key, query: q },
    timeout: 15_000,
  })

  return (r.results ?? [])
    .filter((x: any) => x.media_type === 'movie' || x.media_type === 'tv')
    .slice(0, 8)
    .map((x: any) => ({
      tmdbId: x.id,
      type: x.media_type === 'tv' ? 'series' : 'film',
      title: x.title ?? x.name,
      year: Number((x.release_date ?? x.first_air_date ?? '').slice(0, 4)) || null,
      poster: x.poster_path ? `https://image.tmdb.org/t/p/w92${x.poster_path}` : null,
    }))
})
