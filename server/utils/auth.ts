import type { H3Event } from 'h3'

// Throws 401 unless the caller has a valid admin session.
export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event)
  if (!session.user || (session.user as any).admin !== true) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}
