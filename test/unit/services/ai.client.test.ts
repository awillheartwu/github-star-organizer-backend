// test/unit/services/ai.client.test.ts
import { generateWithProvider } from '../../../src/services/ai.client'
import type { AppConfig } from '../../../src/config'

describe('ai.client generateWithProvider', () => {
  const cfg: Partial<AppConfig> = {
    aiApiKey: 'sk-test',
    aiModel: 'deepseek-chat',
    aiTemperature: 0.3,
  }

  const originalFetch = global.fetch as typeof fetch

  afterEach(() => {
    ;(global as unknown as { fetch: typeof fetch }).fetch = originalFetch
  })

  it('parses tool_calls function arguments when structured=true', async () => {
    ;(global as unknown as { fetch: typeof fetch }).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              tool_calls: [
                { function: { name: 'build_summary', arguments: '{"short":"a","long":"b"}' } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      }),
    })) as unknown as typeof fetch

    const res = await generateWithProvider(cfg as AppConfig, 'PROMPT', { structured: true })
    expect(res.content).toContain('short')
    expect(res.model).toBe('deepseek-chat')
    expect(res.usage?.totalTokens).toBe(15)
  })
})
