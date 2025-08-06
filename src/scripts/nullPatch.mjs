import fs from 'fs'
import path from 'path'

// 兼容 pnpm workspace/常见 monorepo 结构。可根据你实际输出路径微调
const file = path.resolve('src/generated/prismabox/__nullable__.ts')

if (!fs.existsSync(file)) {
  console.error('[nullPatch] 找不到 __nullable__.ts 文件: ' + file)
  process.exit(1)
}

let content = fs.readFileSync(file, 'utf-8')

// 把 Type.Union([Type.Null(), schema]) 替换成 Type.Union([schema, Type.Null()])
const patched = content.replace(
  /Type\.Union\(\[\s*Type\.Null\(\)\s*,\s*schema\s*\]\)/g,
  'Type.Union([schema, Type.Null()])'
)

if (content !== patched) {
  fs.writeFileSync(file, patched, 'utf-8')
  console.log('[nullPatch] 修正 Type.Union([Type.Null(), schema]) 成功')
} else {
  console.log('[nullPatch] 无需修正，未匹配到需要替换的内容')
}
