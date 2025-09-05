import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const UserRole = Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')], {
  additionalProperties: false,
})
