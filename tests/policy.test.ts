import { describe, it, expect } from 'vitest'
import { canRead, validTransition, safeCsv } from '../server/utils/policy'
describe('backend authorization rules', () => {
  const request = { ownerId: 'student', assignments: [{ officerId: 'officer' }] }
  it('allows the owner and administrator', () => { expect(canRead({ id: 'student', roleId: 'STUDENT' }, request)).toBe(true); expect(canRead({ id: 'admin', roleId: 'ADMIN' }, request)).toBe(true) })
  it('blocks unrelated students and staff', () => { for (const roleId of ['STUDENT','STAFF']) expect(canRead({ id: 'other', roleId },request)).toBe(false) })
  it('allows only the assigned officer', () => { expect(canRead({ id: 'officer', roleId: 'OFFICER' },request)).toBe(true); expect(canRead({ id: 'other', roleId: 'OFFICER' },request)).toBe(false) })
  it('requires an ordered resolution workflow', () => { expect(validTransition('OPEN','COMPLETED')).toBe(false); expect(validTransition('ASSIGNED','IN_PROGRESS')).toBe(true); expect(validTransition('IN_PROGRESS','COMPLETED')).toBe(true); expect(validTransition('COMPLETED','OPEN')).toBe(false) })
  it('escapes CSV formulas and embedded quotes', () => { expect(safeCsv('=1+1')).toBe('"\'=1+1"'); expect(safeCsv('pipe "A"')).toBe('"pipe ""A"""') })
})
