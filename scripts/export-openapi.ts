import Fastify from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import configPlugin from '../src/plugins/config'
import appPlugin from '../src/app'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

async function main() {
  const app = Fastify({ logger: false })

  await app.register(configPlugin)
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'GitHub Star Organizer API',
        description: 'API Docs',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  })
  await app.register(fastifySwaggerUI, { routePrefix: '/docs' })
  await app.register(appPlugin)

  await app.ready()
  const spec = app.swagger()

  const docsDir = resolve(process.cwd(), 'docs')
  mkdirSync(docsDir, { recursive: true })
  const outJson = resolve(docsDir, 'openapi.json')
  writeFileSync(outJson, JSON.stringify(spec, null, 2), 'utf8')

  // Produce a minimal Redoc HTML with inlined spec to avoid file:// fetch issues
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>GitHub Star Organizer API</title>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <style>html,body,#redoc{height:100%}body{margin:0;padding:0}</style>
  </head>
  <body>
    <div id="redoc"></div>
    <script>
      window.__SPEC__ = ${JSON.stringify(spec)};
      Redoc.init(window.__SPEC__, {}, document.getElementById('redoc'));
    </script>
  </body>
</html>`
  const outHtml = resolve(docsDir, 'openapi.html')
  writeFileSync(outHtml, html, 'utf8')

  await app.close()
  // eslint-disable-next-line no-console
  console.log('OpenAPI exported to:', outJson, '\nDocs:', outHtml)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
