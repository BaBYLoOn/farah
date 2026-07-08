import { requireAdmin } from '~/server/utils/auth'
import { getPostById } from '~/server/utils/posts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  const post = await getPostById(id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return post
})
