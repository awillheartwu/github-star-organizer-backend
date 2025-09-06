# 项目业务 API 文档

本章节由 TypeDoc 自动生成，聚焦对外可复用的 **Service / Helper / Constants** 层代码，不包含以下内容：

- 控制器与路由（交付层，仅供 HTTP 适配，不视为可复用 API）
- 插件与脚本、同步任务的底层实现
- 外部集成适配器（GitHub、AI Client 等）
- 测试与内部类型

## 设计原则

1. 业务逻辑集中在 `services` 层，可单元测试、可复用。
2. `helpers` 存放纯函数与通用工具，尽量无副作用。
3. 不直接从业务外层（如 Controller）访问数据库，而是通过 `Ctx` 传递抽象能力。
4. 通过 `@internal` 标记隐藏内部实现细节，聚焦核心 API。

## 上下文对象 `Ctx`
所有服务函数的首个参数通常是 `Ctx`，包含：
- `prisma`: 数据访问（ORM）
- `redis`: 缓存 / 分布式控制
- `log`: 结构化日志
- `config`: 应用配置（已验证）

这样便于：
- 测试时可注入 mock
- 降低直接 import 具体实例的耦合

## 标签说明
- `@internal`：内部实现，不出现在最终文档中
- `@throws`：标注可能抛出的业务异常（通常为 `AppError`）
- `@returns`：描述返回结构

## 更多
如果你需要查看 HTTP 层（如请求/响应 Schema），请参考：
- `docs/openapi.html` (Swagger 导出)
- `docs/prisma.md` (数据库 Schema 与模型说明)
- 配置说明：`docs/config.md`

> 文档生成命令：`pnpm run docs:typedoc`

生成时间：（自动生成时会覆盖本行）
