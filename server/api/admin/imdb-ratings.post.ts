import { requireAdmin } from '../../utils/db'
import { importImdbRatings } from '../../utils/imdb'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await importImdbRatings()
})
