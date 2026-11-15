import { describe,it,expect } from 'vitest'
import { hashPassword,checkPassword } from '../server/utils/password'
const pepper='local-test-pepper-longer-than-thirty-two-characters'
describe('Cloudflare password hashing',()=>{
 it('uses random salts and rejects the wrong password',async()=>{
  const a=await hashPassword('CampusFix-Test-Password',pepper),b=await hashPassword('CampusFix-Test-Password',pepper)
  expect(a).not.toBe(b);expect(await checkPassword('CampusFix-Test-Password',a,pepper+'wrong')).toBe(false);expect(await checkPassword('CampusFix-Test-Password',a,pepper)).toBe(true);expect(await checkPassword('Wrong-Test-Password',a,pepper)).toBe(false)
 })
 it('rejects malformed stored hashes',async()=>{expect(await checkPassword('test','pbkdf2$0$bad$bad',pepper)).toBe(false)})
})
