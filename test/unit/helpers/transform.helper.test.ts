// test/unit/helpers/transform.helper.test.ts
import { toProjectDto, toProjectDtos } from '../../../src/helpers/transform.helper'
import type { ProjectWithRelations } from '../../../src/helpers/transform.helper'

describe('TransformHelper', () => {
  const mockProjectWithRelations: ProjectWithRelations = {
    id: 'test-id',
    githubId: 12345,
    name: 'test-project',
    fullName: 'user/test-project',
    url: 'https://github.com/user/test-project',
    description: 'Test project description',
    language: 'TypeScript',
    stars: 100,
    forks: 25,
    lastCommit: new Date('2023-01-01'),
    lastSyncAt: new Date('2023-01-02'),
    touchedAt: new Date('2023-01-03'),
    notes: 'Test notes',
    favorite: true,
    archived: false,
    pinned: false,
    score: 5,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    deletedAt: null,
    tags: [
      {
        tag: {
          id: 'tag1',
          name: 'react',
          description: 'React framework',
          archived: false,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
      },
      {
        tag: {
          id: 'tag2',
          name: 'typescript',
          description: null,
          archived: false,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
      },
    ],
    videoLinks: [
      { id: 'video1', url: 'https://youtube.com/watch?v=abc123' },
      { id: 'video2', url: 'https://youtube.com/watch?v=def456' },
    ],
  }

  describe('toProjectDto', () => {
    it('should transform project with relations to DTO', () => {
      const result = toProjectDto(mockProjectWithRelations)

      expect(result).toMatchObject({
        id: 'test-id',
        githubId: 12345,
        name: 'test-project',
        fullName: 'user/test-project',
        description: 'Test project description',
        language: 'TypeScript',
        stars: 100,
        forks: 25,
        notes: 'Test notes',
        favorite: true,
        archived: false,
        pinned: false,
        score: 5,
      })

      expect(result.tags).toHaveLength(2)
      expect(result.tags).toEqual([
        { id: 'tag1', name: 'react', description: 'React framework' },
        { id: 'tag2', name: 'typescript', description: null },
      ])

      expect(result.videoLinks).toEqual([
        'https://youtube.com/watch?v=abc123',
        'https://youtube.com/watch?v=def456',
      ])
    })
  })

  describe('toProjectDtos', () => {
    it('should transform array of projects with relations to DTOs', () => {
      const mockProjects = [mockProjectWithRelations, mockProjectWithRelations]
      const result = toProjectDtos(mockProjects)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'test-id',
        name: 'test-project',
      })
      expect(result[0].tags).toHaveLength(2)
      expect(result[0].videoLinks).toHaveLength(2)
    })

    it('should handle empty array', () => {
      const result = toProjectDtos([])
      expect(result).toEqual([])
    })
  })
})
