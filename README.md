# AI Notes

面向大学生的生长式 AI 知识系统。

## 当前阶段

2026  Demo。

## 项目简介

AI Notes 致力于将大学生的手写笔记、电子笔记和题目逐渐转化为结构化知识，并通过 Wiki、双向链接、知识图谱和知识卡片，让个人知识网络持续生长。

当前 Demo 已完成 Raw → Draft → Knowledge → Relation → Graph 的 Phase 1 闭环，并加入了从 LLM Wiki 文章实例化出的首个可浏览 Wiki 结构。

## 快速开始

```bash
git clone https://github.com/3331060032guoyichen-oss/ai-notes_demo.git
cd ai-notes_demo
pnpm install
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY，见下方说明
pnpm dev
```

打开 http://localhost:3000。首次打开是空白状态（没有预置笔记），从左侧「新建笔记」开始即可：新建笔记 → AI 整理 → 确认入库 → 在知识库/图谱/Wiki 里查看。

> 注：clone 出来的目录名是 `ai-notes_demo`（取自仓库名）。如果你看到的本地副本叫 `ai-notes_demo-local`，那是**同一份代码**的另一个目录名，不影响命令。

没有配置 `DEEPSEEK_API_KEY` 时，除「AI 整理」外的其余功能（新建笔记、知识库、图谱、Wiki）都可以正常使用；点击「AI 整理」会返回明确的错误提示。详见 [`.env.example`](.env.example)。

## 未来计划

- 手写笔记数字化
- 图片 → Markdown
- Wiki 与双向链接
- 知识图谱
- 题目知识点分类
- 知识卡片
- AI 整理
- Learning Agent

## 技术栈

- Next.js 15（App Router）
- React 19
- TypeScript
- pnpm

样式为 `app/globals.css` 中的手写 CSS 与 CSS 自定义属性，未引入 CSS 框架或 UI 组件库。

## 项目结构

```text
app/          Next.js 应用入口与 API 路由
components/   可复用 UI 组件（当前为空）
lib/          存储层与 DeepSeek 服务边界
data/         本地开发数据与 Wiki 结构
public/       静态资源
types/        TypeScript 类型
docs/         产品、数据、设计与开发文档
```

## 开发分支

- `main`：稳定版本
- `develop-guozechen`：当前日常集成分支

详细规则请阅读 [`docs/`](docs/)。使用 AI 编码工具时，请先读 [`AGENTS.md`](AGENTS.md)。

## 许可证

本项目采用 [MIT License](LICENSE)。

