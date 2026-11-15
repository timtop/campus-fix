export const statuses = ['OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'] as const
export function canRead(user: { id: string; roleId: string }, request: { ownerId: string; assignments: { officerId: string }[] }) {
  return user.roleId === 'ADMIN' || request.ownerId === user.id || (user.roleId === 'OFFICER' && request.assignments.some(a => a.officerId === user.id))
}
export function validTransition(from: string, to: string) {
  return ({ OPEN: ['ASSIGNED','CANCELLED'], ASSIGNED: ['IN_PROGRESS','CANCELLED'], IN_PROGRESS: ['COMPLETED','CANCELLED'], COMPLETED: [], CANCELLED: [] } as Record<string,string[]>)[from]?.includes(to) ?? false
}
export function safeCsv(value: unknown) {
  const s = String(value ?? '')
  return '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"','""') + '"'
}
