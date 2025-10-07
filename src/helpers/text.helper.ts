/**
 * 清洗 AI 摘要等自由文本，去除 JSON 不支持的控制字符。
 * - 保留常见的换行和制表符，方便前端做展示。
 * - 统一换行符为 \n，避免混用 CRLF。
 */
// eslint-disable-next-line no-control-regex -- 需要明确过滤 ASCII 控制字符，避免序列化后出现非法 JSON
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function sanitizeMultilineText(input?: string | null): string {
  if (input === undefined || input === null) return ''
  const normalized = input.replace(/\r\n?/g, '\n')
  return normalized.replace(CONTROL_CHAR_PATTERN, ' ')
}
