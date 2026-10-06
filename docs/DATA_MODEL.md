# Data Model

本文区分长期产品模型与当前 Phase 1 的实际持久化模型。长期模型不能被视为当前已经实现的 schema。

## Long-term product model

系统核心节点为 `Note`、`Question`、`Concept`、`Card`。每个节点至少包含 `id`、`type`、`title`、`content`、`tags`、`createdAt` 与 `updatedAt`。

## 节点初步定义

- **Note**：用户学习笔记，可来自手动输入、图片识别或 Markdown。
- **Question**：题目，包含学科、章节、题型、难度，并区分 `primaryConcept` 与 `relatedConcepts`。
- **Concept**：知识网络中的核心知识点，可拥有别名，用于匹配已有概念。
- **Card**：用于学习和复习的知识卡片，通常由 Concept、Note、Question 共同产生。

## Edge

边包含 `id`、`source`、`target`、`relation`、`createdAt`，关系可为 `contains`、`examines`、`related_to`、`explains`、`derived_from` 或 `references`。

## Proposal

AI 对知识关系的创建或修改先生成 Proposal，状态为 `proposed`、`accepted` 或 `rejected`。只有用户接受后才进入正式知识图谱。

## Phase 1 actual model

当前已完成的 Step 1 只持久化文本 Raw：

```text
Raw {
  id: string
  text: string
  createdAt: string
}
```

Raw 存储在本地运行时文件 `data/raw.json`，由 `lib/raw-storage.ts` 读写，并通过 `app/api/raw/route.ts` 提供创建和列表读取。Raw 创建成功后不会被 AI 或其他逻辑覆盖。

当前 Phase 1 尚未实现 `OrganizeDraft`、Knowledge、KnowledgeRelation、Backlink 或 Graph；这些模型属于后续 Step，不能当作现有数据库表或已持久化实体。

## Long-term Raw 与标签

长期产品中的 Raw 可以扩展为图片、文本和上传文件，并与整理后的知识建立追溯关系。当前实现仅接受文本，因此不能按长期文件字段推断当前 Raw schema。标签是属性，默认不是图谱节点。
