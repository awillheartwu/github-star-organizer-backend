// src/services/ai.client.ts
import type { AppConfig } from '../config'

export type AiCompletion = {
  content: string
  model?: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

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
 * - 统一读取 `cfg.aiApiKey`
 * - 支持 retries（429/5xx 指数退避）与超时
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
