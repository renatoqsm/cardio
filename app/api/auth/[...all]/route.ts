import { getAuth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { withDatabase } from '@/lib/db'

export const GET = withDatabase(async (request: Request) => toNextJsHandler(getAuth()).GET(request))
export const POST = withDatabase(async (request: Request) => toNextJsHandler(getAuth()).POST(request))
