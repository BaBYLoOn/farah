import { requireAdmin } from '~/server/utils/auth'
import { deletePost } from '~/server/utils/posts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  await deletePost(id)
  return { ok: true }
})
