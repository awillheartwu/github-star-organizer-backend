import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export async function getTags(req: FastifyRequest, reply: FastifyReply) {
  // 这里只是举例
  reply.send({ message: 'get all tags' })
}

export async function getTagById(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 获取单个 tag
  reply.send({ message: `get tag by id: ${req.params.id}` })
}

export async function createTag(req: FastifyRequest, reply: FastifyReply) {
  // 新建 tag
  reply.send({ message: 'create tag' })
}

export async function updateTag(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 修改 tag
  reply.send({ message: `update tag id: ${req.params.id}` })
}

export async function deleteTag(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 删除 tag
  reply.send({ message: `delete tag id: ${req.params.id}` })
}
