import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/db'
import { achievementsForUsers } from '@/lib/achievement-store'

export const GET = withDatabase(async () => {
  const me = (await getAuth().api.getSession({ headers: await headers() }))?.user
  if (!me) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  return Response.json((await achievementsForUsers([me.id])).get(me.id), { headers: { 'Cache-Control': 'private, no-store' } })
})
