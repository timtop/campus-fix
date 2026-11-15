import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
const file='.dev.vars'
const text=existsSync(file)?readFileSync(file,'utf8'):''
if(!/^PASSWORD_PEPPER=.+$/m.test(text)){
 const line='PASSWORD_PEPPER='+randomBytes(32).toString('base64url')+'\n'
 if(text)appendFileSync(file,'\n'+line,{mode:0o600});else writeFileSync(file,line,{mode:0o600})
}
console.log('Local password secret is configured in .dev.vars (not printed).')
