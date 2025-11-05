import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function sanitizeJsonString(raw: string) {
  const withoutBackslash = raw.replace(/\\/g, '')
  return withoutBackslash.replace(/"/g, '\\"')
}

async function main() {
  const rows = await prisma.syncState.findMany({
    where: { statsJson: { not: null } },
    select: { source: true, key: true, statsJson: true },
  })
  let updated = 0

  for (const row of rows) {
    const current = row.statsJson
    if (!current) continue
    const sanitized = sanitizeJsonString(current)
    if (sanitized === current) continue
    const truncated = sanitized.length > 4096 ? sanitized.slice(0, 4096) : sanitized
    await prisma.syncState.update({
      where: { source_key: { source: row.source, key: row.key } },
      data: { statsJson: truncated },
    })
    updated += 1
  }

  console.log(`Processed ${rows.length} rows, updated ${updated} records.`)
}

main()
  .catch((error) => {
    console.error('Failed to sanitize statsJson', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
