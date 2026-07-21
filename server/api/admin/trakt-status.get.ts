import { getSetting, requireAdmin } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const cfg = useRuntimeConfig()
  const token = await getSetting<any>('trakt_token')
  return {
    hasKeys: Boolean(cfg.traktClientId && cfg.traktClientSecret),
    connected: Boolean(token?.access_token),
  }
})
