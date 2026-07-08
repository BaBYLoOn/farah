import { getSite } from '~/server/utils/site'

export default defineEventHandler(async () => {
  return await getSite()
})
