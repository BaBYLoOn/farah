import { putSetting, requireAdmin } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { key, value } = await readBody<{ key: string; value: unknown }>(event)
  if (!['cinema', 'autosync', 'trakt_client'].includes(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad settings key' })
  }
  await putSetting(key, value)
  return { ok: true }
})
