import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const createDatabase = (pool: Pool) => drizzle(pool, { schema })
const requests = new AsyncLocalStorage<{ pool: Pool; db: ReturnType<typeof createDatabase> }>()

export function getDatabase() {
  const context = requests.getStore()
  if (!context) throw new Error('Database access requires a request context')
  return context
}

// Workers sockets belong to the request that opens them. Never reuse a pool
// across requests; release all connections after the route completes.
export function withDatabase<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args) => {
    const cloudflare = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
    const bindings = cloudflare ? getCloudflareContext().env as { HYPERDRIVE?: { connectionString: string } } : undefined
    const pool = new Pool({ connectionString: bindings?.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 })
    return requests.run({ pool, db: createDatabase(pool) }, async () => {
      try {
        return await handler(...args)
      } catch (error) {
        const failure = error as Error & { code?: string }
        console.error('Database request failed:', failure.code ?? 'REQUEST_FAILED')
        throw error
      }
      finally { await pool.end() }
    })
  }
}
