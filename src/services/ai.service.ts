// src/services/ai.service.ts
import type { Ctx } from '../helpers/context.helper'
import { generateWithProvider, type AiClientOptions } from './ai.client'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'

export async function summarizeProject(
  ctx: Ctx,
  projectId: string,
  options: AiClientOptions & {
    style?: 'short' | 'long' | 'both'
    lang?: 'zh' | 'en'
    createTags?: boolean
    includeReadme?: boolean
    readmeMaxChars?: number
  } = {}
) {
  const project = await ctx.prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.archived) {
    throw new AppError(
      'Project not found or archived',
      HTTP_STATUS.NOT_FOUND.statusCode,
      ERROR_TYPES.NOT_FOUND
    )
  }

  const style = options.style || 'both'
  // 准备 README 片段（可选，带缓存与软失败）
  const includeReadme = options.includeReadme ?? true
  let readmeExcerpt: string | undefined
  if (includeReadme && project.fullName) {
    const raw = await getReadmeWithCache(ctx, project.fullName).catch(() => '')
    if (raw) {
      const maxChars = Math.max(500, options.readmeMaxChars ?? 4000)
      readmeExcerpt = stripAndTrimReadme(raw).slice(0, maxChars)
    }
  }

  const prompt = buildPrompt(
    {
      name: project.name,
      fullName: project.fullName ?? '',
      url: project.url,
      description: project.description || '',
      language: project.language || '',
      stars: project.stars,
      forks: project.forks,
    },
    options.lang || 'zh',
    style,
    readmeExcerpt
  )

  const completion = await generateWithProvider(ctx.config, prompt, options)
  const parsed = safeParseJson(completion.content)
  if (!parsed || typeof parsed !== 'object') {
    throw new AppError('AI response is not valid JSON', 502, ERROR_TYPES.INTERNAL)
  }

  const shortText = typeof parsed.short === 'string' ? parsed.short : undefined
  const longText = typeof parsed.long === 'string' ? parsed.long : undefined
  const tagNames: string[] = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t)).filter(Boolean)
    : []

  await insertHistory(
    ctx,
    projectId,
    shortText,
    longText,
    completion.model,
    options.lang,
    completion.usage?.totalTokens
  )

  let created: string[] = []
  let linked: string[] = []
  if ((options.createTags ?? true) && tagNames.length) {
    const res = await attachTags(ctx, projectId, tagNames)
    created = res.created
    linked = res.linked
  }

  // 更新 Project 上的最新摘要字段（不看 style，有就写）
  try {
    const patch: Record<string, unknown> = {}
    if (shortText) patch['summaryShort'] = shortText
    if (longText) patch['summaryLong'] = longText
    if (Object.keys(patch).length) {
      await ctx.prisma.project.update({ where: { id: projectId }, data: patch })
    }
  } catch (e) {
    ctx.log.warn({ e }, '[ai] update latest summaries on project failed')
  }

  return {
    summaryShort: shortText,
    summaryLong: longText,
    model: completion.model,
    lang: options.lang || 'zh',
    tagsCreated: created,
    tagsLinked: linked,
  }
}

type ProjectContext = {
  name: string
  fullName?: string
  url: string
  description: string
  language?: string
  stars: number
  forks: number
}

function buildPrompt(
  ctx: ProjectContext,
  lang: 'zh' | 'en',
  style: string,
  readmeExcerpt?: string
) {
  const onlyJson =
    lang === 'zh'
      ? '严格只输出 JSON，不要解释，不要包含 Markdown 代码块或额外文本。'
      : 'Output strictly JSON only. No explanations, no markdown fences.'
  const shortRule =
    lang === 'zh'
      ? 'short ≤ 120字，简练、可读、面向开发者'
      : 'short ≤ 200 chars, concise, developer‑oriented'
  const longRule =
    lang === 'zh'
      ? 'long 300–600字，涵盖定位、核心特性、适用场景、对比与限制'
      : 'long 300–600 chars, include purpose, key features, scenarios, trade‑offs'

  const tagRule =
    'tags 3–7 个，全部小写，单词或短横线（kebab-case），去除通用词（project, repo, awesome, example），尽量来自领域与技术栈，如: web, api, cli, react, vue, ssg, orm, auth, caching, testing, tooling, devops, database'

  const schema = '{ "short": string, "long": string, "tags": string[] }'
  const must = `必须包含全部字段，且是合法 JSON：${schema}`

  const need = `需要的样式: ${style}`

  const context = JSON.stringify(
    {
      name: ctx.name,
      fullName: ctx.fullName,
      url: ctx.url,
      description: ctx.description,
      language: ctx.language,
      stars: ctx.stars,
      forks: ctx.forks,
    },
    null,
    2
  )

  const example =
    lang === 'zh'
      ? '{"short":"……","long":"……","tags":["react","ssg","tooling"]}'
      : '{"short":"…","long":"…","tags":["react","ssg","tooling"]}'

  const parts = [
    `[instruction] ${onlyJson}`,
    `[language] ${lang}`,
    `[length] ${shortRule}; ${longRule}`,
    `[tags] ${tagRule}`,
    `[format] ${must}`,
    `[need] ${need}`,
    `[context]
${context}`,
  ] as string[]
  if (readmeExcerpt) {
    parts.push(`[readme_excerpt]\n${readmeExcerpt}`)
  }
  parts.push(`[example]\n${example}`)
  return parts.join('\n\n')
}

