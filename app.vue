<script setup lang="ts">
type User = { id: string; name: string; email: string; roleId: string; active: boolean }
type Category = { id: string; name: string }
// The catch-all API route uses explicit response types at the UI boundary.
const api = $fetch as unknown as (url: string, options?: Record<string, any>) => Promise<any>
const user = ref<User | null>(null)
const ready = ref(false)
const busy = ref(false)
const error = ref('')
const message = ref('')
const tab = ref('requests')
const register = ref(false)
const showPassword = ref(false)
const auth = reactive({ email: '', password: '', name: '', roleId: 'STUDENT' })
const categories = ref<Category[]>([])
const users = ref<User[]>([])
const notifications = ref<any[]>([])
const audit = ref<any[]>([])
const reports = ref<any>(null)
const result = ref<any>({ items: [], total: 0, page: 1, pages: 0 })
const search = ref('')
const status = ref('')
const categoryId = ref('')
const page = ref(1)
const selected = ref<any>(null)
const showForm = ref(false)
const editing = ref('')
const form = reactive({ title: '', description: '', location: '', categoryId: '', priority: 'NORMAL', image: null as string | null })
const officerId = ref('')
const nextStatus = ref('IN_PROGRESS')
const note = ref('')
const newCategory = ref('')
const deleting = ref(false)
const isAdmin = computed(() => user.value?.roleId === 'ADMIN')
const requester = computed(() => ['STUDENT','STAFF'].includes(user.value?.roleId || ''))
const officers = computed(() => users.value.filter(u => u.roleId === 'OFFICER' && u.active))
const unread = computed(() => notifications.value.filter(n => !n.read).length)
const roleName = computed(() => ({ ADMIN: 'Administration', OFFICER: 'Maintenance officer', STUDENT: 'Student', STAFF: 'Staff' }[user.value?.roleId || 'STUDENT']))
function failure(e: any) { error.value = e?.data?.statusMessage || e?.message || 'Unable to connect. Please try again.' }
async function action(fn: () => Promise<void>) {
  busy.value = true; error.value = ''; message.value = ''
  try { await fn() } catch (e) { failure(e) } finally { busy.value = false }
}
async function refresh() {
  result.value = await api('/api/requests', { query: { search: search.value, status: status.value, categoryId: categoryId.value, page: page.value } })
  notifications.value = await api('/api/notifications')
  if (isAdmin.value) reports.value = await api('/api/reports')
}
async function initialize() {
  categories.value = await api('/api/categories')
  if (isAdmin.value) users.value = await api('/api/users')
  await refresh()
}
async function login() { await action(async () => { user.value = await api(`/api/auth/${register.value ? 'register' : 'login'}`, { method: 'POST', body: register.value ? auth : { email: auth.email, password: auth.password } }); auth.password = ''; await initialize() }) }
async function logout() { await action(async () => { await api('/api/auth/logout', { method: 'POST' }); user.value = null; selected.value = null; tab.value = 'requests'; notifications.value = []; users.value = []; result.value = { items: [], total: 0, page: 1, pages: 0 } }) }
async function changeTab(value: string) { tab.value = value; await action(async () => { await refresh(); if (value === 'audit') audit.value = await api('/api/audit'); if (value === 'notifications') { await api('/api/notifications', { method: 'PATCH' }); notifications.value = await api('/api/notifications') } }) }
function createRequest() { editing.value = ''; Object.assign(form, { title: '', description: '', location: '', categoryId: categories.value[0]?.id || '', priority: 'NORMAL', image: null }); showForm.value = true }
function editRequest() { editing.value = selected.value.id; Object.assign(form, selected.value); selected.value = null; showForm.value = true }
async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { error.value = 'Choose a PNG, JPEG or WebP smaller than 2 MB.'; return }
  const reader = new FileReader(); reader.onload = () => { form.image = String(reader.result) }; reader.readAsDataURL(file)
}
async function save() { await action(async () => { await api(editing.value ? `/api/requests/${editing.value}` : '/api/requests', { method: editing.value ? 'PATCH' : 'POST', body: form }); showForm.value = false; message.value = editing.value ? 'Request updated.' : 'Request submitted. You can track its progress here.'; page.value = 1; await refresh() }) }
async function openRequest(id: string) { await action(async () => { selected.value = await api(`/api/requests/${id}`); officerId.value = selected.value.assignments[0]?.officerId || ''; nextStatus.value = selected.value.status === 'ASSIGNED' ? 'IN_PROGRESS' : 'COMPLETED'; note.value = ''; deleting.value = false }) }
async function assign() { await action(async () => { await api(`/api/requests/${selected.value.id}/assign`, { method: 'POST', body: { officerId: officerId.value } }); await openRequest(selected.value.id); await refresh(); message.value = 'Officer assigned.' }) }
async function updateStatus() { await action(async () => { await api(`/api/requests/${selected.value.id}/status`, { method: 'PATCH', body: { status: nextStatus.value, note: note.value } }); await openRequest(selected.value.id); await refresh(); message.value = 'Status updated and requester notified.' }) }
async function remove() { await action(async () => { await api(`/api/requests/${selected.value.id}`, { method: 'DELETE' }); selected.value = null; message.value = 'Request deleted.'; await refresh() }) }
async function filter() { page.value = 1; await action(refresh) }
async function turnPage(amount: number) { page.value += amount; await action(refresh) }
async function updateUser(u: User) { await action(async () => { await api(`/api/users/${u.id}`, { method: 'PATCH', body: { roleId: u.roleId, active: u.active } }); message.value = 'User access saved.'; users.value = await api('/api/users') }) }
async function addCategory() { await action(async () => { await api('/api/categories', { method: 'POST', body: { name: newCategory.value } }); newCategory.value = ''; categories.value = await api('/api/categories'); message.value = 'Category added.' }) }
async function saveCategory(c: Category) { await action(async () => { await api(`/api/categories/${c.id}`, { method: 'PATCH', body: { name: c.name } }); message.value = 'Category saved.' }) }
async function deleteCategory(c: Category) { await action(async () => { await api(`/api/categories/${c.id}`, { method: 'DELETE' }); categories.value = await api('/api/categories'); message.value = 'Category deleted.' }) }
const date = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
let restoreFocus: HTMLElement | null = null
watch(() => showForm.value || Boolean(selected.value), async visible => {
  if (visible) {
    restoreFocus = document.activeElement as HTMLElement
    await nextTick()
    document.querySelector<HTMLElement>('[role=dialog] input, [role=dialog] button')?.focus()
  } else { await nextTick(); restoreFocus?.focus() }
})
function dialogKeys(event: KeyboardEvent) {
  if (!showForm.value && !selected.value) return
  if (event.key === 'Escape') { showForm.value = false; selected.value = null }
  if (event.key !== 'Tab') return
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[role=dialog] button:not(:disabled), [role=dialog] input:not(:disabled), [role=dialog] select:not(:disabled), [role=dialog] textarea:not(:disabled), [role=dialog] a[href]'))
  const first = nodes[0], last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
let polling: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  document.addEventListener('keydown', dialogKeys)
  try { user.value = await api('/api/auth/me'); await initialize() } catch {} finally { ready.value = true }
  polling = setInterval(async () => { if (user.value && !busy.value && !showForm.value && !selected.value) { try { await refresh() } catch {} } }, 15000)
})
onUnmounted(() => { clearInterval(polling); document.removeEventListener('keydown', dialogKeys) })
</script>

