# Project Rules

## 产品定位

AI Notes 是面向大学生的生长式 AI 知识系统。它帮助用户将手写笔记、电子笔记和题目逐渐转化为结构化知识。

## 核心理念

原始学习内容经过 AI 理解、知识提取和 AI 提议后，必须由用户确认，再进入 Wiki、双向链接与知识网络。AI 辅助，用户拥有最终决定权。

推理链路上有两条硬边界：

1. **Raw 不可覆盖**：AI 可以读、可以引用，但不能直接改写原始内容。
2. **AI 只提议**：涉及知识结构变化的操作，必须由用户确认后才写入。

## 四类节点（长期目标模型 —— 当前未实现）

> ⚠️ 下面四类节点是**目标设计**，当前代码中**不存在**。当前实际落地的模型是 `Raw` / `Knowledge` / `KnowledgeRelation` / `WikiPage`，映射关系见 `DATA_MODEL.md`。

- `Note`：笔记
- `Question`：题目
- `Concept`：知识点
- `Card`：知识卡片

## AI 提议与确认

涉及知识结构变化的操作遵循「AI 提议 → 用户确认 → 写入知识网络」。原始数据不得被 AI 直接覆盖。

当前实现用「AI 在 Draft 中给出建议 → 用户勾选 → 直接写入」做了**部分替代**；规划中的独立 `Proposal` 实体（`proposed` / `accepted` / `rejected` 三态）**尚未实现**。详见 `DATA_MODEL.md`。

## Raw / Wiki

Raw 保存原始图片、文本和上传文件；Wiki 保存整理后的内容。Raw 必须保留并可追溯。

长期目标是 Wiki 承载 `Note` / `Question` / `Concept` / `Card` 四类节点；**当前实现中 Wiki 只是一个只读的演示结构**（`data/wiki.json`，12 页面 / 14 条带类型的链接），尚未承载这四类节点。

## Phase 1 进展

Phase 1 建立了一条可验证的持久化闭环：用户输入文本 → Raw 保存 → AI 整理 Draft → 用户确认 → Knowledge → Relation → Backlink → Graph，并验证了服务重启后的持久化。

Step 1–7 的逐条验收记录见 `DEV_WORKFLOW.md` 的「Step gate」一节。

**当前仍未实现**（不得假定已存在）：OCR、多模态输入、Agent 工具调用、RAG、Embedding 和向量数据库。

## 当前规划：三条工作线

当前阶段按 `任务分工.docx` 组织，三条线各自分两个阶段。**各条线的完成度与缺口见 `ROADMAP.md`。**

### 1. 知识库和图谱

- 阶段一：笔记的建立 / 删除 / 修改；出链；反向链接（支持勾选内容建立链接）
- 阶段二：知识图谱，可视化笔记之间的链接

### 2. UI 界面

- 阶段一：首次滑动出现的边框（控制灵敏度），边框内的欢迎标语与进入窗口
- 阶段二：笔记界面美化（排版、鼠标触感）、两套主题

### 3. Skills 和插件

- 阶段一：agent 插件（连接 DeepSeek，调用其 API）
- 阶段二：OCR 图片转 Markdown、网页一键剪切

## UI 原则

界面应安静、自然、克制、内容优先，避免紫蓝渐变、霓虹、玻璃拟态和无意义特效。详细规范见 `DESIGN_SYSTEM.md`。

## 相关文档

- `ROADMAP.md` —— 目标 / 现状 / 差距对照，排期依据
- `DATA_MODEL.md` —— 长期模型与当前实现的映射
- `DESIGN_SYSTEM.md` —— 视觉规范
- `DEV_WORKFLOW.md` —— 分支与提交规范
- `THIRD_PARTY.md` —— 第三方依赖登记
