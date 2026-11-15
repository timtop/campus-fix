import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { db } from './db'
export const digest = (v: string) => createHash('sha256').update(v).digest('hex')
export async function requireUser(event: H3Event, roles?: string[]) {
  const token = getCookie(event, 'campus_session')
  const session = token ? await db.session.findUnique({ where: { id: digest(token) }, include: { user: true } }) : null
  if (!session || session.expiresAt < new Date() || !session.user.active) throw createError({ statusCode: 401, statusMessage: 'Please sign in' })
  if (roles && !roles.includes(session.user.roleId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  return session.user
}
export async function startSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString('hex')
  await db.session.create({ data: { id: digest(token), userId, expiresAt: new Date(Date.now() + 8 * 3600000) } })
  setCookie(event, 'campus_session', token, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge: 8 * 3600 })
}
export function publicUser(user: { id: string; name: string; email: string; roleId: string; active: boolean }) {
  const { id, name, email, roleId, active } = user
  return { id, name, email, roleId, active }
}
const attempts = new Map<string, { count: number; until: number }>()
export function limitLogin(event: H3Event) {
  const key = getRequestIP(event) || 'local'
  const now = Date.now()
  if (attempts.size > 10000) for (const [k,v] of attempts) if (v.until < now) attempts.delete(k)
  const entry = attempts.get(key)
  if (entry && entry.until > now && entry.count >= 20) throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again in 15 minutes.' })
  attempts.set(key, entry && entry.until > now ? { ...entry, count: entry.count + 1 } : { count: 1, until: now + 900000 })
}
