# Project Rules

## 产品定位

AI Notes 是面向大学生的生长式 AI 知识系统。它帮助用户将手写笔记、电子笔记和题目逐渐转化为结构化知识。

## 核心理念

原始学习内容经过 AI 理解、知识提取和 AI 提议后，必须由用户确认，再进入 Wiki、双向链接与知识网络。AI 辅助，用户拥有最终决定权。

## 四类节点

- `Note`：笔记
- `Question`：题目
- `Concept`：知识点
- `Card`：知识卡片

## AI 提议与确认

涉及知识结构变化的操作遵循“AI 提议 → 用户确认 → 写入知识网络”。原始数据不得被 AI 直接覆盖。

## Raw / Wiki

Raw 保存原始图片、文本和上传文件；Wiki 保存整理后的 Note、Question、Concept 与 Card。Raw 必须保留并可追溯。

## MVP 范围

校赛 MVP 规划包含 Wiki、WikiLink、Backlink、四类节点、图片转 Markdown、AI 整理与提议、用户确认、题目分类、知识关联和知识卡片。本次初始化不实现这些业务功能。

## UI 原则

界面应安静、自然、克制、内容优先，避免紫蓝渐变、霓虹、玻璃拟态和无意义特效。详细规范见 `DESIGN_SYSTEM.md`。
