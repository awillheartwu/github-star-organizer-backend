// src/helpers/transform.ts
import type { Tag, Project } from '@prisma/client'

/**
 * Prisma include 形态下的 Project：
 * - tags: ProjectTag[]，每项含 { tag: Tag }
 * - videoLinks: { id, url }[]
 */
export interface ProjectWithRelations extends Project {
  tags: Array<{ tag: Tag }>
  videoLinks: Array<{ id: string; url: string }>
}

/**
 * Prisma include 形态下的 Tag：
 * - projects: TagProject[]，每项含 { project: Project }
 */
export interface TagWithRelations extends Tag {
  projects: Array<{ project: TagProjectSummary }>
}

/** 前端期望的 Tag 摘要 */
export type TagSummary = Pick<Tag, 'id' | 'name' | 'description'>

/** Tags 接口中的 project 精简 */
export type TagProjectSummary = Pick<Project, 'id' | 'name' | 'fullName' | 'url'>

/** 脱壳后的 Project DTO（扁平 tags 与 videoLinks:url[]） */
export type ProjectDto = Omit<Project, never> & {
  tags: TagSummary[]
  videoLinks: string[]
}

/** 脱壳后的 Tag DTO（扁平 projects） */
export type TagDto = Omit<Tag, 'projects'> & {
  projects: TagProjectSummary[]
}

/**
 * 将 Prisma 返回的 Project(include relations) 脱壳为前端友好的 DTO。
 * - ProjectTag[] -> TagSummary[]
 * - VideoLink[]  -> string[]
 */
export function toProjectDto(p: ProjectWithRelations): ProjectDto {
  const flatTags: TagSummary[] = p.tags.map((pt) => ({
    id: pt.tag.id,
    name: pt.tag.name,
    description: pt.tag.description ?? null,
  }))
  const urls = p.videoLinks.map((v) => v.url)
  // 用展开保留 Project 的所有标量字段，然后覆盖 relations 字段
  return { ...p, tags: flatTags, videoLinks: urls }
}

/** Projects批量脱壳 */
export function toProjectDtos(list: ProjectWithRelations[]): ProjectDto[] {
  return list.map(toProjectDto)
}

/** Tags脱壳 */
export function toTagDto(tag: TagWithRelations): TagDto {
  const flatProjects: TagProjectSummary[] = tag.projects.map((p) => ({
    id: p.project.id,
    name: p.project.name,
    fullName: p.project.fullName,
    url: p.project.url,
  }))
  return {
    ...tag,
    projects: flatProjects,
  }
}
