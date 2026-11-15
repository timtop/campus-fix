import { z, ZodError } from 'zod'
import { hash, compare } from 'bcryptjs'
import { db } from '../utils/db'
import { requireUser, startSession, publicUser, digest, limitLogin } from '../utils/auth'
import { canRead, validTransition, safeCsv } from '../utils/policy'
const requestSchema = z.object({ title: z.string().trim().min(5).max(160), description: z.string().trim().min(15).max(3000), location: z.string().trim().min(3).max(200), categoryId: z.string().min(1), priority: z.enum(['LOW','NORMAL','HIGH']), image: z.string().max(2800000).nullable().optional() })
const include = { category: true, owner: { select: { id: true, name: true } }, assignments: { include: { officer: { select: { id: true, name: true } } } }, logs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' as const } } }
export default defineEventHandler(async event => {
  try {
    const path = (event.path.split('?')[0] || '').replace(/^\/api\//, '').split('/')
    const method = event.method
    if (path[0] === 'health') { await db.$queryRaw`SELECT 1`; return { status: 'ok' } }
    if (path[0] === 'auth') {
      if ((path[1] || '') === 'me') return publicUser(await requireUser(event))
      if ((path[1] || '') === 'logout' && method === 'POST') {
        const token = getCookie(event, 'campus_session')
        if (token) await db.session.deleteMany({ where: { id: digest(token) } })
        deleteCookie(event, 'campus_session', { path: '/' }); return { ok: true }
      }
      if (method !== 'POST' || !['login','register'].includes((path[1] || ''))) throw createError({ statusCode: 404 })
      limitLogin(event)
      const body = z.object({ email: z.string().email().max(200).transform(s => s.toLowerCase()), password: z.string().min(12).max(72), name: z.string().trim().min(2).max(100).optional(), roleId: z.enum(['STUDENT','STAFF']).optional() }).parse(await readBody(event))
      let user
      if ((path[1] || '') === 'register') {
        if (!body.name) throw createError({ statusCode: 400, statusMessage: 'Name required' })
        if (await db.user.findUnique({ where: { email: body.email } })) throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
        user = await db.user.create({ data: { email: body.email, name: body.name, password: await hash(body.password, 12), roleId: body.roleId || 'STUDENT' } })
      } else {
        user = await db.user.findUnique({ where: { email: body.email } })
        if (!user || !user.active || !await compare(body.password, user.password)) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
      }
      await startSession(event, user.id); return publicUser(user)
    }
    const user = await requireUser(event)
    const audit = (action: string, target: string) => db.audit.create({ data: { actorId: user.id, action, target } })
    if (path[0] === 'categories') {
      if (method === 'GET') return db.category.findMany({ orderBy: { name: 'asc' } })
      if (user.roleId !== 'ADMIN') throw createError({ statusCode: 403 })
      if (method === 'POST') { const data = z.object({ name: z.string().trim().min(2).max(80) }).parse(await readBody(event)); const c = await db.category.create({ data }); await audit('CATEGORY_CREATED',c.id); return c }
      if (method === 'PATCH') { const data = z.object({ name: z.string().trim().min(2).max(80) }).parse(await readBody(event)); const c = await db.category.update({ where: { id: (path[1] || '') }, data }); await audit('CATEGORY_UPDATED',c.id); return c }
      if (method === 'DELETE') { await db.category.delete({ where: { id: (path[1] || '') } }); await audit('CATEGORY_DELETED',(path[1] || '')); return { ok: true } }
    }
    if (path[0] === 'users') {
      if (user.roleId !== 'ADMIN') throw createError({ statusCode: 403 })
      if (method === 'GET') return (await db.user.findMany({ orderBy: { name: 'asc' } })).map(publicUser)
      if (method === 'PATCH') {
        const data = z.object({ roleId: z.enum(['STUDENT','STAFF','OFFICER','ADMIN']), active: z.boolean() }).parse(await readBody(event))
        if ((path[1] || '') === user.id) throw createError({ statusCode: 400, statusMessage: 'You cannot change your own access' })
        const updated = await db.user.update({ where: { id: (path[1] || '') }, data }); await audit('USER_ACCESS_CHANGED',updated.id); return publicUser(updated)
      }
    }
    if (path[0] === 'audit') { if (user.roleId !== 'ADMIN') throw createError({ statusCode: 403 }); return db.audit.findMany({ take: 100, orderBy: { createdAt: 'desc' } }) }
    if (path[0] === 'notifications') {
      if (method === 'GET') return db.notification.findMany({ where: { userId: user.id }, take: 30, orderBy: { createdAt: 'desc' } })
      if (method === 'PATCH') { await db.notification.updateMany({ where: { userId: user.id }, data: { read: true } }); return { ok: true } }
    }
    const scope = user.roleId === 'ADMIN' ? {} : user.roleId === 'OFFICER' ? { assignments: { some: { officerId: user.id } } } : { ownerId: user.id }
    if (path[0] === 'reports') {
      if (user.roleId !== 'ADMIN') throw createError({ statusCode: 403 })
      const requests = await db.serviceRequest.findMany({ include: { category: true } })
      if ((path[1] || '') === 'export') {
        setHeader(event,'Content-Type','text/csv; charset=utf-8'); setHeader(event,'Content-Disposition','attachment; filename="campusfix-requests.csv"')
        return [['ID','Title','Category','Location','Priority','Status','Created'], ...requests.map(r => [r.id,r.title,r.category.name,r.location,r.priority,r.status,r.createdAt.toISOString()])].map(row => row.map(safeCsv).join(',')).join('\r\n')
      }
      return { total: requests.length, byStatus: Object.fromEntries(['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'].map(s => [s, requests.filter(r => r.status === s).length])), byCategory: (await db.category.findMany()).map(c => ({ name: c.name, count: requests.filter(r => r.categoryId === c.id).length })), averageResolutionHours: (() => { const done = requests.filter(r => r.status === 'COMPLETED'); return done.length ? Math.round(done.reduce((sum,r) => sum + (+r.updatedAt - +r.createdAt)/3600000,0)/done.length) : null })() }
    }
    if (path[0] === 'requests') {
      if (!(path[1] || '')) {
        if (method === 'GET') {
          const q = getQuery(event)
          const page = Math.max(1, Math.min(100000, Number(q.page) || 1))
          const where = { ...scope, ...(q.status ? { status: String(q.status) } : {}), ...(q.categoryId ? { categoryId: String(q.categoryId) } : {}), ...(q.search ? { OR: [{ title: { contains: String(q.search).slice(0,200) } },{ location: { contains: String(q.search).slice(0,200) } }] } : {}) }
          const [items,total] = await db.$transaction([db.serviceRequest.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1)*6, take: 6 }),db.serviceRequest.count({ where })])
          return { items, total, page, pages: Math.ceil(total/6) }
        }
        if (method === 'POST') {
          if (!['STUDENT','STAFF'].includes(user.roleId)) throw createError({ statusCode: 403 })
          const data = requestSchema.parse(await readBody(event))
          if (data.image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image)) throw createError({ statusCode: 400, statusMessage: 'Use PNG, JPEG or WebP images' })
          const r = await db.serviceRequest.create({ data: { ...data, ownerId: user.id, logs: { create: { actorId: user.id, status: 'OPEN', note: 'Request submitted' } } }, include }); await audit('REQUEST_CREATED',r.id); return r
        }
      }
      const r = await db.serviceRequest.findUnique({ where: { id: (path[1] || '') }, include })
      if (!r) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
      if (!canRead(user,r)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
      if (method === 'GET') return r
      if (method === 'DELETE') {
        if (user.roleId !== 'ADMIN' && !(r.ownerId === user.id && r.status === 'OPEN')) throw createError({ statusCode: 403 })
        await db.$transaction([db.serviceRequest.delete({ where: { id: r.id } }),audit('REQUEST_DELETED',r.id)]); return { ok: true }
      }
      if (path[2] === 'assign' && method === 'POST') {
        if (user.roleId !== 'ADMIN') throw createError({ statusCode: 403 })
        if (['COMPLETED','CANCELLED'].includes(r.status)) throw createError({ statusCode: 409, statusMessage: 'Closed requests cannot be assigned' })
        const { officerId } = z.object({ officerId: z.string() }).parse(await readBody(event))
        const officer = await db.user.findUnique({ where: { id: officerId } })
        if (!officer || officer.roleId !== 'OFFICER' || !officer.active) throw createError({ statusCode: 400, statusMessage: 'Choose an active officer' })
        await db.$transaction([db.assignment.upsert({ where: { requestId: r.id }, create: { requestId: r.id, officerId }, update: { officerId } }),db.serviceRequest.update({ where: { id: r.id }, data: { status: r.status === 'OPEN' ? 'ASSIGNED' : r.status, logs: { create: { actorId: user.id, status: r.status === 'OPEN' ? 'ASSIGNED' : r.status, note: `Assigned to ${officer.name}` } } } }),db.notification.create({ data: { userId: officerId, message: `Assigned: ${r.title}` } }),db.notification.create({ data: { userId: r.ownerId, message: `Your request was assigned: ${r.title}` } }),audit('REQUEST_ASSIGNED',r.id)])
        return { ok: true }
      }
      if (method === 'PATCH' && path[2] === 'status') {
        if (!['ADMIN','OFFICER'].includes(user.roleId)) throw createError({ statusCode: 403 })
        const { status, note } = z.object({ status: z.enum(['IN_PROGRESS','COMPLETED','CANCELLED']), note: z.string().trim().min(5).max(1000) }).parse(await readBody(event))
        if (!validTransition(r.status,status)) throw createError({ statusCode: 409, statusMessage: 'Invalid status transition' })
        if (user.roleId === 'OFFICER' && status === 'CANCELLED') throw createError({ statusCode: 403 })
        // Conditional update prevents two concurrent transitions from both succeeding.
        await db.$transaction(async tx => {
          const changed = await tx.serviceRequest.updateMany({ where: { id: r.id, status: r.status }, data: { status } })
          if (!changed.count) throw createError({ statusCode: 409, statusMessage: 'Request changed. Refresh and retry.' })
          await tx.statusLog.create({ data: { requestId: r.id, actorId: user.id, status, note } })
          await tx.notification.create({ data: { userId: r.ownerId, message: `${r.title}: ${status.replaceAll('_',' ')}` } })
          await tx.audit.create({ data: { actorId: user.id, action: `STATUS_${status}`, target: r.id } })
        }); return { ok: true }
      }
      if (method === 'PATCH' && !path[2]) {
        if (r.ownerId !== user.id || r.status !== 'OPEN') throw createError({ statusCode: 403, statusMessage: 'Only the owner can edit an open request' })
        const data = requestSchema.omit({ image: true }).parse(await readBody(event))
        const updated = await db.serviceRequest.update({ where: { id: r.id }, data, include }); await audit('REQUEST_EDITED',r.id); return updated
      }
    }
    throw createError({ statusCode: 404, statusMessage: 'Endpoint not found' })
  } catch (error: any) {
    if (error instanceof ZodError) throw createError({ statusCode: 400, statusMessage: error.issues.map(i => i.message).join('; ').slice(0,300) })
    if (error.code === 'P2002' || error.code === 'P2003') throw createError({ statusCode: 409, statusMessage: 'Record conflicts with existing data or is in use' })
    if (error.code === 'P2025') throw createError({ statusCode: 404, statusMessage: 'Record not found' })
    if (error.statusCode) throw error
    console.error('API failure', error.code || error.name)
    throw createError({ statusCode: 500, statusMessage: 'Unable to complete request' })
  }
})
