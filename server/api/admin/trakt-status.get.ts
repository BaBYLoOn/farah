import { getSetting, requireAdmin } from '../../utils/db'
import { getClientCfg } from '../../utils/trakt'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id, secret } = await getClientCfg()
  const token = await getSetting<any>('trakt_token')
  return {
    hasKeys: Boolean(id && secret),
    connected: Boolean(token?.access_token),
    // echo the id back so the admin field can show what's already saved; the
    // secret never leaves the server — we only report whether one is set.
    clientId: id || '',
    hasSecret: Boolean(secret),
  }
})
