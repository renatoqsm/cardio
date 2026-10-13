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

export const DELETE = withDatabase(async (request: Request) => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 })
  const recordId = new URL(request.url).searchParams.get('recordId')
  if (!recordId || !/^[A-Za-z0-9_-]{1,100}$/.test(recordId)) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 })
  const client = await getDatabase().pool.connect()
  try {
    await client.query('BEGIN')
    const found = (await client.query('SELECT id FROM cardio_record WHERE id=$1 AND "userId"=$2 FOR UPDATE',[recordId,session.user.id])).rowCount
    if (!found) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Registro não encontrado ou já excluído.' }, { status: 404 }) }
    await client.query('DELETE FROM record_challenge WHERE "recordId"=$1',[recordId])
    await client.query('DELETE FROM cardio_record WHERE id=$1 AND "userId"=$2',[recordId,session.user.id])
    await client.query('COMMIT')
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
})
