# Development Workflow

## 4 人协作

按 UI、AI、Knowledge、Product / Integration 划分模块边界。成员主要在自己的 feature 分支开发，完成稳定功能后合并到集成分支，最终由集成分支合并到 `main`。

## Git 分支

- `main`：稳定版本
- `develop-guozechen`：当前仓库的日常集成分支
- `feature/*`：按任务创建，例如 `feature/raw-storage`、`feature/ui`、`feature/ai` 和 `feature/knowledge`

当前仓库没有远程 `develop` 分支；本阶段全部 Step 已在 `develop-guozechen` 完成并验证，`main` 保持稳定且未修改。`feature/raw-storage` 是 Step 1 的历史开发分支。后续新增功能仍应先在对应 feature 分支验证，再合并到 `develop-guozechen`。

## Step gate

每次只执行一个 Step。当前 Step 必须完成实现、适用的真实命令或页面验证，并明确报告为 `PASS` 后，才能进入下一 Step。未执行的检查必须报告为 `NOT VERIFIED`，不得用推断替代实际证据。

Step 1 的验收范围是 Raw 创建、读取、输入校验、连续写入、存储异常恢复和重启持久化；该 Step 已 PASS。Step 2（DeepSeek 与 Draft）已完成真实调用、结构化校验、错误路径和 Raw 保留验证；该 Step 已 PASS。Step 3（Draft 确认与 Knowledge 持久化）已完成页面操作、重复确认、重启恢复和 API 验证；该 Step 已 PASS。Step 4（Knowledge Relation）已完成 AI 建议、用户选择、ID 校验、对称去重和页面/API 验证；该 Step 已 PASS。Step 5（Backlink）已完成动态查询、空结果、未知 Knowledge、Relation 删除后的同步和重启恢复验证；该 Step 已 PASS。Step 6（Graph）已完成动态节点/边、节点详情跳转和主流程隔离验证；该 Step 已 PASS。Phase 1 最终全链路也已通过真实 Raw、AI、确认、Relation、Backlink、Graph 和重启测试。

## Commit 规范

使用清晰的 Conventional Commit 风格，例如 `feat: ...`、`fix: ...`、`refactor: ...`、`chore: ...`。避免使用 `update`、`aaa`、`final` 等无信息提交信息。

## AI Coding 规范

修改前阅读相关 docs 与现有代码，明确影响范围并复用已有组件；修改后运行项目、检查相关页面并报告修改文件和测试结果。Prompt 应包含任务目标、上下文、相关文件、禁止修改内容、输入输出和验收标准。

## 模块边界与合并规则

前端通过内部 API 访问 AI 服务，密钥仅存在服务器环境变量。知识结构变化必须经过 Proposal 和用户确认。禁止未经负责人确认的大范围重构；合并前需确认数据模型、UI 规范和基本错误状态没有被破坏。