<template>
  <div v-if="!ready" class="boot" role="status">Loading CampusFix...</div>
  <div v-else-if="!user" class="auth-shell">
    <section class="auth-story">
      <a class="wordmark" href="/" aria-label="Campus Fix home">Campus Fix</a>
    </section>
    <main class="auth-panel"><div class="auth-card"><h2>{{ register ? 'Create your account' : 'Welcome back' }}</h2><p class="muted">{{ register ? 'Join your campus maintenance workspace.' : 'Sign in to keep your campus moving.' }}</p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <form @submit.prevent="login" class="form-stack">
        <label v-if="register">Full name<input v-model="auth.name" required minlength="2" maxlength="100" autocomplete="name"></label>
        <label>Email address<input v-model="auth.email" type="email" placeholder="you@university.edu" required autocomplete="username"></label>
        <label>Password<span class="password-field"><input v-model="auth.password" aria-label="Password" :aria-describedby="register ? 'password-help' : undefined" :type="showPassword ? 'text' : 'password'" minlength="12" maxlength="72" required :autocomplete="register ? 'new-password' : 'current-password'"><button type="button" class="password-toggle" :aria-label="showPassword ? 'Hide password' : 'Show password'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span><small v-if="register" id="password-help">At least 12 characters.</small></label>
        <label v-if="register">I am a<select v-model="auth.roleId"><option value="STUDENT">Student</option><option value="STAFF">Staff member</option></select></label>
        <button class="primary wide" :disabled="busy">{{ busy ? 'Please wait...' : register ? 'Create account' : 'Sign in' }} </button>
      </form>
      <p class="auth-switch">{{ register ? 'Already registered?' : 'New to CampusFix?' }} <button class="text-button" @click="register = !register; error = ''">{{ register ? 'Sign in' : 'Create an account' }}</button></p>
      
    </div></main>
    <p class="auth-credit">© 2026 · CampusFix</p>
  </div>
  <div v-else class="workspace">
    <aside class="sidebar" :inert="showForm || Boolean(selected)">
      <a href="/" class="wordmark">Campus Fix</a>
      
      
      <nav aria-label="Main navigation">
        <button :class="{ active: tab === 'requests' }" @click="changeTab('requests')"><UiIcon name="requests" />{{ isAdmin ? 'All requests' : requester ? 'My requests' : 'Assigned requests' }}</button>
        <button v-if="isAdmin" :class="{ active: tab === 'reports' }" @click="changeTab('reports')"><UiIcon name="reports" />Reports</button>
        <button :class="{ active: tab === 'notifications' }" @click="changeTab('notifications')"><UiIcon name="notifications" />Notifications<small v-if="unread">{{ unread }}</small></button>
        <template v-if="isAdmin"><button :class="{ active: tab === 'users' }" @click="changeTab('users')"><UiIcon name="people" />People & access</button><button :class="{ active: tab === 'categories' }" @click="changeTab('categories')"><UiIcon name="categories" />Categories</button><button :class="{ active: tab === 'audit' }" @click="changeTab('audit')"><UiIcon name="activity" />Activity log</button></template>
      </nav>
      <div class="sidebar-bottom"><div class="profile"><span class="avatar">{{ user.name.slice(0,1) }}</span><div>{{ user.name }}<small>{{ roleName }}</small></div></div><button class="signout" @click="logout">Sign out <span aria-hidden="true">↗</span></button></div>
    </aside>
    <div class="main-shell" :inert="showForm || Boolean(selected)">
      <header class="topbar"><span>Workspace <span class="slash">/</span> {{ tab === 'requests' ? 'Service requests' : tab.replaceAll('_',' ') }}</span><div><span class="top-avatar">{{ user.name.slice(0,1) }}</span></div></header>
      <main id="main-content" class="content">
        <div class="page-heading"><div><p class="eyebrow">{{ roleName?.toUpperCase() }} WORKSPACE</p><h1>{{ ({requests: isAdmin ? 'Campus overview' : requester ? 'My service requests' : 'Your maintenance queue',reports:'Maintenance reports',users:'People & access',categories:'Request categories',notifications:'Your notifications',audit:'Activity log'} as any)[tab] }}</h1><p class="muted">{{ tab === 'requests' ? 'A clear view of what needs attention and what is getting done.' : 'Keep your campus maintenance work in view.' }}</p></div><button v-if="requester && tab === 'requests'" class="primary" @click="createRequest"><span aria-hidden="true">+</span> New request</button><a v-if="isAdmin && tab === 'reports'" class="primary" href="/api/reports/export">Export CSV <span aria-hidden="true">↓</span></a></div>
        <p v-if="error" class="error" role="alert">{{ error }} <button class="text-button" @click="error = ''">Dismiss</button></p><p v-if="message" role="status" class="success">{{ message }}</p>
        <template v-if="tab === 'requests'">
          <div v-if="isAdmin && reports" class="metrics"><div><span>Total requests</span><strong>{{ reports.total }}</strong><small>Across the campus</small></div><div><span>Needs attention</span><strong>{{ reports.byStatus.OPEN }}</strong><small>Awaiting assignment</small></div><div><span>In progress</span><strong>{{ reports.byStatus.IN_PROGRESS + reports.byStatus.ASSIGNED }}</strong><small>With maintenance team</small></div><div><span>Completed</span><strong class="green-number">{{ reports.byStatus.COMPLETED }}</strong><small>Resolved requests</small></div></div>
          <section class="request-panel"><div class="panel-title"><div><h2>{{ isAdmin ? 'Service requests' : 'Request tracker' }} <span class="count">{{ result.total }}</span></h2><p>Follow every request, from first report to final fix.</p></div><span class="refresh-label">Updates every 15s</span></div>
            <form class="filters" @submit.prevent="filter"><label class="search-label"><span class="sr-only">Search requests</span><input v-model="search" placeholder="Search requests or locations..."></label><label><span class="sr-only">Filter status</span><select v-model="status" @change="filter"><option value="">All statuses</option><option v-for="s in ['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED']" :key="s" :value="s">{{ s.replaceAll('_',' ') }}</option></select></label><label><span class="sr-only">Filter category</span><select v-model="categoryId" @change="filter"><option value="">All categories</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></label><button class="secondary" :disabled="busy">Search</button></form>
            <div class="table-scroll"><table><thead><tr><th>REQUEST</th><th>CATEGORY / LOCATION</th><th>STATUS</th><th>PRIORITY</th><th>REPORTED</th><th><span class="sr-only">Action</span></th></tr></thead><tbody><tr v-for="r in result.items" :key="r.id"><td><button class="request-title" @click="openRequest(r.id)">{{ r.title }}</button><small class="request-id">CF-{{ r.id.slice(-6).toUpperCase() }} <span v-if="isAdmin">· {{ r.owner.name }}</span></small></td><td>{{ r.category.name }}<small>{{ r.location }}</small></td><td><StatusBadge :status="r.status" /></td><td><span class="priority" :class="r.priority.toLowerCase()">{{ r.priority === 'HIGH' ? '↑ ' : '' }}{{ r.priority.toLowerCase() }}</span></td><td class="date-cell">{{ date(r.createdAt) }}</td><td><button class="row-open" :aria-label="`Open ${r.title}`" @click="openRequest(r.id)">↗</button></td></tr></tbody></table></div>
            <div v-if="!result.items.length" class="empty"><h3>{{ search || status || categoryId ? 'No matching requests' : 'Your next campus fix starts here' }}</h3><p>{{ requester ? 'Submit a request or change your filters to see more.' : 'There are no requests in this view. Try a different filter.' }}</p></div>
            <div class="pagination"><span>{{ result.total }} requests · Page {{ page }} of {{ Math.max(1,result.pages) }}</span><div><button class="secondary" :disabled="page <= 1 || busy" @click="turnPage(-1)">← Previous</button><button class="secondary" :disabled="page >= result.pages || busy" @click="turnPage(1)">Next →</button></div></div>
          </section><div class="bottom-note"><span class="care-dot" /><span>{{ requester ? 'Your reports help keep shared spaces safe and ready to use.' : 'Every resolved request means a better day on campus.' }}</span><span class="muted">CampusFix / Service desk</span></div>
        </template>
        <section v-if="tab === 'reports' && reports" class="report-grid"><div class="card"><h2>Requests by status</h2><div v-for="(count,s) in reports.byStatus" :key="s" class="chart-row"><div><StatusBadge :status="String(s)" /><strong>{{ count }}</strong></div><div class="bar-track"><span :style="{ width: `${Number(count)/Math.max(1,reports.total)*100}%` }" /></div></div></div><div class="card"><h2>Requests by category</h2><div v-for="c in reports.byCategory" :key="c.name" class="chart-row"><div><span>{{ c.name }}</span><strong>{{ c.count }}</strong></div><div class="bar-track"><span :style="{ width: `${c.count/Math.max(1,reports.total)*100}%` }" /></div></div></div><div class="card full"><p class="muted">Average resolution time</p><h2>{{ reports.averageResolutionHours === null ? 'No completed requests yet' : `${reports.averageResolutionHours} hours` }}</h2><p>Elapsed time between creation and the last update for completed requests. Seed data is demonstration data.</p></div></section>
        <section v-if="tab === 'users'" class="card"><h2>Campus users</h2><p class="muted">Save changes to apply roles or disable sign-in. Your own access is protected.</p><div v-for="u in users" :key="u.id" class="user-row"><div><strong>{{ u.name }}</strong><small>{{ u.email }}</small></div><label><span class="sr-only">Role for {{ u.name }}</span><select v-model="u.roleId" :disabled="u.id === user.id"><option v-for="r in ['STUDENT','STAFF','OFFICER','ADMIN']" :key="r">{{ r }}</option></select></label><label class="inline-label"><input v-model="u.active" type="checkbox" :disabled="u.id === user.id">Active</label><button class="secondary" :disabled="u.id === user.id || busy" @click="updateUser(u)">Save</button></div></section>
        <section v-if="tab === 'categories'" class="card"><h2>Categories</h2><form class="category-form" @submit.prevent="addCategory"><label>New category<input v-model="newCategory" required minlength="2" maxlength="80"></label><button class="primary" :disabled="busy">Add category</button></form><div v-for="c in categories" :key="c.id" class="category-row"><label><span class="sr-only">Category name</span><input v-model="c.name" required></label><button class="secondary" :disabled="busy" @click="saveCategory(c)">Save</button><button class="text-button danger" :disabled="busy" @click="deleteCategory(c)">Delete</button></div><p class="muted">Categories in use cannot be deleted.</p></section>
        <section v-if="tab === 'notifications'" class="card"><h2>Updates for you</h2><div v-for="n in notifications" :key="n.id" class="notification"><span class="care-dot" /><div>{{ n.message }}<small>{{ date(n.createdAt) }}</small></div></div><div v-if="!notifications.length" class="empty"><h3>You're all caught up</h3><p>Assignments and status updates will appear here.</p></div></section>
        <section v-if="tab === 'audit'" class="card"><h2>Latest 100 actions</h2><div v-for="a in audit" :key="a.id" class="audit-row"><code>{{ a.action }}</code><span>{{ a.target }}</span><small>{{ date(a.createdAt) }}</small></div><p v-if="!audit.length" class="muted">Actions will appear after changes are made.</p></section>
      </main><footer class="workspace-footer">CampusFix <span>Built for a campus that cares.</span></footer>
    </div>
    <div v-if="showForm" class="overlay" @click.self="showForm = false"><section role="dialog" aria-modal="true" aria-labelledby="form-title" class="modal"><button class="close" aria-label="Close form" @click="showForm = false">×</button><p class="eyebrow">LET'S GET IT FIXED</p><h2 id="form-title">{{ editing ? 'Edit your request' : 'New service request' }}</h2><p class="muted">Tell the maintenance team what needs attention.</p><p v-if="error" role="alert" class="error">{{ error }}</p><form class="form-stack" @submit.prevent="save"><label>Request title<input v-model="form.title" autofocus required minlength="5" maxlength="160" placeholder="e.g. Leaking tap in science laboratory"></label><div class="form-two"><label>Category<select v-model="form.categoryId" required><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></label><label>Priority<select v-model="form.priority"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option></select></label></div><label>Location<input v-model="form.location" required minlength="3" maxlength="200" placeholder="Building, floor and room"></label><label>What happened?<textarea v-model="form.description" required minlength="15" maxlength="3000" rows="4" placeholder="Describe the fault and how it affects the space."></textarea></label><label v-if="!editing">Photo evidence (optional)<input type="file" accept="image/png,image/jpeg,image/webp" @change="upload"><small>PNG, JPEG or WebP, up to 2 MB.</small></label><img v-if="form.image" :src="form.image" alt="Fault evidence preview" class="evidence"><div class="modal-actions"><button type="button" class="secondary" @click="showForm = false">Cancel</button><button class="primary" :disabled="busy">{{ busy ? 'Saving...' : editing ? 'Save changes' : 'Submit request' }}</button></div></form></section></div>
    <div v-if="selected" class="overlay" @click.self="selected = null"><section role="dialog" aria-modal="true" aria-labelledby="detail-title" class="modal detail"><button class="close" aria-label="Close request" @click="selected = null">×</button><p class="eyebrow">CF-{{ selected.id.slice(-6).toUpperCase() }}</p><h2 id="detail-title">{{ selected.title }}</h2><StatusBadge :status="selected.status" /><p v-if="error" role="alert" class="error">{{ error }}</p><p class="detail-description">{{ selected.description }}</p><div class="detail-meta"><p><small>LOCATION</small>{{ selected.location }}</p><p><small>CATEGORY</small>{{ selected.category.name }}</p><p><small>REPORTED BY</small>{{ selected.owner.name }}</p><p><small>ASSIGNED TO</small>{{ selected.assignments[0]?.officer.name || 'Awaiting assignment' }}</p></div><img v-if="selected.image" :src="selected.image" alt="Uploaded fault evidence" class="evidence">
      <form v-if="isAdmin && !['COMPLETED','CANCELLED'].includes(selected.status)" class="action-form" @submit.prevent="assign"><label>Assign maintenance officer<select v-model="officerId" required><option value="">Choose an officer</option><option v-for="o in officers" :key="o.id" :value="o.id">{{ o.name }}</option></select></label><button class="primary" :disabled="busy">Assign</button></form>
      <form v-if="['ADMIN','OFFICER'].includes(user.roleId) && !['COMPLETED','CANCELLED'].includes(selected.status)" class="form-stack status-form" @submit.prevent="updateStatus"><label>Update status<select v-model="nextStatus" required><option v-if="selected.status === 'ASSIGNED'" value="IN_PROGRESS">In progress</option><option v-if="selected.status === 'IN_PROGRESS'" value="COMPLETED">Completed</option><option v-if="isAdmin" value="CANCELLED">Cancelled</option></select></label><label>Progress note<textarea v-model="note" minlength="5" maxlength="1000" required rows="2"></textarea></label><button class="primary" :disabled="busy">Update progress</button></form>
      <h3 class="timeline-heading">Request timeline</h3><ol class="timeline"><li v-for="log in selected.logs" :key="log.id"><div class="timeline-dot" /><div><strong>{{ log.status.replaceAll('_',' ') }}</strong><p>{{ log.note }}</p><small>{{ log.actor.name }} · {{ date(log.createdAt) }}</small></div></li></ol><div class="modal-actions"><button v-if="selected.ownerId === user.id && selected.status === 'OPEN'" class="secondary" @click="editRequest">Edit request</button><template v-if="isAdmin || (selected.ownerId === user.id && selected.status === 'OPEN')"><button v-if="!deleting" class="text-button danger" @click="deleting = true">Delete request</button><button v-else class="danger-button" :disabled="busy" @click="remove">Confirm permanent deletion</button></template></div>
    </section></div>
  </div>
</template>
