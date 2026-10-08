import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/db'
import { headers } from 'next/headers'
import { currentGesture } from '@/lib/gestures'
import { signCapture } from '@/lib/capture-server'
import { imageType, saveProof } from '@/lib/storage'

export const runtime = 'nodejs'

export const POST = withDatabase(async (request: Request) => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !file.type.startsWith('image/')) return NextResponse.json({ error: 'Envie uma imagem válida' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'A imagem deve ter até 8 MB' }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  const type = imageType(bytes)
  if (!type) return NextResponse.json({ error: 'Envie uma imagem PNG, JPEG, GIF ou WebP válida' }, { status: 400 })
  const training = form.get('purpose') === 'training', gesture = currentGesture()
  if (training && (form.get('captureDay') !== gesture.captureDay || form.get('gestureId') !== gesture.id)) return NextResponse.json({ error: 'O gesto do dia mudou. Tire outra foto com o gesto atual.', code: 'GESTURE_CHANGED' }, { status: 409 })
  const pathname = await saveProof(session.user.id, bytes, type.extension)
  return NextResponse.json({ pathname, ...(training ? { captureToken: await signCapture(session.user.id, pathname, gesture) } : {}) })
})
