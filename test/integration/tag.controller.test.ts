// test/integration/tag.controller.test.ts
import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser, getAuthToken } from '../helpers/auth.helper'

describe('Tag Controller Integration Tests', () => {
  let app: FastifyInstance
  let authToken: string

  beforeAll(async () => {
    await TestDatabase.setup()
    app = await buildTestApp()
    await app.ready()

    // Create test user and get auth token using app instance
    const user = await createTestUser('taguser@example.com', 'password123', 'ADMIN', app)
    authToken = await getAuthToken(app, user)
  })

  afterAll(async () => {
    await cleanupTestApp(app)
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
    // Recreate user for each test
    const user = await createTestUser('taguser@example.com', 'password123', 'ADMIN')
    authToken = await getAuthToken(app, user)
  })

  describe('POST /tags', () => {
    it('should create a new tag', async () => {
      const tagData = {
        name: 'React',
        description: 'React framework tag',
      }

      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: tagData,
      })

      expect(response.statusCode).toBe(201)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('create tag success')
      expect(result.data.name).toBe('React')
      expect(result.data.description).toBe('React framework tag')
    })

    it('should reject duplicate tag name', async () => {
      const tagData = {
        name: 'Vue',
        description: 'Vue framework',
      }

      // Create first tag
      await app.inject({
        method: 'POST',
        url: '/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: tagData,
      })

      // Try to create duplicate
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: tagData,
      })

      expect(response.statusCode).toBe(400)
      const result = JSON.parse(response.payload)
      expect(result.message).toContain('already exists')
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tags',
        payload: {
          name: 'TestTag',
          description: 'Test description',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /tags', () => {
    beforeEach(async () => {
      // Create test tags
      const tags = [
        { name: 'JavaScript', description: 'JS language' },
        { name: 'TypeScript', description: 'TS language' },
        { name: 'React', description: 'React framework' },
      ]

      for (const tag of tags) {
        await app.inject({
          method: 'POST',
          url: '/tags',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: tag,
        })
      }
    })

    it('should get paginated tags', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags?page=1&pageSize=2',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('get all tags')
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(3)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(2)
    })

    it('should support ordering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags?orderBy=name&orderDirection=asc',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      const names = result.data.map((tag: { name: string }) => tag.name)
      expect(names).toEqual(['JavaScript', 'React', 'TypeScript'])
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /tags/:id', () => {
    let tagId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'SingleTag',
          description: 'Single tag for testing',
        },
      })

      const result = JSON.parse(createResponse.payload)
      tagId = result.data.id
    })

    it('should get tag by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/tags/${tagId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('get tag by id')
      expect(result.data.id).toBe(tagId)
      expect(result.data.name).toBe('SingleTag')
    })

    it('should return 404 for non-existent tag', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tags/550e8400-e29b-41d4-a716-446655440000',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /tags/:id', () => {
    let tagId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'UpdateTag',
          description: 'Tag to be updated',
        },
      })

      const result = JSON.parse(createResponse.payload)
      tagId = result.data.id
    })

    it('should update tag', async () => {
      const updateData = {
        name: 'UpdatedTag',
        description: 'Updated description',
      }

      const response = await app.inject({
        method: 'PUT',
        url: `/tags/${tagId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: updateData,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.message).toContain(`update tag id: ${tagId}`)
      expect(result.data.name).toBe('UpdatedTag')
      expect(result.data.description).toBe('Updated description')
    })

    it('should update only provided fields', async () => {
      const updateData = {
        description: 'Only description updated',
      }

      const response = await app.inject({
        method: 'PUT',
        url: `/tags/${tagId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: updateData,
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.data.name).toBe('UpdateTag') // Unchanged
      expect(result.data.description).toBe('Only description updated')
    })
  })

  describe('DELETE /tags/:id', () => {
    let tagId: string

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tags',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'DeleteTag',
          description: 'Tag to be deleted',
        },
      })

      const result = JSON.parse(createResponse.payload)
      tagId = result.data.id
    })

    it('should delete tag', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/tags/${tagId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(204)

      // Verify tag is deleted (archived)
      const getResponse = await app.inject({
        method: 'GET',
        url: `/tags/${tagId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(getResponse.statusCode).toBe(404)
    })

    it('should return 404 for non-existent tag', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/tags/550e8400-e29b-41d4-a716-446655440000',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
