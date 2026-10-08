import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { cardioRecord } from '@/lib/db/schema'

// Own daily check-in, independent of challenge membership.
export const GET = withDatabase(async (request: Request) => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const recordDate = new URL(request.url).searchParams.get('recordDate')
  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || Number.isNaN(Date.parse(recordDate)) || new Date(recordDate).toISOString().slice(0, 10) !== recordDate) return NextResponse.json({ error: 'Informe uma data válida.' }, { status: 400 })
  const { db } = getDatabase()
  const [existingRecord] = await db.select({ id: cardioRecord.id, submissionKey: cardioRecord.submissionKey, recordDate: cardioRecord.recordDate }).from(cardioRecord).where(and(eq(cardioRecord.userId, session.user.id), eq(cardioRecord.modality, 'strength'), eq(cardioRecord.recordDate, recordDate)))
  return NextResponse.json({ existingRecord: existingRecord ?? null }, { headers: { 'Cache-Control': 'private, no-store' } })
})
