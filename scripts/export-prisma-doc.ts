/// <reference types="node" />
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

type Model = {
  name: string
  doc?: string
  fields: Array<{ name: string; type: string; attrs: string[]; doc?: string }>
}
type Enum = { name: string; doc?: string; values: Array<{ name: string; doc?: string }> }

function parsePrismaSchema(text: string) {
  const lines = text.split(/\r?\n/)
  const models: Model[] = []
  const enums: Enum[] = []
  const peekDoc = (i: number) => {
    const docs: string[] = []
    let j = i - 1
    while (j >= 0 && lines[j].trim().startsWith('///')) {
      docs.unshift(
        lines[j]
          .trim()
          .replace(/^\/\/\//, '')
          .trim()
      )
      j--
    }
    const joined = docs.join(' ')
    return joined || undefined
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('model ')) {
      const name = line.split(/\s+/)[1]
      const doc = peekDoc(i)
      const fields: Model['fields'] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('}')) {
        const l = lines[i]
        const t = l.trim()
        if (!t || t.startsWith('//')) {
          i++
          continue
        }
        // skip model-level attributes like @@index/@@id
        if (t.startsWith('@@')) {
          i++
          continue
        }
        // field line: name type attrs... // comment
        const fldDoc = peekDoc(i)
        const comment = t.split('//')[1]?.trim()
        const left = t.split('//')[0]!.trim()
        const parts = left.split(/\s+/)
        const fname = parts[0]
        const ftype = parts[1]
        const attrs = parts.slice(2)
        const mergedDoc = [fldDoc, comment].filter(Boolean).join(' ')
        fields.push({ name: fname, type: ftype, attrs, doc: mergedDoc || undefined })
        i++
      }
      models.push({ name, doc, fields })
    } else if (line.startsWith('enum ')) {
      const name = line.split(/\s+/)[1]
      const doc = peekDoc(i)
      const values: Enum['values'] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('}')) {
        const l = lines[i]
        const t = l.trim()
        if (!t || t.startsWith('//')) {
          i++
          continue
        }
        const val = t.split('//')[0]!.trim()
        const c = t.split('//')[1]?.trim()
        if (val) values.push({ name: val, doc: c })
        i++
      }
      enums.push({ name, doc, values })
    }
  }
  return { models, enums }
}

function toMarkdown(models: Model[], enums: Enum[]) {
  const md: string[] = []
  md.push('# Prisma Schema Documentation\n')
  if (enums.length) {
    md.push('## Enums')
    for (const e of enums) {
      md.push(`### ${e.name}`)
      if (e.doc) md.push(e.doc)
      md.push('Values:')
      for (const v of e.values) {
        md.push(`- ${v.name}${v.doc ? ` — ${v.doc}` : ''}`)
      }
      md.push('')
    }
  }
  if (models.length) {
    md.push('## Models')
    for (const m of models) {
      md.push(`### ${m.name}`)
      if (m.doc) md.push(m.doc)
      md.push('| Field | Type | Attributes | Description |')
      md.push('|------|------|------------|-------------|')
      for (const f of m.fields) {
        md.push(`| ${f.name} | ${f.type} | ${f.attrs.join(' ')} | ${f.doc ?? ''} |`)
      }
      md.push('')
    }
  }
  return md.join('\n')
}

function main() {
  const file = resolve(process.cwd(), 'prisma', 'schema.prisma')
  const text = readFileSync(file, 'utf8')
  const { models, enums } = parsePrismaSchema(text)
  const md = toMarkdown(models, enums)
  const docsDir = resolve(process.cwd(), 'docs')
  mkdirSync(docsDir, { recursive: true })
  const out = resolve(docsDir, 'prisma.md')
  writeFileSync(out, md, 'utf8')
  // eslint-disable-next-line no-console
  console.log('Prisma docs written to', out)
}

main()