type AiSummaryPayload = { short?: unknown; long?: unknown; tags?: unknown }

// 尝试从模型返回的文本中解析出 JSON：
// 1) 直接 JSON.parse
// 2) 去掉 ```json\n...``` 栅栏后再 parse
// 3) 从文本中提取首个平衡的大括号 JSON 对象再 parse（容错）
function safeParseJson(text: string): AiSummaryPayload | null {
  const direct = tryJson(text)
  if (direct) return direct

  // strip markdown fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    const fromFence = tryJson(fenced[1])
    if (fromFence) return fromFence
  }

  const extracted = extractFirstJsonObject(text)
  if (extracted) {
    const fromExtract = tryJson(extracted)
    if (fromExtract) return fromExtract
  }
  return null
}

function tryJson(s: string): AiSummaryPayload | null {
  try {
    // 移除 BOM 与前后空白
    const clean = s.replace(/^\uFEFF/, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

// 从给定文本中提取首个平衡的 JSON 对象（不处理数组/复杂场景，但足够应对常见包裹输出）
function extractFirstJsonObject(s: string): string | null {
  const i = s.indexOf('{')
  if (i === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let j = i; j < s.length; j++) {
    const ch = s[j]
    if (inStr) {
      if (esc) {
        esc = false
      } else if (ch === '\\') {
        esc = true
      } else if (ch === '"') {
        inStr = false
      }
    } else {
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          return s.slice(i, j + 1)
        }
      }
    }
  }
  return null
}

async function insertHistory(
  ctx: Ctx,
  projectId: string,
  shortText?: string,
  longText?: string,
  model?: string,
  lang?: string,
  totalTokens?: number
) {
  const rows: Array<{ style: 'short' | 'long'; content: string }> = []
  if (shortText) rows.push({ style: 'short', content: shortText })
  if (longText) rows.push({ style: 'long', content: longText })
  if (!rows.length) return

  // 使用 Prisma ORM 安全写入，并记录 tokens（总 tokens）
  await ctx.prisma.aiSummary.createMany({
    data: rows.map((r) => ({
      projectId,
      style: r.style,
      content: r.content,
      model: model ?? null,
      lang: lang ?? null,
      tokens: typeof totalTokens === 'number' ? Math.max(0, Math.floor(totalTokens)) : null,
      createdAt: new Date(),
    })),
  })
}

async function attachTags(ctx: Ctx, projectId: string, names: string[]) {
  const cleaned = Array.from(
    new Set(names.map((s) => s.trim().toLowerCase()).filter((s) => s && s.length <= 32))
  )
  if (!cleaned.length) return { created: [], linked: [] }

  const existed = await ctx.prisma.tag.findMany({
    where: { name: { in: cleaned }, archived: false },
  })
  const existedNames = new Set(existed.map((t) => t.name))
  const toCreate = cleaned.filter((n) => !existedNames.has(n))
  let created: { id: string; name: string }[] = []
  if (toCreate.length) {
    created = await ctx.prisma.tag.createManyAndReturn({ data: toCreate.map((n) => ({ name: n })) })
  }
  const all = [...existed, ...created]
  // 仅为缺失的关联创建，避免重复键冲突
  if (all.length) {
    const allIds = all.map((t) => t.id)
    const linkedRows = await ctx.prisma.projectTag.findMany({
      where: { projectId, tagId: { in: allIds } },
      select: { tagId: true },
    })
    const already = new Set(linkedRows.map((r) => r.tagId))
    const toLink = all.filter((t) => !already.has(t.id))
    if (toLink.length) {
      await ctx.prisma.projectTag.createMany({
        data: toLink.map((t) => ({ projectId, tagId: t.id })),
      })
    }
  }
  return { created: toCreate, linked: cleaned }
}

// —— GitHub README 获取（带缓存） —— //
async function getReadmeWithCache(ctx: Ctx, fullName: string): Promise<string> {
  const cacheKey = `gh:readme:${fullName}`
  try {
    const cached = await ctx.redis.get(cacheKey)
    if (cached) return cached
  } catch {
    // ignore cache errors
  }
  const text = await fetchReadmeRaw(ctx, fullName).catch(() => '')
  if (text) {
    try {
      // 缓存 6 小时
      await ctx.redis.set(cacheKey, text, 'EX', 6 * 3600)
    } catch {
      // ignore
    }
  }
  return text
}

async function fetchReadmeRaw(ctx: Ctx, fullName: string): Promise<string> {
  // 单元测试环境下跳过外部依赖，避免引入 ESM 模块/网络请求
  if (process.env.NODE_ENV === 'test') return ''
  const mod = await import('./github/github.client')
  return mod.getRepoReadmeRawByFullName(ctx, fullName)
}

function stripAndTrimReadme(md: string): string {
  // remove code fences
  let s = md.replace(/```[\s\S]*?```/g, '')
  // remove html tags
  s = s.replace(/<[^>]+>/g, '')
  // images ![alt](url)
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  // links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  // headers ###, **bold**, inline code
  s = s.replace(/^#+\s*/gm, '')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/`([^`]+)`/g, '$1')
  // collapse whitespace
  s = s.replace(/\r?\n\s*\r?\n+/g, '\n')
  s = s.replace(/[\t ]+/g, ' ')
  return s.trim()
}
