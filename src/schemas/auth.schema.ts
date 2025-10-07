// src/schemas/auth.schema.ts
import { Type, Static } from '@sinclair/typebox'

export const AuthTag = 'Auth'

// —— 请求体 —— //
export const RegisterBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 6 }),
  displayName: Type.Optional(Type.String()),
})

export const LoginBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 6 }),
})

export const ChangePasswordBodySchema = Type.Object({
  oldPassword: Type.String({ minLength: 6 }),
  newPassword: Type.String({ minLength: 6 }),
})

// —— 响应体 —— //
export const AccessTokenResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Object({
    accessToken: Type.String(),
  }),
})

export const MeResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Object({
    user: Type.Object({
      sub: Type.String(),
      role: Type.Optional(Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')])),
      type: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      email: Type.Optional(Type.String({ format: 'email' })),
      createdAt: Type.Optional(Type.String({ format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
    }),
  }),
})

export const BasicMessageSchema = Type.Object({
  message: Type.String(),
})

export const AuthFeaturesResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Object({
    allowRegistration: Type.Boolean(),
  }),
})

// —— 便于 controller 推断 body 类型 —— //
export type RegisterBody = Static<typeof RegisterBodySchema>
export type LoginBody = Static<typeof LoginBodySchema>
export type ChangePasswordBody = Static<typeof ChangePasswordBodySchema>
