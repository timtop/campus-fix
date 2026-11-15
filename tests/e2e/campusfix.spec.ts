import { test, expect, request as makeRequest } from '@playwright/test'
const password = process.env.DEMO_PASSWORD || 'CampusFix-Demo-2026'
async function client(role: string) {
  const c = await makeRequest.newContext({ baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000' })
  const response = await c.post('/api/auth/login', { data: { email: `${role}@campusfix.demo`, password } })
  expect(response.status()).toBe(200)
  return c
}
test('API rejects anonymous access and cross-origin writes', async ({ request }) => {
  expect((await request.get('/api/requests')).status()).toBe(401)
  expect((await request.post('/api/auth/login', { headers: { Origin: 'https://untrusted.example' }, data: { email: 'admin@campusfix.demo', password } })).status()).toBe(403)
})
test('API enforces roles, ownership, workflow, CRUD and notifications', async () => {
  const student = await client('student'), staff = await client('staff'), officer = await client('officer'), admin = await client('admin')
  try {
    expect((await student.get('/api/users')).status()).toBe(403)
    expect((await officer.get('/api/reports')).status()).toBe(403)
    const categories = await (await student.get('/api/categories')).json()
    const payload = { title: 'Test leaking laboratory tap', description: 'A continuous leak is flooding the floor by the laboratory sink.', location: 'Laboratory room 201', categoryId: categories[0].id, priority: 'HIGH' }
    expect((await student.post('/api/requests', { data: { ...payload, title: 'x' } })).status()).toBe(400)
    const created = await student.post('/api/requests', { data: payload }); expect(created.status()).toBe(200)
    const r = await created.json()
    expect((await staff.get(`/api/requests/${r.id}`)).status()).toBe(403)
    expect((await officer.get(`/api/requests/${r.id}`)).status()).toBe(403)
    expect((await student.patch(`/api/requests/${r.id}`, { data: { ...payload, title: 'Updated leaking laboratory tap' } })).status()).toBe(200)
    const allUsers = await (await admin.get('/api/users')).json()
    const officerId = (await (await officer.get('/api/auth/me')).json()).id
    expect(allUsers.every((u: any) => !u.password)).toBe(true)
    expect((await student.post(`/api/requests/${r.id}/assign`, { data: { officerId } })).status()).toBe(403)
    expect((await admin.post(`/api/requests/${r.id}/assign`, { data: { officerId } })).status()).toBe(200)
    expect((await officer.patch(`/api/requests/${r.id}/status`, { data: { status: 'COMPLETED', note: 'Skip the progress step' } })).status()).toBe(409)
    expect((await officer.patch(`/api/requests/${r.id}/status`, { data: { status: 'IN_PROGRESS', note: 'Inspection started and tools collected' } })).status()).toBe(200)
    expect((await student.delete(`/api/requests/${r.id}`)).status()).toBe(403)
    expect((await officer.patch(`/api/requests/${r.id}/status`, { data: { status: 'COMPLETED', note: 'Replaced the faulty washer and tested the tap' } })).status()).toBe(200)
    const detail = await (await student.get(`/api/requests/${r.id}`)).json()
    expect(detail.logs.map((l: any) => l.status)).toEqual(['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED'])
    const notes = await (await student.get('/api/notifications')).json(); expect(notes.some((n: any) => n.message.includes('COMPLETED'))).toBe(true)
    const csv = await admin.get('/api/reports/export'); expect(csv.headers()['content-type']).toContain('text/csv'); expect(await csv.text()).toContain('Updated leaking laboratory tap')
    expect((await admin.delete(`/api/requests/${r.id}`)).status()).toBe(200)
    expect((await admin.get(`/api/requests/${r.id}`)).status()).toBe(404)
  } finally { await Promise.all([student.dispose(),staff.dispose(),officer.dispose(),admin.dispose()]) }
})
test('API registration cannot self-grant administrator and logout revokes session', async ({ request }) => {
  const response = await request.post('/api/auth/register', { data: { name: 'Test User', email: `test-${Date.now()}@campusfix.demo`, password, roleId: 'ADMIN' } }); expect(response.status()).toBe(400)
  const c = await client('staff'); expect((await c.post('/api/auth/logout')).status()).toBe(200); expect((await c.get('/api/auth/me')).status()).toBe(401); await c.dispose()
})
test('student frontend submits an image request, edits it and deletes it', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Email address').fill('student@campusfix.demo'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My service requests' })).toBeVisible()
  await page.getByRole('button', { name: 'New request' }).click()
  await page.getByLabel('Request title').fill('Frontend test broken lamp')
  await page.getByLabel('Location', { exact: true }).fill('Reading room 105')
  await page.getByLabel('What happened?').fill('The desk lamp does not switch on even with a working socket.')
  await page.getByLabel('Photo evidence').setInputFiles({ name: 'fault.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1cAAAAASUVORK5CYII=', 'base64') })
  await page.getByRole('button', { name: 'Submit request', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Request submitted')
  await page.getByRole('button', { name: 'Frontend test broken lamp', exact: true }).click()
  await expect(page.getByAltText('Uploaded fault evidence')).toBeVisible()
  await page.getByRole('button', { name: 'Edit request', exact: true }).click(); await page.getByLabel('Request title').fill('Frontend test repaired title'); await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: 'Frontend test repaired title', exact: true }).click(); await page.getByRole('button', { name: 'Delete request', exact: true }).click(); await page.getByRole('button', { name: 'Confirm permanent deletion' }).click()
  await expect(page.getByRole('status')).toContainText('Request deleted')
})
test('admin frontend reports, categories, user access and screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/01-login.png', fullPage: true })
  await page.getByLabel('Email address').fill('admin@campusfix.demo'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Campus overview' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Next', exact: false })).toBeEnabled(); await page.screenshot({ path: 'docs/screenshots/02-admin-dashboard.png', fullPage: true })
  await page.getByRole('button', { name: 'Reports', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Requests by status' })).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/03-reports.png', fullPage: true })
  await page.getByRole('button', { name: 'Categories', exact: true }).click(); await page.getByLabel('New category').fill(`Test category ${Date.now()}`); await page.getByRole('button', { name: 'Add category', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Category added')
  await page.getByRole('button', { name: 'People & access', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Campus users' })).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/04-user-management.png', fullPage: true })
})
test('officer and student interfaces render on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); await page.getByLabel('Email address').fill('officer@campusfix.demo'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your maintenance queue' })).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/05-officer-dashboard.png', fullPage: true })
  await page.getByRole('button', { name: 'Sign out' }).click(); await page.getByLabel('Email address').fill('student@campusfix.demo'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('heading', { name: 'My service requests' })).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/06-student-dashboard.png', fullPage: true })
  await page.getByRole('button', { name: 'New request' }).click(); await page.screenshot({ path: 'docs/screenshots/07-request-form.png', fullPage: true }); await page.getByRole('button', { name: 'Close form' }).click()
  await page.locator('.request-title').first().click(); await expect(page.getByRole('heading', { name: 'Request timeline' })).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/08-request-tracking.png', fullPage: true }); await page.getByRole('button', { name: 'Close request' }).click()
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'docs/screenshots/09-mobile.png', fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('API filters and pagination preserve ownership, category CRUD and inactive sessions', async () => {
  const admin = await client('admin'), student = await client('student')
  const c = await makeRequest.newContext({ baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000' })
  try {
    const list = await (await admin.get('/api/requests?page=1')).json(); expect(list.items.length).toBeLessThanOrEqual(6); expect(list.total).toBeGreaterThan(6)
    const second = await (await admin.get('/api/requests?page=2')).json(); expect(second.items.every((r: any) => !list.items.some((x: any) => x.id === r.id))).toBe(true)
    const me = await (await student.get('/api/auth/me')).json(); const own = await (await student.get('/api/requests?search=leak')).json(); expect(own.items.every((r: any) => r.ownerId === me.id && (r.title.toLowerCase().includes('leak') || r.location.toLowerCase().includes('leak')))).toBe(true)
    const created = await (await admin.post('/api/categories', { data: { name: `API test ${Date.now()}` } })).json(); expect(created.id).toBeTruthy()
    expect((await admin.patch(`/api/categories/${created.id}`, { data: { name: `Renamed ${Date.now()}` } })).status()).toBe(200); expect((await admin.delete(`/api/categories/${created.id}`)).status()).toBe(200)
    const registered = await c.post('/api/auth/register', { data: { name: 'Integration Student', email: `integration-${Date.now()}@campusfix.demo`, password, roleId: 'STUDENT' } }); expect(registered.status()).toBe(200); const fresh = await registered.json()
    expect((await admin.patch(`/api/users/${fresh.id}`, { data: { roleId: 'STUDENT', active: false } })).status()).toBe(200); expect((await c.get('/api/requests')).status()).toBe(401)
  } finally { await Promise.all([admin.dispose(),student.dispose(),c.dispose()]) }
})
test('concurrent officer updates create one progress log and failed creation rolls back', async () => {
  const student=await client('student'),admin=await client('admin'),officer=await client('officer')
  try {
    const categories=await (await student.get('/api/categories')).json()
    const payload={title:'Concurrent maintenance test',description:'Test that competing status writes preserve one complete history.',location:'Test laboratory',categoryId:categories[0].id,priority:'NORMAL'}
    const initial=await (await student.get('/api/requests')).json()
    expect((await student.post('/api/requests',{data:{...payload,categoryId:'missing-category'}})).status()).toBe(409)
    expect((await (await student.get('/api/requests')).json()).total).toBe(initial.total)
    const r=await (await student.post('/api/requests',{data:payload})).json()
    const users=await (await admin.get('/api/users')).json()
    expect((await admin.post(`/api/requests/${r.id}/assign`,{data:{officerId:users.find((u:any)=>u.roleId==='OFFICER').id}})).status()).toBe(200)
    const results=await Promise.all([1,2].map(n=>officer.patch(`/api/requests/${r.id}/status`,{data:{status:'IN_PROGRESS',note:`Concurrent attempt number ${n}`}})))
    expect(results.map(r=>r.status()).sort()).toEqual([200,409])
    const updated=await (await student.get(`/api/requests/${r.id}`)).json()
    expect(updated.logs.filter((l:any)=>l.status==='IN_PROGRESS')).toHaveLength(1)
    await admin.delete(`/api/requests/${r.id}`)
  } finally {await Promise.all([student.dispose(),admin.dispose(),officer.dispose()])}
})
