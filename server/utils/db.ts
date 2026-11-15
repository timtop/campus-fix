import { PrismaClient } from '@prisma/client'
const globalDb = globalThis as unknown as { campusDb?: PrismaClient }
export const db = globalDb.campusDb || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalDb.campusDb = db
