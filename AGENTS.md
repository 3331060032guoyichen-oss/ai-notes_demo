# AGENTS.md — AI 助手入口手册

> 这是给 AI 编码工具（Claude Code、Codex、Cursor、Copilot 等）看的**唯一入口文件**。
> 读完这一份再动手，不要只读 `docs/` 里的某一份——那几份文档写于不同阶段，有些已经过时。

## 项目是什么

AI Notes：面向大学生的生长式 AI 知识系统（校赛 Demo）。

核心链路：`Raw（原始输入）→ Draft（AI 整理草稿）→ 用户确认 → Knowledge（知识页）→ Relation（关联）→ Graph（图谱）`。
旁边还有一层只读的 `Wiki` 结构，来自一篇 LLM Wiki 文章的实例化演示数据。

**产品原则**：Raw 不可变，AI 只能提议、用户确认后才写入知识网络。

## 仓库与分支

| 项 | 值 |
|---|---|
| 仓库根 | 就是项目根目录，`package.json` / `app/` 等直接在这一层，**没有嵌套的子目录** |
| clone 后的目录名 | `ai-notes_demo`（取自仓库名）。某些本地副本名为 `ai-notes_demo-local`（含下划线），是同一份代码，不要去找这两个名字之外的路径 |
| 远端 | `https://github.com/3331060032guoyichen-oss/ai-notes_demo.git` |
| 默认分支 | `main`（稳定，基本不动） |
| 当前开发分支 | `develop-guozechen`（日常集成，所有新工作在这里） |
| 其他 | `feature/raw-storage` 是 Step 1 的历史分支。远端**没有** `develop` 分支 |

远端分支已用 `git ls-remote` 核实，只有 `main`、`develop-guozechen`、`feature/raw-storage` 三个。若本地还残留 `origin/develop` 引用，那是过期的远程跟踪引用，`git fetch --prune` 清掉即可。

## 快速开始

```bash
pnpm install
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
pnpm dev                     # http://localhost:3000
```

- 包管理器是 **pnpm**（`package.json` 里 `packageManager: pnpm@11.25.0`），不要用 npm/yarn 装依赖，会破坏 lockfile 和 `node_modules` 的符号链接结构。
- 没有 `DEEPSEEK_API_KEY` 时：新建笔记、浏览知识库、图谱、Wiki 全部正常，**只有「AI 整理」和右侧 AI 问答会报错**。这是预期行为，不是 bug。
- 首次打开是空白状态（`data/*.json` 不进 Git），需要自己新建笔记。

可用命令：`pnpm dev` / `pnpm build` / `pnpm start` / `pnpm lint`。**没有测试脚本**，不要假设 `pnpm test` 存在。

## 实际技术栈（只列真实在用的）

- **Next.js 15.5.26**（App Router）+ **React 19** + **TypeScript 5.9**
- 样式：**手写 CSS**，全部在 `app/globals.css`，用 CSS 自定义属性做设计令牌

**没有安装**（不要使用，写了也不会生效）：

- ❌ Tailwind CSS —— 没有 `tailwind.config`，没有 `@tailwind` 指令，`clsx` 也没有
- ❌ shadcn/ui、Radix —— `components/` 目录是空的（只有 `.gitkeep`）
- ❌ react-force-graph-2d 或任何图谱库 —— 图谱是 CSS grid 卡片，不是力导向图
- ❌ GSAP

写新 UI 时请沿用 `app/globals.css` 里已有的类名和 CSS 变量（`--paper` / `--ink` / `--accent` / `--line` / `--radius` 等），不要引入新的样式方案。

## 代码地图

```
app/
  page.tsx          ★ 唯一的页面。单页工作台，"use client"
  globals.css       ★ 2135 行，全部设计令牌和组件样式
  layout.tsx        根布局
  api/**/route.ts   11 个路由，每个都 export const runtime = "nodejs"
lib/
  deepseek.ts       真实调用 DeepSeek（organize 草稿 + assistant 问答）
  raw-storage.ts        读写 data/raw.json
  knowledge-storage.ts  读写 data/knowledge.json
  relation-storage.ts   读写 data/relations.json
  wiki-storage.ts       只读 data/wiki.json
types/              raw / organize / knowledge / relation / graph / wiki
data/
  wiki.json         ✅ 进 Git（只读演示数据，12 页 / 14 条链接）
  raw.json          ❌ gitignore（运行时数据）
  knowledge.json    ❌ gitignore
  relations.json    ❌ gitignore
docs/               产品/设计/数据/流程文档，见下方"文档地图"
```

### `app/page.tsx` 的关键结构

页面靠一个 `Tab` 联合类型驱动标签页，**不是多路由**：

```ts
type Tab =
  | { kind: "view"; viewKey: "new-note" | "graph"; ... }   // 工具类视图
  | { kind: "raw"; rawId: string; ... }                    // 单条原始笔记
  | { kind: "knowledge"; knowledgeId: string; ... }        // 单条知识页
  | { kind: "wiki"; wikiPageId: string; ... }              // 单个 Wiki 页面
  | { kind: "draft"; rawId: string; ... }                  // Draft 审阅
```

- 左侧是 Raw / Knowledge / Wiki **文件树**，点击某条 → `openXxxTab()` 在中间区域开一个标签页
- `navigate(viewKey)` 打开/激活工具类标签（新建笔记、图谱）
- 新增"某类内容"的详情页时，加一个 `Tab` 变体 + 一个 `renderXxxTab()`，**不要**加新路由或新的顶层视图

