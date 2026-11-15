import { z, ZodError } from 'zod'
import { database, rows, first, run, stmt, detail, uid, now } from '../utils/db'
import { requireUser, startSession, publicUser, digest, limitLogin } from '../utils/auth'
import { hashPassword, checkPassword } from '../utils/password'
import { canRead, validTransition, safeCsv } from '../utils/policy'
const input = z.object({ title:z.string().trim().min(5).max(160),description:z.string().trim().min(15).max(3000),location:z.string().trim().min(3).max(200),categoryId:z.string().min(1),priority:z.enum(['LOW','NORMAL','HIGH']),image:z.string().max(1400000).nullable().optional() })
export default defineEventHandler(async event => {
 try {
  const db=database(event), path=(event.path.split('?')[0]||'').replace(/^\/api\//,'').split('/'), method=event.method, id=path[1]||''
  const audit=(actor:string,action:string,target:string)=>stmt(db,'INSERT INTO Audit (id,actorId,action,target,createdAt) VALUES (?,?,?,?,?)',[uid(),actor,action,target,now()])
  if(path[0]==='health' && method==='GET'){ await first(db,'SELECT 1');return {status:'ok'} }
  if(path[0]==='auth') {
   if(id==='me' && method==='GET')return publicUser(await requireUser(event))
   if(id==='logout' && method==='POST'){ const token=getCookie(event,'campus_session');if(token)await run(db,'DELETE FROM Session WHERE id=?',[await digest(token)]);deleteCookie(event,'campus_session',{path:'/'});return {ok:true} }
   if(method!=='POST'||!['login','register'].includes(id))throw createError({statusCode:404})
   limitLogin(event)
   const pepper=String(event.context.cloudflare?.env?.PASSWORD_PEPPER||'')
   if(pepper.length<32)throw createError({statusCode:503,statusMessage:'Authentication configuration is incomplete'})
   const body=z.object({email:z.string().email().max(200).transform(s=>s.toLowerCase()),password:z.string().min(12).max(72),name:z.string().trim().min(2).max(100).optional(),roleId:z.enum(['STUDENT','STAFF']).optional()}).parse(await readBody(event))
   let user
   if(id==='register') {
    if(!body.name)throw createError({statusCode:400,statusMessage:'Name required'})
    const userId=uid();await run(db,'INSERT INTO User (id,name,email,password,roleId,active,createdAt) VALUES (?,?,?,?,?,1,?)',[userId,body.name,body.email,await hashPassword(body.password,pepper),body.roleId||'STUDENT',now()]);user=await first(db,'SELECT * FROM User WHERE id=?',[userId])
   }else{
    user=await first(db,'SELECT * FROM User WHERE email=?',[body.email]);if(!user||!user.active||!await checkPassword(body.password,user.password,pepper))throw createError({statusCode:401,statusMessage:'Invalid email or password'})
   }
   await startSession(event,user.id);return publicUser(user)
  }
  const user=await requireUser(event), admin=user.roleId==='ADMIN'
  if(path[0]==='categories') {
   if(method==='GET')return rows(db,'SELECT * FROM Category ORDER BY name')
   if(!admin)throw createError({statusCode:403})
   if(method==='POST'||method==='PATCH'){
    const {name}=z.object({name:z.string().trim().min(2).max(80)}).parse(await readBody(event));const key=method==='POST'?uid():id
    const result=await db.batch([method==='POST'?stmt(db,'INSERT INTO Category (id,name) VALUES (?,?)',[key,name]):stmt(db,'UPDATE Category SET name=? WHERE id=?',[name,key]),audit(user.id,method==='POST'?'CATEGORY_CREATED':'CATEGORY_UPDATED',key)])
    if(!result[0]?.meta.changes)throw createError({statusCode:404});return {id:key,name}
   }
   if(method==='DELETE'){ const results=await db.batch([stmt(db,'DELETE FROM Category WHERE id=?',[id]),audit(user.id,'CATEGORY_DELETED',id)]);if(!results[0]?.meta.changes)throw createError({statusCode:404});return {ok:true} }
  }
  if(path[0]==='users'){
   if(!admin)throw createError({statusCode:403})
   if(method==='GET')return (await rows(db,'SELECT id,name,email,roleId,active FROM User ORDER BY name')).map(publicUser)
   if(method==='PATCH'){
    const data=z.object({roleId:z.enum(['STUDENT','STAFF','OFFICER','ADMIN']),active:z.boolean()}).parse(await readBody(event));if(id===user.id)throw createError({statusCode:400,statusMessage:'You cannot change your own access'})
    const result=await db.batch([stmt(db,'UPDATE User SET roleId=?,active=? WHERE id=?',[data.roleId,data.active?1:0,id]),audit(user.id,'USER_ACCESS_CHANGED',id)])
    if(!result[0]?.meta.changes)throw createError({statusCode:404});return publicUser(await first(db,'SELECT * FROM User WHERE id=?',[id]))
   }
  }
  if(path[0]==='audit'&&method==='GET'){if(!admin)throw createError({statusCode:403});return rows(db,'SELECT * FROM Audit ORDER BY createdAt DESC LIMIT 100')}
  if(path[0]==='notifications'){
   if(method==='GET')return (await rows(db,'SELECT * FROM Notification WHERE userId=? ORDER BY createdAt DESC LIMIT 30',[user.id])).map(n=>({...n,read:Boolean(n.read)}))
   if(method==='PATCH'){await run(db,'UPDATE Notification SET read=1 WHERE userId=?',[user.id]);return {ok:true}}
  }
  if(path[0]==='reports'&&method==='GET'){
   if(!admin)throw createError({statusCode:403})
   const requests=await rows(db,'SELECT r.*,c.name AS categoryName FROM ServiceRequest r JOIN Category c ON c.id=r.categoryId')
   if(id==='export'){setHeader(event,'Content-Type','text/csv; charset=utf-8');setHeader(event,'Content-Disposition','attachment; filename="campusfix-requests.csv"');return [['ID','Title','Category','Location','Priority','Status','Created'],...requests.map(r=>[r.id,r.title,r.categoryName,r.location,r.priority,r.status,r.createdAt])].map(r=>r.map(safeCsv).join(',')).join('\r\n')}
   const done=requests.filter(r=>r.status==='COMPLETED')
   return {total:requests.length,byStatus:Object.fromEntries(['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'].map(s=>[s,requests.filter(r=>r.status===s).length])),byCategory:(await rows(db,'SELECT * FROM Category')).map(c=>({name:c.name,count:requests.filter(r=>r.categoryId===c.id).length})),averageResolutionHours:done.length?Math.round(done.reduce((n,r)=>n+(+new Date(r.updatedAt)-+new Date(r.createdAt))/3600000,0)/done.length):null}
  }
  if(path[0]==='requests'){
   if(!id){
    if(method==='GET'){
     const q=getQuery(event),page=Math.max(1,Math.min(100000,Math.floor(Number(q.page)||1))), clauses:string[]=[],values:unknown[]=[]
     if(!admin){if(user.roleId==='OFFICER'){clauses.push('EXISTS (SELECT 1 FROM Assignment a WHERE a.requestId=r.id AND a.officerId=?)')}else clauses.push('r.ownerId=?');values.push(user.id)}
     if(q.status){clauses.push('r.status=?');values.push(String(q.status))}if(q.categoryId){clauses.push('r.categoryId=?');values.push(String(q.categoryId))}
     if(q.search){clauses.push('(instr(lower(r.title),lower(?))>0 OR instr(lower(r.location),lower(?))>0)');const search=String(q.search).slice(0,200);values.push(search,search)}
     const where=clauses.length?' WHERE '+clauses.join(' AND '):''
     const result=await db.batch([stmt(db,'SELECT r.id FROM ServiceRequest r'+where+' ORDER BY r.createdAt DESC,r.id LIMIT 6 OFFSET ?',[...values,(page-1)*6]),stmt(db,'SELECT count(*) AS total FROM ServiceRequest r'+where,values)])
     const total=Number((result[1]?.results[0] as any)?.total||0),items=await Promise.all((result[0]?.results||[]).map((r:any)=>detail(db,r.id)))
     return {items,total,page,pages:Math.ceil(total/6)}
    }
    if(method==='POST'){
     if(!['STUDENT','STAFF'].includes(user.roleId))throw createError({statusCode:403})
     const data=input.parse(await readBody(event));if(data.image&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image))throw createError({statusCode:400,statusMessage:'Use PNG, JPEG or WebP images'})
     const key=uid(),time=now();await db.batch([stmt(db,'INSERT INTO ServiceRequest (id,title,description,location,priority,status,image,ownerId,categoryId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[key,data.title,data.description,data.location,data.priority,'OPEN',data.image||null,user.id,data.categoryId,time,time]),stmt(db,'INSERT INTO StatusLog (id,requestId,actorId,status,note,createdAt) VALUES (?,?,?,?,?,?)',[uid(),key,user.id,'OPEN','Request submitted',time]),audit(user.id,'REQUEST_CREATED',key)]);return detail(db,key)
    }
   }
   const r=await detail(db,id);if(!r)throw createError({statusCode:404,statusMessage:'Request not found'});if(!canRead(user,r))throw createError({statusCode:403,statusMessage:'Access denied'})
   if(method==='GET')return r
   if(method==='DELETE'){
    if(!admin&&!(r.ownerId===user.id&&r.status==='OPEN'))throw createError({statusCode:403})
    const clause=admin?'id=?':'id=? AND ownerId=? AND status=\'OPEN\'',values=admin?[id]:[id,user.id]
    await db.batch([stmt(db,`INSERT INTO Audit (id,actorId,action,target,createdAt) SELECT ?,?,?,?,? FROM ServiceRequest WHERE ${clause}`,[uid(),user.id,'REQUEST_DELETED',id,now(),...values]),stmt(db,'DELETE FROM ServiceRequest WHERE '+clause,values)]);return {ok:true}
   }
   if(path[2]==='assign'&&method==='POST'){
    if(!admin)throw createError({statusCode:403});if(['COMPLETED','CANCELLED'].includes(r.status))throw createError({statusCode:409,statusMessage:'Closed requests cannot be assigned'})
    const {officerId}=z.object({officerId:z.string()}).parse(await readBody(event)),officer=await first(db,"SELECT * FROM User WHERE id=? AND roleId='OFFICER' AND active=1",[officerId]);if(!officer)throw createError({statusCode:400,statusMessage:'Choose an active officer'})
    const logId=uid(),time=now(),status=r.status==='OPEN'?'ASSIGNED':r.status
    const result=await db.batch([
     stmt(db,'UPDATE ServiceRequest SET status=?,updatedAt=? WHERE id=? AND updatedAt=? AND status=?',[status,time,id,r.updatedAt,r.status]),
     stmt(db,'INSERT INTO StatusLog (id,requestId,actorId,status,note,createdAt) SELECT ?,?,?,?,?,? WHERE changes()=1',[logId,id,user.id,status,`Assigned to ${officer.name}`,time]),
     stmt(db,'INSERT INTO Assignment (id,requestId,officerId,createdAt) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM StatusLog WHERE id=?) ON CONFLICT(requestId) DO UPDATE SET officerId=excluded.officerId,createdAt=excluded.createdAt',[uid(),id,officerId,time,logId]),
     stmt(db,'INSERT INTO Notification (id,userId,message,read,createdAt) SELECT ?,?,?,0,? WHERE EXISTS (SELECT 1 FROM StatusLog WHERE id=?)',[uid(),officerId,`Assigned: ${r.title}`,time,logId]),
     stmt(db,'INSERT INTO Notification (id,userId,message,read,createdAt) SELECT ?,?,?,0,? WHERE EXISTS (SELECT 1 FROM StatusLog WHERE id=?)',[uid(),r.ownerId,`Your request was assigned: ${r.title}`,time,logId]),
     stmt(db,'INSERT INTO Audit (id,actorId,action,target,createdAt) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM StatusLog WHERE id=?)',[uid(),user.id,'REQUEST_ASSIGNED',id,time,logId])])
    if(!result[0]?.meta.changes)throw createError({statusCode:409,statusMessage:'Request changed. Refresh and retry.'});return {ok:true}
   }
   if(path[2]==='status'&&method==='PATCH'){
    if(!['ADMIN','OFFICER'].includes(user.roleId))throw createError({statusCode:403})
    const {status,note}=z.object({status:z.enum(['IN_PROGRESS','COMPLETED','CANCELLED']),note:z.string().trim().min(5).max(1000)}).parse(await readBody(event))
    if(!validTransition(r.status,status))throw createError({statusCode:409,statusMessage:'Invalid status transition'});if(!admin&&status==='CANCELLED')throw createError({statusCode:403})
    const logId=uid(),time=now(),officerCheck=admin?'':' AND EXISTS (SELECT 1 FROM Assignment a WHERE a.requestId=ServiceRequest.id AND a.officerId=?)'
    // D1 executes the batch atomically. Dependent writes require this operation's log.
    const result=await db.batch([
     stmt(db,'UPDATE ServiceRequest SET status=?,updatedAt=? WHERE id=? AND status=? AND updatedAt=?'+officerCheck,[status,time,id,r.status,r.updatedAt,...(admin?[]:[user.id])]),
     stmt(db,'INSERT INTO StatusLog (id,requestId,actorId,status,note,createdAt) SELECT ?,?,?,?,?,? WHERE changes()=1',[logId,id,user.id,status,note,time]),
     stmt(db,'INSERT INTO Notification (id,userId,message,read,createdAt) SELECT ?,?,?,0,? WHERE EXISTS (SELECT 1 FROM StatusLog WHERE id=?)',[uid(),r.ownerId,`${r.title}: ${status.replaceAll('_',' ')}`,time,logId]),
     stmt(db,'INSERT INTO Audit (id,actorId,action,target,createdAt) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM StatusLog WHERE id=?)',[uid(),user.id,`STATUS_${status}`,id,time,logId])])
    if(!result[0]?.meta.changes)throw createError({statusCode:409,statusMessage:'Request changed. Refresh and retry.'});return {ok:true}
   }
   if(!path[2]&&method==='PATCH'){
    if(r.ownerId!==user.id||r.status!=='OPEN')throw createError({statusCode:403,statusMessage:'Only the owner can edit an open request'})
    const data=input.omit({image:true}).parse(await readBody(event));const result=await db.batch([stmt(db,"UPDATE ServiceRequest SET title=?,description=?,location=?,categoryId=?,priority=?,updatedAt=? WHERE id=? AND ownerId=? AND status='OPEN'",[data.title,data.description,data.location,data.categoryId,data.priority,now(),id,user.id]),audit(user.id,'REQUEST_EDITED',id)]);if(!result[0]?.meta.changes)throw createError({statusCode:409});return detail(db,id)
   }
  }
  throw createError({statusCode:404,statusMessage:'Endpoint not found'})
 }catch(error:any){
  if(error instanceof ZodError)throw createError({statusCode:400,statusMessage:error.issues.map(i=>i.message).join('; ').slice(0,300)})
  if(error.statusCode)throw error
  if(/UNIQUE constraint|FOREIGN KEY constraint/.test(error.message||''))throw createError({statusCode:409,statusMessage:'Record conflicts with existing data or is in use'})
  console.error('API failure',error.message);throw createError({statusCode:500,statusMessage:'Unable to complete request'})
 }
})
