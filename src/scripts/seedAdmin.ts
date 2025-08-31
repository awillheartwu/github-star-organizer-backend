import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

async function main() {
  const prisma = new PrismaClient()
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123456'
  const exists = await prisma.user.findUnique({ where: { email } })
  if (!exists) {
    const passwordHash = await argon2.hash(password)
    await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN', displayName: 'Admin' } })
    console.log('Admin seeded:', email)
  } else {
    console.log('Admin already exists:', email)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
