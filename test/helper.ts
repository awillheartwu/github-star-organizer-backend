import { build } from 'fastify-cli/helper'
import path from 'path'

const AppPath = path.join(__dirname, '..', 'app.js') // 改成 ts 的话可能是 app.ts

function config() {
  return {
    _skipOverride: true,
  }
}

async function buildApp(t: any) {
  const argv = [AppPath]
  const app = await build(argv, config())
  t.after(() => app.close())
  return app
}

export { config, buildApp }