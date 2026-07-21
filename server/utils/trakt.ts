import { db, getSetting, putSetting, syncWatchCache } from './db'

// Trakt.tv — pulls the user's episode watch history and show ratings.
// Needs a (free) Trakt app: trakt.tv/oauth/applications. Paste its Client ID +
// Secret into the admin (stored in the DB — no file editing needed), then use
// "Connect Trakt" there: device-code flow, token kept in settings.
// NUXT_TRAKT_CLIENT_ID / _SECRET in .env still work as a fallback.

const API = 'https://api.trakt.tv'

// Trakt sits behind Cloudflare, which 403s requests with no User-Agent
// (ofetch/undici sends none) — every call must identify itself.
const UA = 'farahali.com/1.0'

type TraktToken = {
  access_token: string
  refresh_token: string
  created_at: number
  expires_in: number
}

// The Trakt app credentials. Admin-entered keys (stored in the DB) win over the
// env ones — so the site owner can paste their Trakt app id/secret in the admin
// UI and connect WITHOUT editing any files.
export async function getClientCfg() {
  const stored = await getSetting<{ id?: string; secret?: string }>('trakt_client')
  const cfg = useRuntimeConfig()
  return {
    id: (stored?.id || cfg.traktClientId || '') as string,
    secret: (stored?.secret || cfg.traktClientSecret || '') as string,
  }
}

// headers for the OAuth endpoints (device code / token exchange)
function authHeaders() {
  return { 'Content-Type': 'application/json', 'User-Agent': UA }
}

function apiHeaders(token: string | undefined, clientId: string) {
  return {
    'Content-Type': 'application/json',
    'User-Agent': UA,
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// step 1 of connecting: get a code the user types at trakt.tv/activate
export async function deviceCode() {
  const { id } = await getClientCfg()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No Trakt app keys yet — paste your Client ID + Secret in the admin first.' })
  let r: any
  try {
    r = await $fetch<any>(`${API}/oauth/device/code`, {
      method: 'POST',
      headers: authHeaders(),
      body: { client_id: id },
      timeout: 15_000,
    })
  } catch (e: any) {
    // Trakt answers a wrong/deleted app with a bare 401 — say what to actually fix
    // instead of surfacing "Unauthorized".
    if (e?.data?.error === 'invalid_client' || e?.statusCode === 401) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Trakt did not recognise that Client ID — check you copied it correctly from trakt.tv/oauth/applications, then save again.',
      })
    }
    throw createError({ statusCode: 502, statusMessage: 'Could not reach Trakt just now — try again in a moment.' })
  }
  await putSetting('trakt_device', r)
  return { userCode: r.user_code, url: r.verification_url, interval: r.interval }
}

// step 2: poll until the user has approved the code
export async function devicePoll() {
  const { id, secret } = await getClientCfg()
  const dev = await getSetting<any>('trakt_device')
  if (!dev?.device_code) throw createError({ statusCode: 400, statusMessage: 'Start the connect flow first' })
  try {
    const tok = await $fetch<TraktToken>(`${API}/oauth/device/token`, {
      method: 'POST',
      headers: authHeaders(),
      body: { code: dev.device_code, client_id: id, client_secret: secret },
      timeout: 15_000,
    })
    await putSetting('trakt_token', tok)
    return { connected: true }
  } catch (err: any) {
    if (err?.response?.status === 400) return { connected: false, pending: true } // user hasn't approved yet
    throw err
  }
}

async function accessToken(): Promise<string> {
  const tok = await getSetting<TraktToken>('trakt_token')
  if (!tok) throw createError({ statusCode: 400, statusMessage: 'Trakt is not connected' })
  const expiresAt = (tok.created_at + tok.expires_in) * 1000
  if (Date.now() < expiresAt - 86_400_000) return tok.access_token

  // refresh a token in its last day
  const { id, secret } = await getClientCfg()
  const fresh = await $fetch<TraktToken>(`${API}/oauth/token`, {
    method: 'POST',
    headers: authHeaders(),
    body: {
      refresh_token: tok.refresh_token,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    },
    timeout: 15_000,
  })
  await putSetting('trakt_token', fresh)
  return fresh.access_token
}

