// src/schemas/admin.schema.ts
import { Type } from '@sinclair/typebox'
export const AdminTag = 'Admin'

export const SetRoleBodySchema = Type.Object({
  userId: Type.String(),
  role: Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')]),
})

export const BasicMessageSchema = Type.Object({ message: Type.String() })
