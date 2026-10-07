import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sql } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { imageType, readProof, validOwner, validFilename } from '@/lib/storage'

export const runtime = 'nodejs'

export const GET = withDatabase(async (_request: Request, context: { params: Promise<{ owner: string; filename: string }> }) => {
  const { db } = getDatabase()
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { owner, filename } = await context.params
  if (!validOwner(owner) || !validFilename(filename)) return new NextResponse(null, { status: 404 })
  if (session.user.id !== owner) {
    const pathname = `/api/proofs/${owner}/${filename}`
    const access = await db.execute(sql`
      SELECT 1 FROM cardio_record r
      JOIN challenge_member author ON author."userId" = r."userId"
      JOIN challenge c ON c.id = author."challengeId"
      JOIN challenge_member viewer ON viewer."challengeId" = c.id
      WHERE r."proofPathname" = ${pathname} AND r."userId" = ${owner}
        AND viewer."userId" = ${session.user.id}
        AND r."recordDate" BETWEEN c."startDate" AND c."endDate"
      LIMIT 1
    `)
    if (!access.rowCount) return new NextResponse(null, { status: 404 })
  }
  const bytes = await readProof(owner, filename)
  const type = bytes && imageType(bytes)
  if (!bytes || !type) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), { headers: {
    'Content-Type': type.mime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
})
