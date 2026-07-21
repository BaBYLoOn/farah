import { getSetting, putSetting, requireAdmin } from '../../utils/db'

// Saves the Trakt app credentials the owner pastes in the admin, so connecting
// Trakt never requires editing .env or restarting the server.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ id?: string; secret?: string }>(event)
  const id = String(body?.id ?? '').trim()
  const secret = String(body?.secret ?? '').trim()

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Client ID is required' })

  // A blank secret field means "leave the saved one alone" — the UI never shows
  // the stored secret back, so the user shouldn't have to retype it to edit the id.
  const prev = await getSetting<{ id?: string; secret?: string }>('trakt_client')
  const nextSecret = secret || prev?.secret || ''
  if (!nextSecret) throw createError({ statusCode: 400, statusMessage: 'Client Secret is required' })

  await putSetting('trakt_client', { id, secret: nextSecret })
  return { ok: true }
})
