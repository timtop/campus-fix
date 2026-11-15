const iterations = 100000
const hex = (a: ArrayBuffer) => Array.from(new Uint8Array(a), b => b.toString(16).padStart(2,'0')).join('')
async function derive(password: string, salt: Uint8Array, pepper: string) {
  if(pepper.length<32)throw new Error('Password pepper is not configured')
  const hmac = await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const input = await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(password))
  const key = await crypto.subtle.importKey('raw',input,'PBKDF2',false,['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name:'PBKDF2',salt:salt as BufferSource,iterations,hash:'SHA-256' },key,256))
}
export async function hashPassword(password: string, pepper: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2-peppered$${iterations}$${hex(salt.buffer)}$${await derive(password,salt,pepper)}`
}
export async function checkPassword(password: string, stored: string, pepper: string) {
  const [algorithm,count,salt,expected] = stored.split('$')
  if(algorithm!=='pbkdf2-peppered'||Number(count)!==iterations||!salt||!expected||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return false
  const actual=await derive(password,new Uint8Array(salt.match(/../g)!.map(v=>parseInt(v,16))),pepper)
  let difference=0
  for(let i=0;i<expected.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i)
  return difference===0
}
