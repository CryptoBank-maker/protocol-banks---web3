import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

/**
 * Resolve connection string for the pg adapter.
 * prisma+postgres:// URLs (from `prisma dev`) embed the real DB URL
 * in a base64 API key. Extract it so pg.Pool can connect directly.
 */
function resolveConnectionString(): string {
  if (process.env.DIRECT_DATABASE_URL) {
    return process.env.DIRECT_DATABASE_URL
  }

  const url = process.env.DATABASE_URL || ''

  if (url.startsWith('prisma+postgres://')) {
    try {
      const parsed = new URL(url)
      const apiKey = parsed.searchParams.get('api_key')
      if (apiKey) {
        const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'))
        if (decoded.databaseUrl) {
          return decoded.databaseUrl
        }
      }
    } catch {
      // fall through
    }
  }

  return url
}

const prismaClientSingleton = () => {
  const connectionString = resolveConnectionString()
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
