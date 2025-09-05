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
}

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>
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
  console.log(`[AI] Generating with provider: ${opts.model}`)
  const model = opts.model ?? cfg.aiModel ?? 'deepseek-chat'
  const temperature =
    typeof opts.temperature === 'number' ? opts.temperature : (cfg.aiTemperature ?? 0.3)
  const timeoutMs = 30_000

  const payload = {
    model,
    temperature,
    messages: [
      {
        role: 'system',
        content:
          'You are an assistant that outputs strictly JSON. Do not include explanations. Return only JSON.',
      },
      { role: 'user', content: prompt },
    ],
  }

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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(t)

      const data = (await res.json().catch(() => ({}))) as unknown as DeepSeekResponse
      console.log('♿️ - generateWithProvider - data:', data)

      if (!res.ok) {
        // retry on 429/5xx
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          await backoff(attempt - 1)
          continue
        }
        const msg = data?.error?.message || data?.message || `AI request failed: ${res.status}`
        throw new Error(msg)
      }

      const content: string = data?.choices?.[0]?.message?.content ?? ''
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
