import { Type } from '@sinclair/typebox'

export const HealthOkSchema = Type.Object({ status: Type.Literal('ok') })

export const ReadyOkSchema = Type.Object({
  status: Type.Literal('ok'),
  db: Type.Boolean(),
  redis: Type.Boolean(),
  queues: Type.Boolean(),
})

export const ReadyFailSchema = Type.Object({
  status: Type.Literal('fail'),
  db: Type.Boolean(),
  redis: Type.Boolean(),
  queues: Type.Boolean(),
})
