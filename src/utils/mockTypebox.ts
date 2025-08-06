// src/utils/mockTypebox.ts
import { faker } from '@faker-js/faker'
import { TSchema, TLiteral, TObject, TArray, Static } from '@sinclair/typebox'

function mockLiteral<T extends TLiteral>(schema: T): T['const'] {
  return schema.const
}

function mockType<T extends TSchema>(schema: T): Static<T> {
  switch (schema.type) {
    case 'string':
      return faker.lorem.words(3) as Static<T>
    case 'number':
    case 'integer':
      return faker.number.int({ min: 1, max: 1000 }) as Static<T>
    case 'boolean':
      return faker.datatype.boolean() as Static<T>
    case 'array':
      return Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
        mockType((schema as TArray).items)
      ) as Static<T>
    case 'object': {
      const obj = {} as Static<T>
      const properties = (schema as TObject).properties
      for (const key in properties) {
        obj[key as keyof Static<T>] = mockType(properties[key])
      }
      return obj
    }
    default:
      // union/optional/null
      if ((schema as any).anyOf || (schema as any).oneOf) {
        const arr = (schema as any).anyOf || (schema as any).oneOf
        return mockType(faker.helpers.arrayElement(arr)) as Static<T>
      }
      if ((schema as any).type === 'null') {
        return null as Static<T>
      }
      return undefined as Static<T>
  }
}

export function mockFromTypeboxSchema<T extends TSchema>(schema: T): Static<T> {
  return mockType(schema)
}
