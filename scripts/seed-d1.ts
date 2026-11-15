import { mkdtempSync,writeFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { hashPassword } from '../server/utils/password'
const mode=process.argv.includes('--remote')?'--remote':'--local'
const password=process.env.DEMO_PASSWORD
const pepper=process.env.PASSWORD_PEPPER
if(!pepper||pepper.length<32)throw new Error('Supply PASSWORD_PEPPER with at least 32 characters')
if(!password||password.length<12)throw new Error('Supply DEMO_PASSWORD with at least 12 characters')
const q=(v:string)=>"'"+v.replaceAll("'","''")+"'"
const sql:string[]=[],time=new Date().toISOString()
const roles=['STUDENT','STAFF','OFFICER','ADMIN']
for(const role of roles){sql.push(`INSERT OR IGNORE INTO Role (id) VALUES (${q(role)});`)}
const names=['Ada Okafor','Dr. Musa Bello','Tomi Adeyemi','Campus Administrator']
for(const [i,role] of roles.entries())sql.push(`INSERT OR IGNORE INTO User (id,name,email,password,roleId,active,createdAt) VALUES (${[q('demo-'+role.toLowerCase()),q(names[i]!),q(role.toLowerCase()+'@campusfix.demo'),q(await hashPassword(password,pepper)),q(role),1,q(time)].join(',')});`)
const categories=['Electrical','Plumbing','Internet & IT','Furniture','Classroom equipment','Hostel maintenance']
for(const [i,name] of categories.entries())sql.push(`INSERT OR IGNORE INTO Category (id,name) VALUES ('category-${i}',${q(name)});`)
const titles=['Leaking tap in science laboratory','Library Wi-Fi disconnects frequently','Broken desk in lecture hall B','Hallway lights need replacement','Projector will not turn on','Hostel bathroom pipe leak','Loose socket near reading area','Damaged chair in staff room']
const locations=['Science block, room 204','Main library, first floor','Lecture hall B','Hostel A, corridor','Science block, room 104','Hostel A, bathroom','Main library, reading area','Staff room, block B']
for(const [i,title] of titles.entries()){
 const id='demo-request-'+i,status=['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED'][i%4]!,owner=i%2?'demo-staff':'demo-student',category='category-'+[1,2,3,0,4,1,0,3][i]
 sql.push(`INSERT OR IGNORE INTO ServiceRequest (id,title,description,location,priority,status,ownerId,categoryId,createdAt,updatedAt) VALUES (${[id,title,'Please inspect this fault. It affects normal use of this campus facility.',locations[i]!,i%3===0?'HIGH':'NORMAL',status,owner,category,time,time].map(q).join(',')});`)
 sql.push(`INSERT OR IGNORE INTO StatusLog (id,requestId,actorId,status,note,createdAt) VALUES (${['demo-log-'+i,id,owner,status,'Seeded demonstration request',time].map(q).join(',')});`)
 if(status!=='OPEN')sql.push(`INSERT OR IGNORE INTO Assignment (id,requestId,officerId,createdAt) VALUES (${['demo-assignment-'+i,id,'demo-officer',time].map(q).join(',')});`)
}
const temp=mkdtempSync(join(tmpdir(),'campusfix-seed-'))
try{
 const file=join(temp,'seed.sql');writeFileSync(file,sql.join('\n'),{mode:0o600})
 const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',mode,'--file',file,'--yes'],{stdio:'inherit',env:process.env})
 if(result.status)process.exitCode=result.status
}finally{rmSync(temp,{recursive:true,force:true})}
