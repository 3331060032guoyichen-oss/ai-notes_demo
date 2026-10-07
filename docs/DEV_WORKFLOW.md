# Development Workflow

## 分工

按三条工作线划分模块边界：**知识库和图谱**、**UI 界面**、**Skills 和插件**（见 `PROJECT_RULES.md`）。
成员主要在自己的 feature 分支开发，完成稳定功能后合并到集成分支，最终由集成分支合并到 `main`。

## Git 分支

远端实际存在的分支（已用 `git ls-remote` 核实）：

- `main`：稳定版本，默认分支
- `develop-guozechen`：日常集成分支，**所有新工作提交到这里**
- `feature/*`：按任务创建，例如 `feature/raw-storage`（Step 1 历史分支）

> 远端**没有** `develop` 分支。若本地还残留 `origin/develop` 引用，那是过期的远程跟踪引用，用 `git fetch --prune` 清理即可。

## 环境与命令

包管理器是 **pnpm**（`package.json` 里 `packageManager: pnpm@11.25.0`）。不要用 npm 或 yarn 安装依赖，会破坏 lockfile 和 `node_modules` 的符号链接结构。

```bash
pnpm install
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
pnpm dev                     # http://localhost:3000
```

其他可用命令：`pnpm build`、`pnpm start`、`pnpm lint`。
**没有测试脚本**，不要假设 `pnpm test` 存在；验证方式是构建 + 手动走查 + 接口实测。

注意：不要一边开着 `pnpm dev` 一边跑 `pnpm build` —— 两者共用 `.next/` 目录，会互相覆盖。

## Step gate

每次只执行一个 Step。当前 Step 必须完成实现、适用的真实命令或页面验证，并明确报告为 `PASS` 后，才能进入下一 Step。未执行的检查必须报告为 `NOT VERIFIED`，不得用推断替代实际证据。

Step 1 的验收范围是 Raw 创建、读取、输入校验、连续写入、存储异常恢复和重启持久化；该 Step 已 PASS。Step 2（DeepSeek 与 Draft）已完成真实调用、结构化校验、错误路径和 Raw 保留验证；该 Step 已 PASS。Step 3（Draft 确认与 Knowledge 持久化）已完成页面操作、重复确认、重启恢复和 API 验证；该 Step 已 PASS。Step 4（Knowledge Relation）已完成 AI 建议、用户选择、ID 校验、对称去重和页面/API 验证；该 Step 已 PASS。Step 5（Backlink）已完成动态查询、空结果、未知 Knowledge、Relation 删除后的同步和重启恢复验证；该 Step 已 PASS。Step 6（Graph）已完成动态节点/边、节点详情跳转和主流程隔离验证；该 Step 已 PASS。Phase 1 最终全链路也已通过真实 Raw、AI、确认、Relation、Backlink、Graph 和重启测试。

Step 7（工作台改版）已完成并通过验证：左侧导航改为 Raw / Knowledge / Wiki 三组文件树，点击条目在中间区域以标签页打开；新增 `POST /api/assistant` 支持 `@` 提及式问答；新增 `PATCH /api/knowledge/:id` 与 Knowledge 标题右键改名、摘要/正文/概念内联编辑。同期移除了「今日学习 / 复习 / 知识检查」三个视图、新建笔记页的「最近原始笔记」列表，以及 AI 面板原有的 5 个固定动作按钮。

## Commit 规范

使用清晰的 Conventional Commit 风格，例如 `feat: ...`、`fix: ...`、`refactor: ...`、`chore: ...`。避免使用 `update`、`aaa`、`final` 等无信息提交信息。

## AI Coding 规范

修改前阅读相关 docs 与现有代码，明确影响范围并复用已有组件；修改后运行项目、检查相关页面并报告修改文件和测试结果。Prompt 应包含任务目标、上下文、相关文件、禁止修改内容、输入输出和验收标准。

使用 AI 编码工具时，请先让它读仓库根目录的 [`AGENTS.md`](../AGENTS.md) —— 那是给 AI 看的总入口，包含真实的仓库结构、技术栈、已实现/已删除功能清单和已知坑。

## 模块边界与合并规则

- 前端通过内部 API 访问 AI 服务，**密钥仅存在服务器环境变量**，不得进入浏览器或代码。
- 知识结构的变化必须经过用户确认才写入。
- 禁止未经负责人确认的大范围重构；合并前需确认数据模型、UI 规范和基本错误状态没有被破坏。
