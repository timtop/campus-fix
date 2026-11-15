import { existsSync, mkdirSync, closeSync, openSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const url = process.env.DATABASE_URL
if (!url?.startsWith('file:')) throw new Error('DATABASE_URL must be a SQLite file URL')
const path = url.slice(5)
const target = isAbsolute(path) ? path : resolve('prisma', path)
mkdirSync(dirname(target), { recursive: true })
if (!existsSync(target)) closeSync(openSync(target, 'wx'))
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env })
process.exit(result.status ?? 1)
