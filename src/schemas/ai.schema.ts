import { Type } from '@sinclair/typebox'
export const AiTag = 'AI'

export const BodySchema = Type.Object({
  style: Type.Optional(
    Type.Union([Type.Literal('short'), Type.Literal('long'), Type.Literal('both')])
  ),
  lang: Type.Optional(Type.Union([Type.Literal('zh'), Type.Literal('en')])),
  model: Type.Optional(Type.String()),
  temperature: Type.Optional(Type.Number()),
  createTags: Type.Optional(Type.Boolean()),
  includeReadme: Type.Optional(Type.Boolean()),
  readmeMaxChars: Type.Optional(Type.Integer({ minimum: 500, maximum: 20000 })),
})

export const ResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Object({
    summaryShort: Type.Optional(Type.String()),
    summaryLong: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    lang: Type.Optional(Type.String()),
    tagsCreated: Type.Array(Type.String()),
    tagsLinked: Type.Array(Type.String()),
  }),
})
