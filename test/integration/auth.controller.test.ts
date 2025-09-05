// test/integration/auth.controller.test.ts
import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser } from '../helpers/auth.helper'

describe('Auth Controller Integration Tests', () => {
  let app: FastifyInstance

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
  })

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'newuser@example.com',
          password: 'password123',
          displayName: 'New User',
        },
      })

      expect(response.statusCode).toBe(201)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('register success')
    })

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        displayName: 'Duplicate User',
      }

      // First registration
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: userData,
      })

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: userData,
      })

      expect(response.statusCode).toBe(409)
      const result = JSON.parse(response.payload)
      expect(result.message).toContain('Email already registered')
    })

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'invalid',
          // missing password
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createTestUser('loginuser@example.com', 'password123')
    })

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'loginuser@example.com',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('ok')
      expect(result.data.accessToken).toBeDefined()
      expect(response.cookies.some((c) => c.name === 'rt')).toBe(true)
    })

    it('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'loginuser@example.com',
          password: 'wrongpassword',
        },
      })

      expect(response.statusCode).toBe(401)
      const result = JSON.parse(response.payload)
      expect(result.message).toContain('Invalid credentials')
    })
  })

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Create user and login first
      await createTestUser('refreshuser@example.com', 'password123')

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'refreshuser@example.com',
          password: 'password123',
        },
      })

      const refreshCookie = loginResponse.cookies.find((c) => c.name === 'rt')?.value

      // Use refresh token
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          cookie: `rt=${refreshCookie}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const result = JSON.parse(response.payload)
      expect(result.message).toBe('ok')
      expect(result.data.accessToken).toBeDefined()
    })

    it('should reject invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          cookie: 'rt=invalid-token',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /auth/logout', () => {
    it('should logout and revoke refresh token', async () => {
      await createTestUser('logoutuser@example.com', 'password123')

      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'logoutuser@example.com',
          password: 'password123',
        },
      })

      const refreshCookie = loginResponse.cookies.find((c) => c.name === 'rt')?.value

      // Logout (requires access token)
      const loginResult = JSON.parse(loginResponse.payload)
      const accessToken = loginResult.data.accessToken
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          cookie: `rt=${refreshCookie}`,
          authorization: `Bearer ${accessToken}`,
        },
      })

      expect(response.statusCode).toBe(204)

      // Try to use refresh token after logout
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          cookie: `rt=${refreshCookie}`,
        },
      })

      expect(refreshResponse.statusCode).toBe(401)
    })
  })
})
