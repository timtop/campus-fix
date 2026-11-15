import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
const db = new PrismaClient()
async function main() {
  const password = process.env.DEMO_PASSWORD
  if (!password || password.length < 12) throw new Error('Set DEMO_PASSWORD to at least 12 characters')
  for (const id of ['STUDENT', 'STAFF', 'OFFICER', 'ADMIN']) await db.role.upsert({ where: { id }, create: { id }, update: {} })
  const users = []
  for (const [roleId, name] of [['STUDENT','Ada Okafor'],['STAFF','Dr. Musa Bello'],['OFFICER','Tomi Adeyemi'],['ADMIN','Campus Administrator']] as const) {
    users.push(await db.user.upsert({ where: { email: `${roleId.toLowerCase()}@campusfix.demo` }, create: { name, email: `${roleId.toLowerCase()}@campusfix.demo`, roleId, password: await hash(password, 12) }, update: {} }))
  }
  const categories = []
  for (const name of ['Electrical','Plumbing','Internet & IT','Furniture','Classroom equipment','Hostel maintenance']) categories.push(await db.category.upsert({ where: { name }, create: { name }, update: {} }))
  if (await db.serviceRequest.count() === 0) {
    const titles = ['Leaking tap in science laboratory','Library Wi-Fi disconnects frequently','Broken desk in lecture hall B','Hallway lights need replacement','Projector will not turn on','Hostel bathroom pipe leak','Loose socket near reading area','Damaged chair in staff room']
    for (let i = 0; i < titles.length; i++) {
      const status = ['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED'][i % 4]!
      await db.serviceRequest.create({ data: { title: titles[i]!, description: 'Please inspect this fault. It affects normal use of the facility and needs maintenance attention.', location: ['Science block, room 204','Main library, first floor','Lecture hall B','Hostel A, corridor','Science block, room 104','Hostel A, bathroom','Main library, reading area','Staff room, block B'][i]!, priority: i % 3 === 0 ? 'HIGH' : 'NORMAL', status, ownerId: users[i % 2]!.id, categoryId: categories[[1,2,3,0,4,1,0,3][i]!]!.id, logs: { create: { actorId: users[0]!.id, status, note: 'Seeded demonstration request' } }, ...(status !== 'OPEN' ? { assignments: { create: { officerId: users[2]!.id } } } : {}) } })
    }
  }
  console.log('Seed complete: student/staff/officer/admin@campusfix.demo. Password is the DEMO_PASSWORD you supplied.')
}
main().finally(() => db.$disconnect())
