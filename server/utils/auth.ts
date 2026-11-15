import type { H3Event } from 'h3'
import { database, first, run, now } from './db'
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')
export async function requireUser(event: H3Event, roles?: string[]) {
  const token = getCookie(event,'campus_session')
  const user = token ? await first(database(event),'SELECT u.* FROM Session s JOIN User u ON u.id = s.userId WHERE s.id = ? AND s.expiresAt > ? AND u.active = 1',[await digest(token),now()]) : null
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Please sign in' })
  if (roles && !roles.includes(user.roleId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  return user
}
export async function startSession(event: H3Event, userId: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')
  await run(database(event),'INSERT INTO Session (id,userId,expiresAt) VALUES (?,?,?)',[await digest(token),userId,new Date(Date.now()+8*3600000).toISOString()])
  setCookie(event,'campus_session',token,{ httpOnly:true, secure:getRequestURL(event).protocol==='https:', sameSite:'lax',path:'/',maxAge:8*3600 })
}
export function publicUser(user: any) { const { id,name,email,roleId } = user; return { id,name,email,roleId,active:Boolean(user.active) } }
const attempts = new Map<string,{ count:number; until:number }>()
export function limitLogin(event: H3Event) {
  const key=getRequestIP(event)||'local', time=Date.now(), entry=attempts.get(key)
  if (attempts.size>10000) for (const [k,v] of attempts) if(v.until<time) attempts.delete(k)
  if(entry && entry.until>time && entry.count>=20) throw createError({ statusCode:429,statusMessage:'Too many attempts. Try again in 15 minutes.' })
  attempts.set(key,entry && entry.until>time ? {...entry,count:entry.count+1} : {count:1,until:time+900000})
}