// full sync as a RECONCILE: the site's Trakt-managed series (auto-created,
// edited = 0) are made to match Trakt exactly — so removing a show or episode
// on Trakt removes it here too. We fetch everything first, and only then
// delete/rewrite, so a mid-fetch API error can't wipe data.
export async function syncTrakt() {
  const token = await accessToken()
  const { id: clientId } = await getClientCfg()
  const d = db()

  let shows = 0
  const showIds = new Map<number, number>() // trakt show tmdb id → titles.id

  async function titleForShow(show: any): Promise<number | null> {
    const tmdbId = show?.ids?.tmdb ?? null
    const imdbId = show?.ids?.imdb ?? null
    if (tmdbId && showIds.has(tmdbId)) return showIds.get(tmdbId)!

    // Reuse the row we already have for this show rather than creating a second
    // one. A show Farah logged on Letterboxd (e.g. Sharp Objects) is stored with
    // its TMDB /tv id, so the id match finds it — including while it is still
    // typed 'film', which is how Letterboxd exports every entry. Matching on
    // tmdb_kind='tv' as well as type='series' keeps that case covered even if the
    // row has not been enriched yet. The id/imdb matches are exact; the
    // title+year match is the last resort and stays restricted to real series so
    // a film can never be swallowed by a same-named show.
    const existing = await d.execute({
      sql: `SELECT id FROM titles
            WHERE (? IS NOT NULL AND tmdb_id = ? AND (type = 'series' OR tmdb_kind = 'tv'))
               OR (? IS NOT NULL AND ? <> '' AND imdb_id = ? AND (type = 'series' OR tmdb_kind = 'tv'))
               OR (lower(title) = lower(?) AND (year = ? OR ? IS NULL) AND type = 'series')
            ORDER BY (tmdb_id IS NOT NULL AND tmdb_id = ?) DESC, id ASC
            LIMIT 1`,
      args: [
        tmdbId, tmdbId,
        imdbId, imdbId ?? '', imdbId,
        String(show?.title ?? ''), show?.year ?? null, show?.year ?? null,
        tmdbId,
      ],
    })

    let id: number
    if (existing.rows.length) {
      id = Number(existing.rows[0].id)
      // Trakt is telling us this is a show — promote the row so it stops being
      // presented as a film, and record the endpoint its id belongs to.
      await d.execute({
        sql: `UPDATE titles SET tmdb_id = COALESCE(tmdb_id, ?), imdb_id = COALESCE(imdb_id, ?),
                type = 'series', tmdb_kind = COALESCE(tmdb_kind, 'tv') WHERE id = ?`,
        args: [tmdbId, imdbId, id],
      })
    } else if (show?.title) {
      const slug = String(show.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const ins = await d.execute({
        sql: `INSERT INTO titles (tmdb_id, imdb_id, tmdb_kind, slug, title, year, type, by, runtime, watched, watches)
              VALUES (?,?,'tv',?,?,?,'series','','', '', 1)`,
        args: [tmdbId, imdbId, slug, show.title, show.year ?? null],
      })
      id = Number(ins.lastInsertRowid)
      shows++
    } else {
      return null
    }
    if (tmdbId) showIds.set(tmdbId, id)
    return id
  }

  // 1) fetch the FULL episode history first (nothing is deleted yet)
  const episodes: Array<{ titleId: number; watched: string; season: number | null; episode: number | null }> = []
  for (let page = 1; page <= 100; page++) {
    const res: any[] = await $fetch<any[]>(
      `${API}/sync/history?type=episodes&limit=200&page=${page}`,
      { headers: apiHeaders(token, clientId), timeout: 30_000 },
    )
    if (!res?.length) break
    for (const item of res) {
      const titleId = await titleForShow(item.show)
      const watched = String(item.watched_at ?? '').slice(0, 10)
      if (titleId && watched) {
        episodes.push({ titleId, watched, season: item.episode?.season ?? null, episode: item.episode?.number ?? null })
      }
    }
    if (res.length < 200) break
  }

  // 2) fetch current show ratings (10-point already)
  const rated: any[] = await $fetch<any[]>(`${API}/sync/ratings/shows`, {
    headers: apiHeaders(token, clientId),
    timeout: 30_000,
  })
  const ratingByTitle = new Map<number, number>()
  for (const item of rated ?? []) {
    const titleId = await titleForShow(item.show)
    if (titleId && item.rating) ratingByTitle.set(titleId, item.rating)
  }

  // 3) reconcile — only now do we mutate. Trakt owns exactly the watch rows that
  // carry a season/episode: every other importer (Letterboxd RSS, diary.csv, the
  // admin's add-title) writes a date-only row with season NULL. Scoping the
  // delete to season IS NOT NULL therefore lets ONE title row be shared by both
  // sources — Trakt's episode plays are replaced wholesale each sync (so
  // re-syncing can never pile up duplicates) while the Letterboxd diary entry
  // for the same show survives untouched.
  await d.execute(`DELETE FROM watches WHERE season IS NOT NULL
                   AND title_id IN (SELECT id FROM titles WHERE type='series')`)
  for (const e of episodes) {
    await d.execute({
      sql: 'INSERT INTO watches (title_id, watched, season, episode) VALUES (?,?,?,?)',
      args: [e.titleId, e.watched, e.season, e.episode],
    })
  }

  // Shared (Letterboxd-matched) shows are skipped by the rating pass below, so
  // refresh their watch cache here or their episode counts would go stale.
  for (const titleId of new Set(episodes.map((e) => e.titleId))) {
    await syncWatchCache(titleId)
  }

  // Ratings/cleanup still only touch series Trakt is allowed to manage: a
  // Letterboxd-matched show keeps the rating she gave it there.
  const SERIES = "type='series' AND (lb_uri IS NULL OR lb_uri='')"

  // rebuild the cache + reconcile ratings for every series. Trakt is the source
  // of truth for a show's rating too: set it from Trakt, and CLEAR it when it's
  // no longer rated there — so removing/changing a rating on Trakt always shows
  // here (a hand-edited series is no exception; the user rates shows on Trakt).
  const allSeries = await d.execute(`SELECT id FROM titles WHERE ${SERIES}`)
  let ratings = 0
  for (const row of allSeries.rows as any[]) {
    const id = Number(row.id)
    const r = ratingByTitle.get(id) ?? null
    await d.execute({ sql: 'UPDATE titles SET my_rating = ? WHERE id = ?', args: [r, id] })
    if (r != null) ratings++
    await syncWatchCache(id)
  }

  // drop auto-managed series Trakt no longer has (no episodes AND no rating);
  // never auto-delete a hand-edited series
  const del = await d.execute(`DELETE FROM titles
    WHERE ${SERIES} AND edited=0
      AND my_rating IS NULL
      AND id NOT IN (SELECT DISTINCT title_id FROM watches)`)
  const removed = Number((del as any).rowsAffected ?? 0)

  return { records: episodes.length, shows, ratings, removed }
}
