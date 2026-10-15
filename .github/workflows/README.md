# GitHub CI disabled

本项目只在 Forgejo 执行 CI 和自动部署；GitHub 用于同步代码。

本目录仅保留说明，不添加 `.yml` 或 `.yaml` 工作流，避免同步 `dev`、`main` 或创建 PR 时触发 GitHub Actions。可执行工作流统一放在 `.forgejo/workflows/`。
