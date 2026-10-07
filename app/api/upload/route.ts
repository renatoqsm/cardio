import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { imageType, saveProof } from '@/lib/storage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !file.type.startsWith('image/')) return NextResponse.json({ error: 'Envie uma imagem válida' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'A imagem deve ter até 8 MB' }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  const type = imageType(bytes)
  if (!type) return NextResponse.json({ error: 'Envie uma imagem PNG, JPEG, GIF ou WebP válida' }, { status: 400 })
  const pathname = await saveProof(session.user.id, bytes, type.extension)
  return NextResponse.json({ pathname })
}
