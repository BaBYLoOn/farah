import { requireAdmin } from '~/server/utils/auth'
import { reorderPosts } from '~/server/utils/posts'
import type { PostKind } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { kind, ids } = await readBody<{ kind: PostKind; ids: string[] }>(event)
  if ((kind !== 'essay' && kind !== 'weblog') || !Array.isArray(ids)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request' })
  }
  await reorderPosts(kind, ids)
  return { ok: true }
})
