// src/services/ai.client.ts
import type { AppConfig } from '../config'

/**
 * AI 响应的通用结构（对上层仅暴露结构化文本与用量信息）。
 * @category AI
 */
export type AiCompletion = {
  content: string
  model?: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

/**
 * AI 客户端调用选项。
 * - structured: 启用结构化输出（优先 function-call，失败回退 response_format）
 * - jsonSchema: 结构化输出所遵循的 JSON Schema
 * - functionName: function-call 的函数名
 * @category AI
 */
export interface AiClientOptions {
  model?: string
  temperature?: number
  // structured output preferences (best-effort)
  structured?: boolean
  jsonSchema?: Record<string, unknown>
  functionName?: string
}

type ToolCall = { type?: string; function?: { name?: string; arguments?: string } }
type ChatMessage = { content?: string; tool_calls?: ToolCall[] }
type DeepSeekResponse = {
  choices?: Array<{ message?: ChatMessage }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  error?: { message?: string }
  message?: string
}

/**
 * 调用真实 AI Provider（当前实现 DeepSeek Chat Completions）。
 *
 * 行为说明：
 * 1. 当 opts.structured = true 时，优先走 tools/function 调用；若 4xx 失败，则回退到 response_format: json_object。
 * 2. 两者都失败时，按 429/5xx 做指数退避重试，最终抛错。
 * 3. 成功时优先解析 tool_calls[0].function.arguments，缺失再读取 message.content。
 *
 * @param cfg - 应用配置（读取 aiApiKey、默认模型与温度）
 * @param prompt - 已经拼装好的用户提示词
 * @param opts - 调用选项（模型/温度/结构化偏好/JSON Schema 等）
 * @returns {Promise<AiCompletion>} 结构化文本与可选的用量
 * @category AI
 */
export async function generateWithProvider(
  cfg: AppConfig,
  prompt: string,
  opts: AiClientOptions = {}
): Promise<AiCompletion> {
  const apiKey = cfg.aiApiKey
  if (!apiKey) throw new Error('AI API key not configured')

  const endpoint = 'https://api.deepseek.com/chat/completions'
  const model = opts.model ?? cfg.aiModel ?? 'deepseek-chat'
  const temperature =
    typeof opts.temperature === 'number' ? opts.temperature : (cfg.aiTemperature ?? 0.3)
  const timeoutMs = 30_000

  // base messages
  const baseMessages = [
    {
      role: 'system',
      content:
        'You are an assistant that outputs strictly JSON. Do not include explanations. Return only JSON.',
    },
    { role: 'user', content: prompt },
  ]

  // builder for fetch body
  // 优先走 function-call；但仍保留 response_format 作为回退
  const buildPayloadResponseFormat = () => ({
    model,
    temperature,
    response_format: opts.structured ? { type: 'json_object' } : undefined,
    messages: baseMessages,
  })

  const functionName = opts.functionName || 'build_summary'
  const buildPayloadFunctionTools = () => ({
    model,
    temperature,
    tools: [
      {
        type: 'function',
        function: {
          name: functionName,
          description: 'Return a structured summary object',
          parameters: opts.jsonSchema ?? {
            type: 'object',
            properties: {
              short: { type: 'string' },
              long: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: 'auto',
    messages: baseMessages,
  })

  let attempt = 0
  const maxAttempts = 3
  // simple exponential backoff: 500ms, 1000ms
  const backoff = (n: number) => new Promise((r) => setTimeout(r, 500 * Math.pow(2, n)))

  // retry loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      // Force function-call when structured is enabled (response_format disabled)
      const body1 = opts.structured ? buildPayloadFunctionTools() : buildPayloadResponseFormat()
      console.log(`[AI] mode=${opts.structured ? 'function_tools' : 'plain'} model=${model}`)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body1 ?? buildPayloadResponseFormat()),
        signal: controller.signal,
      })
      clearTimeout(t)

      const data = (await res.json().catch(() => ({}))) as unknown as DeepSeekResponse

      if (!res.ok) {
        // function-call失败时：若 structured=true，回退到 response_format
        if (opts.structured && res.status >= 400 && res.status < 500) {
          try {
            console.log('[AI] function_tools failed, fallback -> response_format')
            const res2 = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(buildPayloadResponseFormat()),
            })
            const data2 = (await res2.json().catch(() => ({}))) as unknown as DeepSeekResponse
            if (!res2.ok) throw new Error(`AI response_format failed: ${res2.status}`)
            const toolArgs2: string | undefined =
              data2?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
            const content2: string = toolArgs2 ?? data2?.choices?.[0]?.message?.content ?? ''
            return { content: content2, model }
          } catch (_e) {
            // fall through to normal retry/backoff below
          }
        }
        // retry on 429/5xx
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          await backoff(attempt - 1)
          continue
        }
        const msg = data?.error?.message || data?.message || `AI request failed: ${res.status}`
        throw new Error(msg)
      }

      // success path: prefer tool_calls arguments if present (some providers still include it)
      const toolArgs: string | undefined =
        data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
      const content: string = toolArgs ?? data?.choices?.[0]?.message?.content ?? ''
      const usage = data?.usage
      return {
        content,
        model,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      }
    } catch (err) {
      clearTimeout(t)
      // network/timeout retry
      if (attempt < maxAttempts) {
        await backoff(attempt - 1)
        continue
      }
      throw err
    }
  }
}
