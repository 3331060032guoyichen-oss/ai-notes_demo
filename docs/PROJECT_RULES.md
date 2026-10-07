# Project Rules

## Long-term product direction

AI Notes 是面向大学生的生长式 AI 知识系统。它帮助用户将手写笔记、电子笔记和题目逐渐转化为结构化知识。

## 核心理念

原始学习内容经过 AI 理解、知识提取和 AI 提议后，必须由用户确认，再进入 Wiki、双向链接与知识网络。AI 辅助，用户拥有最终决定权。

## 四类节点（长期目标模型，当前未实现）

- `Note`：笔记
- `Question`：题目
- `Concept`：知识点
- `Card`：知识卡片

当前 Phase 1 实际落地的模型是 `Raw` / `Knowledge` / `KnowledgeRelation`（见 `DATA_MODEL.md`），尚未拆分为上述四类节点，不要假设它们已存在于代码中。

## AI 提议与确认

涉及知识结构变化的操作遵循“AI 提议 → 用户确认 → 写入知识网络”。原始数据不得被 AI 直接覆盖。

## Long-term Raw / Wiki model

Raw 保存原始图片、文本和上传文件；Wiki 保存整理后的 Note、Question、Concept 与 Card（长期目标）。Raw 必须保留并可追溯。当前实现中 Wiki 是只读演示层（`data/wiki.json`），尚未承载这四类节点。

## Phase 1 scope

Phase 1 先建立一条可验证的持久化闭环：用户输入文本，Raw 被保存并可读取，应用重启后仍可恢复。后续 Step 才会加入服务端 AI Draft、用户确认后的 Knowledge，以及可延后的 Relation、Backlink 和 Graph 展示。

### Completed Step

Step 1（Raw + Storage）已 PASS。当前实现支持文本 Raw 的创建与读取、输入校验、连续写入、文件缺失恢复、损坏存储失败后的继续写入和重启持久化。Raw 使用 `data/raw.json`，该运行时文件不进入 Git。

Step 2（DeepSeek + Structured Draft）已 PASS。服务端通过 `/api/organize` 按 `rawId` 读取 Raw，调用 DeepSeek，解析并校验结构化 `OrganizeDraft`，并在上游失败时保留 Raw。API Key 只从服务端环境变量读取。

Step 3（Draft Confirm + Knowledge Persistence）已 PASS。用户可以在页面查看并编辑 Draft，只有确认后才会创建 Knowledge。Knowledge 独立持久化并引用真实 `rawId`，重复确认不会创建重复记录；Draft 取消不会写入 Knowledge。页面视觉使用现有 Brandkit token 风格，不改变 Raw 主流程。

Step 4（Knowledge Relation）已 PASS。AI 可以提出已有 Knowledge 的关联建议，用户勾选后才会保存独立的 `related` Relation；服务端校验两端 ID、拒绝自连接，并对正反向关系去重。

Step 5（Backlink）已 PASS。Backlink 由当前 KnowledgeRelation 动态查询，不单独保存冗余表或字段；Relation 删除后查询结果会同步变化。

Step 6（Graph View）已 PASS。Graph 从当前 Knowledge 和 KnowledgeRelation 动态生成节点与边，节点可点击进入 Knowledge 详情；Graph 只是展示层，故障不会改变 Raw、Knowledge 或 Relation 的主流程。

Phase 1 全链路已完成真实验收：Raw → DeepSeek Draft → 用户编辑确认 → Knowledge → 用户接受 Relation → Backlink → Graph → Knowledge 详情，并验证了服务重启后的持久化。

Step 7（工作台改版）已 PASS。左侧导航改为 Raw / Knowledge / Wiki 文件树，点击条目以标签页在中间区域打开；新增 `PATCH /api/knowledge/:id` 支持标题右键改名、摘要/正文/概念内联编辑；新增 `POST /api/assistant`，AI 面板改为 `@` 提及式问答，服务端按引用重新读取真实内容再回答。详见 `AGENTS.md`。

### Not implemented in the current Phase 1 checkout

以下功能仍属于后续范围，当前不得假定已经存在：

- OCR、多模态输入、Agent、RAG、Embedding 和向量数据库

## Long-term MVP scope

校赛 MVP 规划包含 Wiki、WikiLink、Backlink、四类节点、图片转 Markdown、AI 整理与提议、用户确认、题目分类、知识关联和知识卡片。本次初始化不实现这些业务功能。

## UI 原则

界面应安静、自然、克制、内容优先，避免紫蓝渐变、霓虹、玻璃拟态和无意义特效。详细规范见 `DESIGN_SYSTEM.md`。
