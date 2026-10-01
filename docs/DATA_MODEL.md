# Data Model

## 核心节点

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

## Raw 与标签

Raw 保存 `rawId`、文件名、类型、原始路径和时间；Raw 不得被 Wiki 覆盖。标签是属性，默认不是图谱节点。
