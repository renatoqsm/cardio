import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { readProof } from '@/lib/storage'
import { challenge, challengeMember, cardioRecord, user } from '@/lib/db/schema'

const id = () => crypto.randomUUID()
async function currentUser() { const session = await getAuth().api.getSession({ headers: await headers() }); if (!session?.user) throw new Error('UNAUTHORIZED'); return session.user }

export const GET = withDatabase(async (request: Request) => {
  const { db } = getDatabase()
  try {
    const me = await currentUser()
    const selectedId = new URL(request.url).searchParams.get('challengeId')
    const memberships = await db.select({ challenge, memberId: challengeMember.id }).from(challengeMember).innerJoin(challenge, eq(challengeMember.challengeId, challenge.id)).where(eq(challengeMember.userId, me.id)).orderBy(desc(challenge.createdAt))
    const active = memberships.find((item) => item.challenge.id === selectedId)?.challenge ?? memberships[0]?.challenge
    if (!active) return NextResponse.json({ user: me, challenges: [], leaderboard: [], feed: [] })
    const members = await db.select({ id: user.id, name: user.name }).from(challengeMember).innerJoin(user, eq(challengeMember.userId, user.id)).where(eq(challengeMember.challengeId, active.id))
    const memberIds = members.map((member) => member.id)
    const records = memberIds.length === 0 ? [] : await db.select({ id: cardioRecord.id, userId: cardioRecord.userId, name: user.name, recordDate: cardioRecord.recordDate, minutes: cardioRecord.minutes, kilometers: cardioRecord.kilometers, pace: cardioRecord.pace, activityType: cardioRecord.activityType, proofPathname: cardioRecord.proofPathname, description: cardioRecord.description, createdAt: cardioRecord.createdAt }).from(cardioRecord).innerJoin(user, eq(cardioRecord.userId, user.id)).where(and(inArray(cardioRecord.userId, memberIds), gte(cardioRecord.recordDate, active.startDate), lte(cardioRecord.recordDate, active.endDate))).orderBy(desc(cardioRecord.createdAt))
    const leaderboard = members.map((member) => { const mine = records.filter((record) => record.userId === member.id); return { ...member, minutes: mine.reduce((sum, record) => sum + record.minutes, 0), kilometers: mine.reduce((sum, record) => sum + Number(record.kilometers), 0), pace: mine.length ? mine.reduce((sum, record) => sum + Number(record.pace ?? 0), 0) / mine.length : 0 } }).sort((a, b) => active.goalType === 'pace' ? a.pace - b.pace : active.goalType === 'time' ? b.minutes - a.minutes : b.kilometers - a.kilometers)
    return NextResponse.json({ user: me, challenges: memberships.map((item) => item.challenge), selectedChallengeId: active.id, leaderboard, feed: records })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ user: null, challenges: [] }, { status: 401 })
    console.error('Failed to load challenges:', error instanceof Error ? error.message : 'Unknown database error')
    return NextResponse.json({ error: 'Não foi possível carregar os desafios' }, { status: 500 })
  }
})

export const DELETE = withDatabase(async (request: Request) => {
  const { db } = getDatabase()
  try {
    const me = await currentUser()
    const challengeId = new URL(request.url).searchParams.get('challengeId')
    if (!challengeId) return NextResponse.json({ error: 'Desafio não informado' }, { status: 400 })
    const owned = await db.select({ id: challenge.id }).from(challenge).where(and(eq(challenge.id, challengeId), eq(challenge.ownerId, me.id)))
    if (!owned[0]) return NextResponse.json({ error: 'Você não pode excluir este desafio' }, { status: 403 })
    await db.delete(cardioRecord).where(eq(cardioRecord.challengeId, challengeId))
    await db.delete(challengeMember).where(eq(challengeMember.challengeId, challengeId))
    await db.delete(challenge).where(eq(challenge.id, challengeId))
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Não foi possível excluir o desafio' }, { status: 400 })
  }
})

export const POST = withDatabase(async (request: Request) => {
  const { db } = getDatabase()
  try { const me = await currentUser(); const body = await request.json()
    if (body.action === 'join') { const found = await db.select().from(challenge).where(eq(challenge.joinCode, String(body.joinCode).trim().toUpperCase())); if (!found[0]) return NextResponse.json({ error: 'Chave não encontrada' }, { status: 404 }); await db.insert(challengeMember).values({ id: id(), challengeId: found[0].id, userId: me.id, joinedAt: new Date() }).onConflictDoNothing(); return NextResponse.json({ challenge: found[0] }) }
    if (body.action === 'create') { const code = Math.random().toString(36).slice(2, 8).toUpperCase(); const created = { id: id(), ownerId: me.id, name: body.name, goalType: body.goalType, goalValue: body.goalValue || null, startDate: body.startDate, endDate: body.endDate, joinCode: code, createdAt: new Date() }; await db.insert(challenge).values(created); await db.insert(challengeMember).values({ id: id(), challengeId: created.id, userId: me.id, joinedAt: new Date() }); return NextResponse.json({ challenge: created }) }
    if (body.action === 'record') {
      const proof = typeof body.proofPathname === 'string' ? body.proofPathname.split('/') : []
      if (proof.length !== 5 || proof[1] !== 'api' || proof[2] !== 'proofs' || proof[3] !== me.id || !await readProof(me.id, proof[4])) return NextResponse.json({ error: 'Envie seu comprovante antes de registrar o treino' }, { status: 400 })
      const record = { id: id(), challengeId: null, userId: me.id, recordDate: body.recordDate, minutes: Number(body.minutes), kilometers: String(body.kilometers), pace: body.pace ? String(body.pace) : null, activityType: body.activityType || 'Cardio', proofPathname: body.proofPathname, description: body.description?.trim() || null, createdAt: new Date() }; const existing = await db.select({ id: cardioRecord.id }).from(cardioRecord).where(and(eq(cardioRecord.userId, me.id), eq(cardioRecord.recordDate, record.recordDate))); if (existing[0]) { await db.update(cardioRecord).set({ minutes: record.minutes, kilometers: record.kilometers, pace: record.pace, activityType: record.activityType, proofPathname: record.proofPathname, description: record.description }).where(eq(cardioRecord.id, existing[0].id)); return NextResponse.json({ record: { ...record, id: existing[0].id } }) } await db.insert(cardioRecord).values(record); return NextResponse.json({ record }) }
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) { if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 }); return NextResponse.json({ error: 'Não foi possível concluir a ação' }, { status: 400 }) }
})
