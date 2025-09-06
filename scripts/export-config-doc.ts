/// <reference types="node" />
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { EnvSchema, AppConfigSchema } from '../src/config/loadConfig.config'

type PropertySchema = {
  type?: string | string[]
  default?: unknown
  description?: string
  oneOf?: unknown
}
type JsonSchema = { properties?: Record<string, PropertySchema>; required?: string[] }

function toTable(title: string, schema: JsonSchema) {
  const lines: string[] = []
  lines.push(`## ${title}`)
  lines.push('| Key | Type | Required | Default | Description |')
  lines.push('|-----|------|----------|---------|-------------|')
  const props = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  for (const [k, v] of Object.entries(props)) {
    const t = Array.isArray(v?.type)
      ? v.type.join('|')
      : v?.type || (v?.oneOf ? 'union' : 'unknown')
    const def = v?.default !== undefined ? String(v.default) : ''
    const desc = v?.description ? String(v.description) : ''
    lines.push(`| ${k} | ${t} | ${required.has(k) ? 'yes' : 'no'} | ${def} | ${desc} |`)
  }
  lines.push('')
  return lines.join('\n')
}

function main() {
  const docsDir = resolve(process.cwd(), 'docs')
  mkdirSync(docsDir, { recursive: true })
  const out = resolve(docsDir, 'config.md')
  const md: string[] = []
  md.push('# Runtime Configuration')
  md.push('本文档根据 TypeBox Schema 自动生成，包含环境变量与应用配置的键、类型与默认值。')
  md.push('')
  md.push(toTable('Environment Variables (EnvSchema)', EnvSchema as unknown as JsonSchema))
  md.push(toTable('App Config Shape (AppConfigSchema)', AppConfigSchema as unknown as JsonSchema))
  writeFileSync(out, md.join('\n'), 'utf8')
  // eslint-disable-next-line no-console
  console.log('Config docs written to', out)
}

main()
