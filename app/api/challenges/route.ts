import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, desc, eq, gte, inArray, lte, or, isNull, sql } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { readProof, validFilename } from '@/lib/storage'
import { verifyCapture } from '@/lib/capture-server'
import { parseRecordInput } from '@/lib/record-input'
import { parseChallengeInput } from '@/lib/challenge-input'
import { challenge, challengeMember, cardioRecord, user } from '@/lib/db/schema'

const id = () => crypto.randomUUID()
class RequestError extends Error { constructor(message: string, public status = 400) { super(message) } }
async function currentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) throw new RequestError('Não autenticado', 401)
  return session.user
}
function failure(error: unknown) {
  if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('Challenge request failed')
  return NextResponse.json({ error: 'Não foi possível concluir a ação. Tente novamente.' }, { status: 500 })
}
async function ownedPhoto(value: unknown, owner: string) {
  if (value == null || value === '') return null
  const parts = typeof value === 'string' ? value.split('/') : []
  if (parts.length !== 5 || parts[1] !== 'api' || parts[2] !== 'proofs' || parts[3] !== owner || !validFilename(parts[4]) || !await readProof(owner, parts[4])) {
    throw new RequestError('Envie uma foto válida da sua conta antes de salvar.')
  }
  return String(value)
}

export const GET = withDatabase(async (request: Request) => {
  try {
    const me = await currentUser(), { db } = getDatabase()
    const selectedId = new URL(request.url).searchParams.get('challengeId')
    const memberships = await db.select({ challenge }).from(challengeMember).innerJoin(challenge, eq(challengeMember.challengeId, challenge.id)).where(eq(challengeMember.userId, me.id)).orderBy(desc(challenge.createdAt))
    const active = memberships.find(item => item.challenge.id === selectedId)?.challenge ?? memberships[0]?.challenge
    if (!active) return NextResponse.json({ user: me, challenges: [], leaderboard: [], members: [], feed: [] }, { headers: { 'Cache-Control': 'no-store' } })
    const counts = await db.select({ challengeId: challengeMember.challengeId, count: sql<number>`count(*)::int` }).from(challengeMember).where(inArray(challengeMember.challengeId, memberships.map(item => item.challenge.id))).groupBy(challengeMember.challengeId)
    const members = await db.select({ id: user.id, name: user.name, image: user.image, joinedAt: challengeMember.joinedAt }).from(challengeMember).innerJoin(user, eq(challengeMember.userId, user.id)).where(eq(challengeMember.challengeId, active.id))
    const memberIds = members.map(member => member.id)
    const records = memberIds.length === 0 ? [] : await db.select({ id: cardioRecord.id, captureDay: cardioRecord.captureDay, gestureId: cardioRecord.gestureId, modality: cardioRecord.modality, userId: cardioRecord.userId, name: user.name, image: user.image, recordDate: cardioRecord.recordDate, minutes: cardioRecord.minutes, kilometers: cardioRecord.kilometers, pace: cardioRecord.pace, activityType: cardioRecord.activityType, proofPathname: cardioRecord.proofPathname, description: cardioRecord.description, createdAt: cardioRecord.createdAt }).from(cardioRecord).innerJoin(user, eq(cardioRecord.userId, user.id)).where(and(inArray(cardioRecord.userId, memberIds), eq(cardioRecord.modality, active.modality), gte(cardioRecord.recordDate, active.startDate), lte(cardioRecord.recordDate, active.endDate))).orderBy(desc(cardioRecord.createdAt), desc(cardioRecord.id))
    const leaderboard = members.map(member => {
      const mine = records.filter(record => record.userId === member.id)
      const kilometers = mine.reduce((sum, record) => sum + Number(record.kilometers), 0)
      const paceTime = mine.reduce((sum, record) => Number(record.kilometers) > 0 ? sum + (record.pace ? Number(record.pace) * Number(record.kilometers) : record.minutes) : sum, 0)
      return { ...member, isOwner: member.id === active.ownerId, workouts: mine.length, checkIns: new Set(mine.map(record => record.recordDate)).size, activeDays: new Set(mine.map(record => record.recordDate)).size, lastTrainingDate: mine.map(record => record.recordDate).sort().at(-1) ?? null, minutes: mine.reduce((sum, record) => sum + record.minutes, 0), kilometers, pace: kilometers > 0 ? paceTime / kilometers : null }
    }).sort((a, b) => (active.modality === 'strength' ? b.checkIns - a.checkIns : active.goalType === 'pace' ? (a.pace ?? Infinity) - (b.pace ?? Infinity) : active.goalType === 'time' ? b.minutes - a.minutes : b.kilometers - a.kilometers) || b.workouts - a.workouts || a.name.localeCompare(b.name, 'pt-BR'))
    return NextResponse.json({ user: me, challenges: memberships.map(item => ({ ...item.challenge, memberCount: counts.find(count => count.challengeId === item.challenge.id)?.count ?? 0 })), selectedChallengeId: active.id, leaderboard, members: leaderboard, feed: records }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
})

export const DELETE = withDatabase(async (request: Request) => {
  try {
    const me = await currentUser(), { db } = getDatabase()
    const challengeId = new URL(request.url).searchParams.get('challengeId')
    if (!challengeId) throw new RequestError('Desafio não informado')
    if (!(await db.select({ id: challenge.id }).from(challenge).where(and(eq(challenge.id, challengeId), eq(challenge.ownerId, me.id))))[0]) throw new RequestError('Você não pode excluir este desafio', 403)
    await db.transaction(async tx => {
      await tx.update(cardioRecord).set({ challengeId: null }).where(eq(cardioRecord.challengeId, challengeId))
      await tx.delete(challengeMember).where(eq(challengeMember.challengeId, challengeId))
      await tx.delete(challenge).where(eq(challenge.id, challengeId))
    })
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
})

export const POST = withDatabase(async (request: Request) => {
  try {
    const me = await currentUser(), { db } = getDatabase(), body = await request.json()
    if (body.action === 'leave') {
      if (typeof body.challengeId !== 'string' || !body.challengeId) throw new RequestError('Desafio não informado')
      const [membership] = await db.select({ ownerId: challenge.ownerId }).from(challengeMember).innerJoin(challenge, eq(challengeMember.challengeId, challenge.id)).where(and(eq(challengeMember.challengeId, body.challengeId), eq(challengeMember.userId, me.id)))
      if (!membership) throw new RequestError('Você não participa deste desafio', 403)
      if (membership.ownerId === me.id) throw new RequestError('O administrador não pode sair do próprio desafio. Use Excluir desafio.', 409)
      await db.delete(challengeMember).where(and(eq(challengeMember.challengeId, body.challengeId), eq(challengeMember.userId, me.id)))
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'join') {
      const found = await db.select().from(challenge).where(eq(challenge.joinCode, String(body.joinCode).trim().toUpperCase()))
      if (!found[0]) throw new RequestError('Chave não encontrada', 404)
      await db.insert(challengeMember).values({ id: id(), challengeId: found[0].id, userId: me.id, joinedAt: new Date() }).onConflictDoNothing()
      return NextResponse.json({ challenge: found[0] })
    }
    if (body.action === 'create' || body.action === 'update') {
      if (body.action === 'update' && !(await db.select({ id: challenge.id }).from(challenge).where(and(eq(challenge.id, String(body.challengeId)), eq(challenge.ownerId, me.id))))[0]) throw new RequestError('Só quem criou o desafio pode editá-lo', 403)
      let values
      try { values = parseChallengeInput(body) } catch (error) { throw new RequestError((error as Error).message) }
      if (body.action === 'update') {
        const [existing] = await db.select({ modality: challenge.modality }).from(challenge).where(eq(challenge.id, String(body.challengeId)))
        if (existing.modality !== values.modality) throw new RequestError('A modalidade do desafio não pode ser alterada. Crie outro desafio para a nova modalidade.')
      }
      const media = { profilePathname: await ownedPhoto(body.profilePathname, me.id), coverPathname: await ownedPhoto(body.coverPathname, me.id) }
      if (body.action === 'update') {
        const [updated] = await db.update(challenge).set({ ...values, ...media }).where(and(eq(challenge.id, String(body.challengeId)), eq(challenge.ownerId, me.id))).returning()
        return NextResponse.json({ challenge: updated })
      }
      const created = { ...values, ...media, id: id(), ownerId: me.id, joinCode: crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(), createdAt: new Date() }
      await db.transaction(async tx => { await tx.insert(challenge).values(created); await tx.insert(challengeMember).values({ id: id(), challengeId: created.id, userId: me.id, joinedAt: new Date() }) })
      return NextResponse.json({ challenge: created })
    }
    if (body.action === 'record') {
      const modality = body.modality ?? 'cardio'
      if (modality !== 'cardio' && modality !== 'strength') throw new RequestError('Escolha Cardio ou Musculação.')
      let values
      try { values = modality === 'strength' ? { minutes: 0, kilometers: '0', pace: null } : parseRecordInput(body) } catch (error) { throw new RequestError((error as Error).message) }
      if (typeof body.recordDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.recordDate) || Number.isNaN(Date.parse(body.recordDate)) || new Date(body.recordDate).toISOString().slice(0, 10) !== body.recordDate) throw new RequestError('Informe uma data válida para o treino.')
      const pathname = await ownedPhoto(body.proofPathname, me.id)
      if (!pathname) throw new RequestError('Envie seu comprovante antes de registrar o treino')
      const capture = await verifyCapture(body.captureToken, me.id, pathname)
      if (!capture) throw new RequestError('Atualize a página e tire uma nova foto pela câmera do site com o gesto do dia.')
      if (body.submissionKey != null && (typeof body.submissionKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.submissionKey))) throw new RequestError('Identificador de publicação inválido. Abra o formulário novamente.')
      const submissionKey = body.submissionKey || `proof:${pathname}`
      const record = { id: id(), challengeId: null, userId: me.id, modality, submissionKey, captureDay: capture.captureDay, gestureId: capture.gestureId, recordDate: body.recordDate, ...values, activityType: modality === 'strength' ? 'Musculação' : typeof body.activityType === 'string' ? body.activityType.slice(0, 40) : 'Cardio', proofPathname: pathname, description: typeof body.description === 'string' ? body.description.trim().slice(0, 1500) || null : null, createdAt: new Date() }
      const confirmation = (existing: typeof cardioRecord.$inferSelect) => NextResponse.json({
        code: 'STRENGTH_CHECKIN_EXISTS', error: 'Você já registrou um treino de musculação nessa data. Deseja substituí-lo?',
        existingRecord: { id: existing.id, submissionKey: existing.submissionKey, recordDate: existing.recordDate },
      }, { status: 409 })
      let saved: typeof cardioRecord.$inferSelect
      let alreadyPublished = false, replaced = false
      if (body.replaceExisting === true) {
        if (modality !== 'strength' || typeof body.replaceRecordId !== 'string' || !(body.expectedSubmissionKey === null || typeof body.expectedSubmissionKey === 'string')) throw new RequestError('Confirme o treino de musculação que deseja substituir.')
        const [retry] = await db.select().from(cardioRecord).where(and(eq(cardioRecord.userId, me.id), eq(cardioRecord.submissionKey, submissionKey)))
        if (retry) {
          if (retry.id !== body.replaceRecordId || retry.modality !== 'strength' || retry.recordDate !== body.recordDate) throw new RequestError('Esta publicação já foi concluída. Abra um novo registro.', 409)
          saved = retry; alreadyPublished = true; replaced = true
        } else {
          const [updated] = await db.update(cardioRecord).set({ proofPathname: pathname, description: record.description, submissionKey, captureDay: capture.captureDay, gestureId: capture.gestureId }).where(and(eq(cardioRecord.id, body.replaceRecordId), eq(cardioRecord.userId, me.id), eq(cardioRecord.modality, 'strength'), eq(cardioRecord.recordDate, body.recordDate), body.expectedSubmissionKey === null ? isNull(cardioRecord.submissionKey) : eq(cardioRecord.submissionKey, body.expectedSubmissionKey))).returning()
          if (!updated) {
            const [current] = await db.select().from(cardioRecord).where(and(eq(cardioRecord.userId, me.id), eq(cardioRecord.modality, 'strength'), eq(cardioRecord.recordDate, body.recordDate)))
            if (current?.id === body.replaceRecordId && current.submissionKey === submissionKey) { saved = current; alreadyPublished = true; replaced = true }
            else if (current) return confirmation(current)
            else throw new RequestError('O treino original não está mais disponível. Abra um novo registro.', 409)
          } else { saved = updated; replaced = true }
        }
      } else {
        const [created] = await db.insert(cardioRecord).values(record).onConflictDoNothing().returning()
        const existing = created ?? (await db.select().from(cardioRecord).where(and(eq(cardioRecord.userId, me.id), or(eq(cardioRecord.submissionKey, submissionKey), ...(modality === 'strength' ? [and(eq(cardioRecord.modality, 'strength'), eq(cardioRecord.recordDate, body.recordDate))!] : [])))))[0]
        if (!existing || existing.modality !== modality) throw new RequestError('Esta publicação já foi concluída. Abra um novo registro.', 409)
        if (!created && modality === 'strength' && existing.submissionKey !== submissionKey) return confirmation(existing)
        saved = existing; alreadyPublished = !created
      }
      const counted = await db.select({ id: challenge.id }).from(challengeMember).innerJoin(challenge, eq(challengeMember.challengeId, challenge.id)).where(and(eq(challengeMember.userId, me.id), eq(challenge.modality, saved.modality), lte(challenge.startDate, saved.recordDate), gte(challenge.endDate, saved.recordDate)))
      return NextResponse.json({ record: saved, alreadyPublished, replaced, countedChallengeIds: counted.map(item => item.id) })
    }
    throw new RequestError('Ação inválida')
  } catch (error) { return failure(error) }
})
