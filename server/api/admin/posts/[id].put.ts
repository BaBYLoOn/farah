import { requireAdmin } from '~/server/utils/auth'
import { updatePost, type PostInput } from '~/server/utils/posts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody<PostInput>(event)
  return await updatePost(id, body)
})
