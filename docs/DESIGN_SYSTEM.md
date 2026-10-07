# Design System

## 去 AI 味原则

保持安静、自然、克制、有知识感和内容优先。避免赛博霓虹、紫蓝渐变、玻璃拟态、机器人插画和无意义粒子特效。AI 能力通过结果体现，而不是大量"AI"标签。

## Typography

使用清晰的 Display、Heading、Body、Secondary、Caption 层级，正文控制阅读宽度并保持合理行高，不滥用粗体或巨型标题。

## Layout

优先留白、分栏、列表、自然分组和弱边界。卡片仅用于独立信息或交互，不把所有内容都塞进卡片。

## Color

以中性色、一个主色、少量辅助色和状态色为主，颜色服务于信息层级、反馈和选择。

**当前实现**（`app/globals.css` 的 `:root`，改动配色时请同步本节与代码）：

```css
--paper: #f1eee8;        /* 米白纸感底色 */
--surface: #faf9f6;
--surface-raised: #fefdf9;
--ink: #27251f;          /* 墨色正文 */
--muted: #746e64;
--quiet: #938b7e;
--line: #ddd7cd;         /* 细边框 */
--line-strong: #c8c0b4;
--accent: #566b55;       /* 低饱和森林绿 —— 唯一主色 */
--accent-strong: #435642;
--accent-soft: #e5ebe1;
```

另有 `@media (prefers-color-scheme: dark)` 覆盖块提供深色模式（跟随系统自动切换，**尚无手动主题切换**）。

允许使用单色强调色；禁止的是**渐变**、霓虹发光和玻璃拟态 —— 尤其是紫蓝渐变这类"AI 视觉捷径"。

## Components

Button、Input、Navigation、Dialog、Dropdown、Tabs、Card、Tag、Toast、Empty State、Loading 等组件保持一致的间距、边框和交互状态。

当前所有组件都直接写在 `app/globals.css` 里（手写 CSS + CSS 变量），`components/` 目录是空的。**没有引入任何 UI 组件库或 CSS 框架。**

## Organic Knowledge Network

**目标**：知识图谱采用自然布局、局部知识簇和不同密度，支持聚焦、拖动、缩放和类型筛选，避免规则网格与高饱和噪音。

**当前实现与目标的差距（如实记录，避免文档与代码不一致）**：

`app/page.tsx` 的图谱视图用 `node-position-${index % 6}` 把节点排进一个**固定 6 槽位的规则网格**，节点是卡片按钮，**不画连线**，也不支持拖动、缩放或聚焦。

也就是说：**当前实现恰好是本节要求避免的"规则网格"**，这一节描述的是待实现目标，不是现状。相关排期见 `ROADMAP.md` 的 B1 项。

## Knowledge Growth 动画

启动动画概念为 Seed → Connect → Growth → Accelerate → Dive → Desk → Home。动画应帮助用户理解知识网络的生长，并由滚动控制节奏。

**当前未实现。** 另有规划中的"首次滑动出现边框 + 边框内欢迎窗口"，同样未实现（见 `ROADMAP.md` 的 C1 / C2）。