### API 路由一览

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/raw` | GET / POST / DELETE | 原始笔记。DELETE 时若已被 Knowledge 引用会返回 409 |
| `/api/organize` | POST | 调 DeepSeek 生成 `OrganizeDraft`（不写入） |
| `/api/knowledge` | GET / POST | 列表 / 确认 Draft 落库 |
| `/api/knowledge/[id]` | GET / **PATCH** | 单条读取 / 部分字段更新（标题、摘要、正文等） |
| `/api/knowledge/[id]/relations` | GET | 该知识的关联 |
| `/api/knowledge/[id]/backlinks` | GET | 反向链接（动态查询，不落表） |
| `/api/relations` | GET / POST | 关联列表 / 新建 |
| `/api/relations/[id]` | DELETE | 删除关联 |
| `/api/graph` | GET | 从 Knowledge + Relation 实时生成 nodes/edges |
| `/api/wiki` | GET | Wiki 页面 + 链接（只读） |
| `/api/assistant` | POST | AI 问答。服务端按 `contextType` + `contextId` 重新读取真实内容 |

**所有存储层在文件不存在时返回空数组/空对象（`ENOENT` 分支），不抛异常。** 所以部署到 Vercel 这种只读文件系统时，读取不会 500，但**写入会失败**。

## 当前已实现

- 文件树导航 + 标签页工作台（Raw / Knowledge / Wiki 各自成树，点击开标签）
- 新建笔记 → AI 整理 → 审阅编辑 → 确认入库（Raw → Knowledge）
- Knowledge 内联编辑：标题右键改名、摘要/正文/概念点击编辑（`PATCH /api/knowledge/:id`）
- AI 问答面板：输入 `@` 弹出候选列表，可把某条 Raw/Knowledge/Wiki 作为提问上下文
- 关系图谱（节点卡片 + 边列表，CSS grid，非力导向）
- Wiki 只读浏览

## 已删除的功能 —— 不要重建

以下功能是**产品决策主动删除的**，不是遗漏。看到旧文档提到它们请忽略：

- ❌ **今日学习 / 复习 / 知识检查** 三个视图（曾经的 `renderToday` / `renderStudy` / `renderLint`）
- ❌ 新建笔记页的**「最近原始笔记」**列表
- ❌ AI 面板的 **5 个罐头按钮**（解释当前内容 / 提炼关键概念 / 生成学习卡片 / 生成小测验 / 检查知识状态）——已换成 `@` 提及问答

## 改动边界

- **Raw 不可变**：Raw 只有创建和删除，没有编辑接口。不要给 Raw 加 PATCH。
- **AI 不自动写入**：AI 只生成草稿或回答，落库必须经过用户确认。
- **`data/wiki.json` 是只读演示数据**，进 Git；另外三个 `data/*.json` 是运行时数据，不进 Git，不要提交。
- **API Key 只在服务端**：`DEEPSEEK_API_KEY` 从环境变量读，永远不要传到浏览器或写进代码。`.env.local` 已被 gitignore。
- 改 Knowledege 的字段结构时，要同时改 `types/knowledge.ts`、`lib/knowledge-storage.ts` 的校验函数、以及 `PATCH` 路由的校验。

## 文档地图

| 文件 | 状态 |
|---|---|
| `AGENTS.md`（本文件） | ✅ **权威**，冲突时以这里为准 |
| `docs/ROADMAP.md` | ✅ 有效（目标 / 现状 / 差距对照，排期依据） |
| `docs/PROJECT_RULES.md` | ✅ 有效（产品方向与四类节点的长期模型） |
| `docs/DATA_MODEL.md` | ✅ 有效（区分长期模型 vs 当前实际 schema，注意别混） |
| `docs/DESIGN_SYSTEM.md` | ✅ 有效（视觉规范，含与当前实现的差距说明） |
| `docs/DEV_WORKFLOW.md` | ✅ 有效（分支与提交规范） |
| `docs/PROJECT_CONTEXT.md` | ⚠️ 阶段性状态记录，可能滞后于代码 |
| `docs/THIRD_PARTY.md` | ✅ 有效（第三方依赖登记表） |
| `docs/CODEX_AI_LEARNING_UI_BRIEF.md` | ⚠️ **历史 brief，已过时**。文中要求做 Study / Lint / 力导向图谱，这些已被推翻。仅作背景参考，**不要照着做** |
| `README.md` | ✅ 面向人的简述 |

## 已知坑

1. **目录名有多个写法**：clone 出来是 `ai-notes_demo`；本机可能叫 `ai-notes_demo-local`（含下划线）。常被写错成全连字符的 `ai-notes-demo-local` —— 那个路径不存在，`cd` 会直接失败。
2. **行尾假象**：`core.autocrlf` 未设置，`git status` 常说"20 个文件被修改"，其中绝大多数只是行尾差异。判断真实改动用 `git diff --ignore-cr-at-eol`。
3. **`tsconfig.tsbuildinfo`** 是 TypeScript 增量构建缓存，已在 `.gitignore` 中，不要提交。
4. **`pnpm build` 会打印一条 ESLint 报错**（`Cannot find module 'eslint-plugin-react-hooks'`）。构建仍然成功退出（exit 0），这是已知的 lint 插件缺失，不影响产物。
5. **不要跑 `pnpm build` 的同时开着 `pnpm dev`** —— 两者共用 `.next/` 目录，会互相覆盖导致 dev server 报 `Cannot find module './xxx.js'`。
6. 在 Windows + Git Bash 下，路径含中文用户名时 `cd` 偶尔会因编码失败；把 `cd` 和后续命令写在同一条命令里，或用相对路径。
