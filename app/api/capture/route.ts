import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/db'
import { currentGesture } from '@/lib/gestures'
export const GET = withDatabase(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json({ gesture: currentGesture() }, { headers: { 'Cache-Control': 'private, no-store' } })
})
