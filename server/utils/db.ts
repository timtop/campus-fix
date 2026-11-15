import type { H3Event } from 'h3'
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
export function database(event: H3Event): D1Database {
  const db = event.context.cloudflare?.env?.DB as D1Database | undefined
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Database binding DB is unavailable' })
  return db
}
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export function stmt(db: D1Database, sql: string, values: unknown[] = []): D1PreparedStatement { return db.prepare(sql).bind(...values) }
export async function rows<T = any>(db: D1Database, sql: string, values: unknown[] = []): Promise<T[]> { return (await stmt(db, sql, values).all<T>()).results }
export async function first<T = any>(db: D1Database, sql: string, values: unknown[] = []): Promise<T | null> { return stmt(db, sql, values).first<T>() }
export async function run(db: D1Database, sql: string, values: unknown[] = []) { return stmt(db, sql, values).run() }
export async function detail(db: D1Database, id: string) {
  const r = await first(db, 'SELECT * FROM ServiceRequest WHERE id = ?', [id])
  if (!r) return null
  const [category, owner, assignments, logs] = await Promise.all([
    first(db,'SELECT * FROM Category WHERE id = ?', [r.categoryId]),
    first(db,'SELECT id, name FROM User WHERE id = ?', [r.ownerId]),
    rows(db,'SELECT a.*, u.name AS officerName FROM Assignment a JOIN User u ON u.id = a.officerId WHERE a.requestId = ?', [id]),
    rows(db,'SELECT l.*, u.name AS actorName FROM StatusLog l JOIN User u ON u.id = l.actorId WHERE l.requestId = ? ORDER BY l.createdAt, l.rowid', [id]),
  ])
  return { ...r, category, owner, assignments: assignments.map(a => ({ ...a, officer: { id: a.officerId, name: a.officerName } })), logs: logs.map(l => ({ ...l, actor: { name: l.actorName } })) }
}
