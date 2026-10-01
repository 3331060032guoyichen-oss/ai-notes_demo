# Development Workflow

## 4 人协作

按 UI、AI、Knowledge、Product / Integration 划分模块边界。成员主要在自己的 feature 分支开发，完成稳定功能后合并到 `develop`，最终由 `develop` 合并到 `main`。

## Git 分支

- `main`：稳定版本
- `develop`：日常集成
- `feature/ui`、`feature/ai`、`feature/knowledge`：按任务创建

## Commit 规范

使用清晰的 Conventional Commit 风格，例如 `feat: ...`、`fix: ...`、`refactor: ...`、`chore: ...`。避免使用 `update`、`aaa`、`final` 等无信息提交信息。

## AI Coding 规范

修改前阅读相关 docs 与现有代码，明确影响范围并复用已有组件；修改后运行项目、检查相关页面并报告修改文件和测试结果。Prompt 应包含任务目标、上下文、相关文件、禁止修改内容、输入输出和验收标准。

## 模块边界与合并规则

前端通过内部 API 访问 AI 服务，密钥仅存在服务器环境变量。知识结构变化必须经过 Proposal 和用户确认。禁止未经负责人确认的大范围重构；合并前需确认数据模型、UI 规范和基本错误状态没有被破坏。
