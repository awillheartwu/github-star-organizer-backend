import { Type, type TSchema } from '@sinclair/typebox'
export const __nullable__ = <T extends TSchema>(schema: T) => Type.Union([Type.Null(), schema])
