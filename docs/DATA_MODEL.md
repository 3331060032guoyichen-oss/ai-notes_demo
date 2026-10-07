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

## Phase 1 transient Draft

Step 2 已实现 `OrganizeDraft` 作为服务端返回的临时结构。它由 `types/organize.ts` 定义，包含 `title`、`summary`、`content`、`keyPoints`、`concepts`、`keywords` 和 `relatedKnowledge`。Draft 当前不持久化，也不会自动创建 Knowledge。

`relatedKnowledge` 只能保留服务端确认存在的 Knowledge ID；没有可匹配的已有 Knowledge 时该数组返回为空。DeepSeek 失败或返回非法结构时，Raw 保持不变。

## Phase 1 Knowledge model

Step 3 已实现并持久化：

```text
Knowledge {
  id: string
  rawId: string
  title: string
  summary: string
  content: string
  keyPoints: string[]
  concepts: string[]
  keywords: string[]
  createdAt: string
  updatedAt: string
}
```

Knowledge 存储在 `data/knowledge.json`，必须引用真实 Raw。Draft 未确认前不会创建 Knowledge；同一个 `rawId` 重复确认会返回已有 Knowledge，不会重复写入。

## Phase 1 relation model

Step 4 已实现独立的 `KnowledgeRelation`：

```text
KnowledgeRelation {
  id: string
  sourceId: string
  targetId: string
  type: "related"
  reason: string
  createdAt: string
}
```

Relation 存储在 `data/relations.json`。`related` 是对称关系，服务端以无序 ID 对去重，要求两端 Knowledge 存在并拒绝自连接。Relation 只有用户接受 AI 建议或主动提交后才持久化；Graph 仍属于后续 Step。

## Phase 1 Backlink query

Step 5 已实现 Backlink 动态查询：`GET /api/knowledge/:id/backlinks` 根据当前 Relation 反查相关 Knowledge。Backlink 不单独存储，因此新增、删除或修改 Relation 后，查询结果直接反映最新状态。

Graph 只是 Relation 的展示层，不是新的数据源。

## Wiki structure derived from the LLM Wiki pattern

当前项目新增了一个只读的 Wiki 结构层，用于承载由来源持续综合出的页面，不替代 Raw：

```text
WikiPage {
  id: string
  title: string
  kind: overview | concept | architecture | workflow | reference | practice
  summary: string
  content: string
  tags: string[]
  parentId: string | null
  sourceRawId: string
  order: number
  createdAt: string
  updatedAt: string
}

WikiLink {
  id: string
  sourceId: string
  targetId: string
  type: contains | supports | operates_on | maintains | indexes | records | extends
  reason: string
}
```

`data/wiki.json` 是由 LLM Wiki 文章实例化出的第一组页面，当前覆盖总览、三层架构、Ingest、Query、Lint、Index / Log、人机分工和工具演进。每个页面都引用同一个不可变 Raw 来源。下一步再将该只读结构接入真正的 AI Ingest、Proposal 和用户确认流程。

## Phase 1 Graph view

Step 6 已实现 `GET /api/graph`，实时从 Knowledge 和 KnowledgeRelation 生成 `nodes` 与 `edges`。Graph 不创建独立数据源，也不写入 `graph.json`；节点详情仍从 Knowledge 查询。

## Long-term Raw 与标签

长期产品中的 Raw 可以扩展为图片、文本和上传文件，并与整理后的知识建立追溯关系。当前实现仅接受文本，因此不能按长期文件字段推断当前 Raw schema。标签是属性，默认不是图谱节点。
