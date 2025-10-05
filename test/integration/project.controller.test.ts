// test/integration/project.controller.test.ts
import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'

describe('Project Controller Integration Tests', () => {
  let app: FastifyInstance
  let authToken: string

  beforeAll(async () => {
    await TestDatabase.setup()
    app = await buildTestApp()
    await app.ready()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()

    // 每次测试前通过注册创建新用户并获取token
    const userEmail = `testuser${Date.now()}@example.com`
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: userEmail,
        password: 'password123',
        displayName: 'Test User',
      },
    })

    if (registerResponse.statusCode !== 201) {
      throw new Error(`Registration failed: ${registerResponse.payload}`)
    }

    // 设置为管理员
    const prisma = TestDatabase.getInstance()
    await prisma.user.update({
      where: { email: userEmail },
      data: { role: 'ADMIN' },
    })

    // 获取认证token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: userEmail,
        password: 'password123',
      },
    })

    const result = JSON.parse(loginResponse.payload)
    authToken = result.data.accessToken
  })

  describe('POST /projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        githubId: 12345,
        name: 'test-project',
        fullName: 'user/test-project',
        url: 'https://github.com/user/test-project',
        description: 'Test project description',
        language: 'TypeScript',
        stars: 100,
        forks: 25,
      }

      const response = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: projectData,
      })

      expect(response.statusCode).toBe(201)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('create project success')
      expect(result.data.githubId).toBe(12345)
      expect(result.data.name).toBe('test-project')
    })

    it('should reject duplicate githubId', async () => {
      const projectData = {
        githubId: 12346,
        name: 'test-duplicate',
        fullName: 'user/test-duplicate',
        url: 'https://github.com/user/test-duplicate',
      }

      // Create first project
      await app.inject({
        method: 'POST',
        url: '/projects',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: projectData,
      })

      // Try to create duplicate
      const response = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: projectData,
      })

      expect(response.statusCode).toBe(409)
      const result = JSON.parse(response.payload)
      expect(result.message).toContain('already exists')
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/projects',
        payload: {
          githubId: 12347,
          name: 'test-auth',
          fullName: 'user/test-auth',
          url: 'https://github.com/user/test-auth',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /projects', () => {
    beforeEach(async () => {
      // Create test projects
      const projects = [
        {
          githubId: 1001,
          name: 'react-app',
          fullName: 'user/react-app',
          url: 'https://github.com/user/react-app',
          language: 'TypeScript',
          stars: 150,
          description: 'A React application',
        },
        {
          githubId: 1002,
          name: 'vue-project',
          fullName: 'user/vue-project',
          url: 'https://github.com/user/vue-project',
          language: 'JavaScript',
          stars: 80,
          description: 'A Vue.js project',
        },
      ]

      for (const project of projects) {
        await app.inject({
          method: 'POST',
          url: '/projects',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: project,
        })
      }
    })

    it('should get paginated projects', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects?page=1&pageSize=10',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(10)
    })

    it('should filter by language', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects?language=TypeScript',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].language).toBe('TypeScript')
    })

    it('should search by keyword', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects?keyword=react',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data[0].name).toContain('react')
    })
  })

  describe('GET /projects/languages', () => {
    let archivedProjectId: string

    beforeEach(async () => {
      const responses = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/projects',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            githubId: 4001,
            name: 'ts-project',
            fullName: 'user/ts-project',
            url: 'https://github.com/user/ts-project',
            language: 'TypeScript',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/projects',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            githubId: 4002,
            name: 'js-project',
            fullName: 'user/js-project',
            url: 'https://github.com/user/js-project',
            language: ' JavaScript ',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/projects',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            githubId: 4003,
            name: 'no-lang-project',
            fullName: 'user/no-lang-project',
            url: 'https://github.com/user/no-lang-project',
          },
        }),
      ])

      const archivedResult = JSON.parse(responses[1].payload)
      archivedProjectId = archivedResult.data.id
    })

    it('should return deduplicated, trimmed and sorted languages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects/languages',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('get project languages')
      expect(result.data).toEqual(['JavaScript', 'TypeScript'])
    })

    it('should exclude languages of archived projects', async () => {
      await app.inject({
        method: 'PUT',
        url: `/projects/${archivedProjectId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { archived: true },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/projects/languages',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data).toEqual(['TypeScript'])
    })

    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/projects/languages' })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /projects/:id', () => {
    let projectId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          githubId: 2001,
          name: 'single-project',
          fullName: 'user/single-project',
          url: 'https://github.com/user/single-project',
          description: 'Single project for testing',
        },
      })

      const result = JSON.parse(createResponse.payload)
      projectId = result.data.id
    })

    it('should get project by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data.id).toBe(projectId)
      expect(result.data.name).toBe('single-project')
    })

    it('should return 404 for non-existent project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects/550e8400-e29b-41d4-a716-446655440000',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /projects/:id', () => {
    let projectId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/projects',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          githubId: 3001,
          name: 'update-project',
          fullName: 'user/update-project',
          url: 'https://github.com/user/update-project',
          notes: 'Original notes',
          favorite: false,
        },
      })

      const result = JSON.parse(createResponse.payload)
      projectId = result.data.id
    })

    it('should update project editable fields', async () => {
      const updateData = {
        notes: 'Updated notes',
        favorite: true,
        pinned: true,
        score: 5,
      }

      const response = await app.inject({
        method: 'PUT',
        url: `/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: updateData,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data.notes).toBe('Updated notes')
      expect(result.data.favorite).toBe(true)
      expect(result.data.pinned).toBe(true)
      expect(result.data.score).toBe(5)
    })

    it('should ignore immutable fields', async () => {
      const updateData = {
        githubId: 99999, // Should be ignored
        name: 'new-name', // Should be ignored
        notes: 'Updated notes', // Should be updated
      }

      const response = await app.inject({
        method: 'PUT',
        url: `/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: updateData,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data.githubId).toBe(3001) // Original value
      expect(result.data.name).toBe('update-project') // Original value
      expect(result.data.notes).toBe('Updated notes') // Updated value
    })
  })
})
