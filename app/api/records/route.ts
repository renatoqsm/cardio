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
  const params=new URL(request.url).searchParams, {pool}=getDatabase()
  if (params.has('submissionKey')) {
    const key=params.get('submissionKey')!
    if (!/^[0-9a-f-]{36}$/i.test(key)) return NextResponse.json({error:'Publicação inválida.'},{status:400})
    const record=(await pool.query('SELECT * FROM cardio_record WHERE "userId"=$1 AND "submissionKey"=$2',[session.user.id,key])).rows[0]
    const deleted=(await pool.query('SELECT 1 FROM deleted_submission WHERE "userId"=$1 AND "submissionKey"=$2',[session.user.id,key])).rowCount
    const destinations=record?(await pool.query('SELECT "challengeId" FROM record_challenge WHERE "recordId"=$1',[record.id])).rows:[]
    return NextResponse.json({publication:record?{record,alreadyPublished:true,countedChallengeIds:destinations.map(d=>d.challengeId)}:null,deleted:!!deleted},{headers:{'Cache-Control':'private, no-store'}})
  }
  if (params.get('view')==='history') {
    const modality=params.get('modality')??'all',month=params.get('month'),before=params.get('before')
    if (!['all','cardio','strength'].includes(modality)||(month&&!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month))||(before&&!/^[A-Za-z0-9_-]{1,100}$/.test(before))) return NextResponse.json({error:'Filtro inválido.'},{status:400})
    const anchor=before?(await pool.query('SELECT "createdAt"::text AS "createdAt",id FROM cardio_record WHERE id=$1 AND "userId"=$2',[before,session.user.id])).rows[0]:null
    if(before&&!anchor)return NextResponse.json({error:'Atualize o histórico para continuar.'},{status:409})
    const records=(await pool.query(`SELECT r.*,u.name,u.image FROM cardio_record r JOIN "user" u ON u.id=r."userId" WHERE r."userId"=$1 AND ($2='all' OR r.modality=$2) AND ($3::text IS NULL OR (r."recordDate">=($3||'-01')::date AND r."recordDate"<(($3||'-01')::date+interval '1 month'))) AND ($4::timestamp IS NULL OR (r."createdAt",r.id)<($4::timestamp,$5::text)) ORDER BY r."createdAt" DESC,r.id DESC LIMIT 21`,[session.user.id,modality,month,anchor?.createdAt??null,anchor?.id??null])).rows
    return NextResponse.json({records:records.slice(0,20),next:records.length>20?records[19].id:null},{headers:{'Cache-Control':'private, no-store'}})
  }
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
    await client.query("SELECT pg_advisory_xact_lock(hashtext('workout-publication'),hashtext($1))",[session.user.id])
    const found = (await client.query('SELECT id,\"submissionKey\" FROM cardio_record WHERE id=$1 AND "userId"=$2 FOR UPDATE',[recordId,session.user.id])).rows[0]
    if (!found) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Registro não encontrado ou já excluído.' }, { status: 404 }) }
    if(found.submissionKey) await client.query('INSERT INTO deleted_submission VALUES ($1,$2) ON CONFLICT DO NOTHING',[session.user.id,found.submissionKey])
    await client.query('DELETE FROM record_challenge WHERE "recordId"=$1',[recordId])
    await client.query('DELETE FROM cardio_record WHERE id=$1 AND "userId"=$2',[recordId,session.user.id])
    await client.query('COMMIT')
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
})
