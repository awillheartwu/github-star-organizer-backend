import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const deploy = fileURLToPath(new URL('../deploy-compose.sh', import.meta.url))
const project = 'github_star_group'
const oldProject = 'github_star_group-github-star-organizer-backend'

// Model Docker metadata and port ownership independently of the deployment
// script. Retagging latest changes ps output, but not Config.Image or labels.
const docker = String.raw`
const fs = require('node:fs')
const args = process.argv.slice(2)
const state = JSON.parse(fs.readFileSync(process.env.DOCKER_FIXTURE, 'utf8'))
const save = () => fs.writeFileSync(process.env.DOCKER_FIXTURE, JSON.stringify(state))
const fail = message => { save(); console.error(message); process.exit(1) }
const format = args[args.indexOf('--format') + 1]
const item = id => state.containers.find(c => c.id === id)
state.calls.push(args)
if (args[0] === 'ps') {
  const filter = args.find(a => a.startsWith('label=com.docker.compose.service='))
  const containers = state.containers.filter(c => !filter || c.service === filter.split('=').at(-1))
  if (args.some(a => /^-[a-z]*q[a-z]*$/.test(a))) console.log(containers.map(c => c.id).join('\n'))
  else console.log(containers.map(c => [c.id, c.displayImage, c.project, c.service].join('|')).join('\n'))
} else if (args[0] === 'inspect') {
  if (state.inspectFail) fail('inspect failed')
  const ids = args.slice(args.indexOf('--format') + 2)
  for (const id of ids) {
    const c = item(id)
    if (!c) fail('container missing: ' + id)
    if (format.includes('.Config.Image')) console.log([c.id, c.configImage, c.project, c.service].join('|'))
    else if (format.includes('.State.Status')) console.log(c.status)
    else if (format.includes('.State.Running')) console.log(c.status === 'running' ? 'true' : 'false')
    else fail('unsupported inspect format')
  }
} else if (args[0] === 'stop') {
  const c = item(args[1]); if (!c) fail('container missing'); c.status = 'exited'
} else if (args[0] === 'start') {
  const c = item(args[1]); if (!c) fail('container missing'); c.status = 'running'
} else if (args[0] === 'rm') {
  const c = item(args[1]); if (!c || c.status === 'running') fail('cannot remove container')
  state.containers = state.containers.filter(x => x !== c)
} else if (args[0] === 'compose') {
  const command = args[3], service = args.at(-1)
  const current = state.containers.find(c => c.project === process.env.COMPOSE_PROJECT_NAME && c.service === service)
  if (command === 'ps') console.log(current?.id || '')
  else if (command === 'up') {
    let candidate = current
    if (!candidate) {
      candidate = {id:'candidate', project:process.env.COMPOSE_PROJECT_NAME, service, status:'created', port:state.port}
      state.containers.push(candidate)
    }
    if (state.containers.some(c => c !== candidate && c.status === 'running' && c.port === state.port)) fail('port is already allocated')
    if (state.startFail) fail('candidate start failed')
    candidate.status = 'running'
  } else if (command === 'exec') {
    if (state.healthFail) fail('HTTP not ready')
  } else if (command === 'rm') {
    if (state.removeFail) fail('candidate removal failed')
    state.containers = state.containers.filter(c => c !== current)
  } else if (command !== 'config') fail('unsupported Compose command')
} else if (args[0] !== 'volume') fail('unsupported Docker command')
save()
`

function container(service, changes = {}) {
  const configImage = service === 'web' ? 'gsor-frontend:latest' : 'gsor-backend:latest'
  return { id: 'legacy', project: oldProject, service, status: 'running',
    port: service === 'web' ? 33334 : 33333, configImage, displayImage: 'sha256:old-image', ...changes }
}

function run(service, initial, checks) {
  const directory = mkdtempSync(path.join(tmpdir(), 'gsor-deploy-test-'))
  try {
    const bin = path.join(directory, 'bin')
    mkdirSync(bin)
    writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}\n${docker}`, { mode: 0o755 })
    writeFileSync(path.join(bin, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
    writeFileSync(path.join(directory, '.env.production'), 'FIXTURE_ONLY=disposable\n')
    const fixture = path.join(directory, 'docker.json')
    writeFileSync(fixture, JSON.stringify({ calls: [], port: service === 'web' ? 33334 : 33333, ...initial }))
    const result = spawnSync('bash', [deploy, service], { cwd: directory, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DOCKER_FIXTURE: fixture } })
    checks(result, JSON.parse(readFileSync(fixture, 'utf8')))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

for (const service of ['web', 'api']) {
  test(`${service}: migrate a running image after latest was retagged`, () => {
    run(service, { containers: [container(service)] }, (result, state) => {
      assert.equal(result.status, 0, result.stderr)
      assert.equal(state.containers.length, 1)
      assert.equal(state.containers[0].project, project)
      assert.equal(state.containers[0].status, 'running')
    })
  })

  test(`${service}: recover an unstarted candidate left by a port conflict`, () => {
    const candidate = container(service, { id: 'failed-candidate', project, status: 'created' })
    run(service, { containers: [container(service), candidate] }, (result, state) => {
      assert.equal(result.status, 0, result.stderr)
      assert.equal(state.containers.length, 1)
      assert.equal(state.containers[0].status, 'running')
      assert(state.calls.some(a => a[0] === 'rm' && a[1] === candidate.id))
    })
  })

  test(`${service}: restore legacy service when the replacement is not ready`, () => {
    run(service, { containers: [container(service)], healthFail: true }, (result, state) => {
      assert.notEqual(result.status, 0)
      assert.deepEqual(state.containers, [container(service)])
      assert(state.calls.some(a => a[0] === 'start' && a[1] === 'legacy'))
    })
  })

  test(`${service}: refuse an active target without stopping either container`, () => {
    const containers = [container(service), container(service, { id: 'active-target', project, port: 12345 })]
    run(service, { containers }, (result, state) => {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /Both legacy and target/)
      assert.deepEqual(state.containers, containers)
      assert(!state.calls.some(a => ['stop', 'rm', 'start'].includes(a[0])))
    })
  })

  test(`${service}: refuse ambiguous legacy services`, () => {
    const containers = [container(service), container(service, { id: 'other', status: 'exited' })]
    run(service, { containers }, (result, state) => {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /Multiple legacy/)
      assert.deepEqual(state.containers, containers)
      assert(!state.calls.some(a => ['stop', 'rm', 'start'].includes(a[0])))
    })
  })

  test(`${service}: do not stop an unrelated port owner`, () => {
    const unrelated = container(service, { id: 'unrelated', configImage: 'unrelated:latest', displayImage: 'unrelated:latest' })
    run(service, { containers: [unrelated] }, (result, state) => {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /port is already allocated/)
      assert.equal(state.containers.find(c => c.id === unrelated.id).status, 'running')
      assert(!state.calls.some(a => ['stop', 'start'].includes(a[0])))
    })
  })

  test(`${service}: fail safely if container inspection is unavailable`, () => {
    const containers = [container(service)]
    run(service, { containers, inspectFail: true }, (result, state) => {
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /inspect failed/)
      assert.deepEqual(state.containers, containers)
      assert(!state.calls.some(a => ['stop', 'rm', 'start'].includes(a[0]) || a.includes('up')))
    })
  })
}
