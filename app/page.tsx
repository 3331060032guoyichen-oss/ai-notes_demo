"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { GraphEdge, GraphNode } from "../types/graph";
import type { Knowledge } from "../types/knowledge";
import type { OrganizeDraft } from "../types/organize";
import type { Raw } from "../types/raw";
import type { WikiData, WikiPage } from "../types/wiki";

const MAX_RAW_LENGTH = 50_000;

type ViewKey = "new-note" | "raw-notes" | "knowledge" | "graph" | "today" | "study" | "lint";
type AiAction = "explain" | "concepts" | "cards" | "quiz" | "check" | "ask";

type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };
type KnowledgeListPayload = { knowledges?: Knowledge[] };
type GraphPayload = { nodes?: GraphNode[]; edges?: GraphEdge[] };
type WikiPayload = Partial<WikiData>;

const viewMeta: Record<ViewKey, { label: string; shortLabel: string }> = {
  "new-note": { label: "新建笔记", shortLabel: "新建" },
  "raw-notes": { label: "原始笔记", shortLabel: "原始" },
  knowledge: { label: "知识库", shortLabel: "知识" },
  graph: { label: "关系图谱", shortLabel: "图谱" },
  today: { label: "今日学习", shortLabel: "今天" },
  study: { label: "复习", shortLabel: "复习" },
  lint: { label: "知识检查", shortLabel: "检查" },
};

const directNavViews: ViewKey[] = ["new-note", "raw-notes", "knowledge", "graph"];
const pluginViews: ViewKey[] = ["today", "study", "lint"];

const wikiKindLabels: Record<WikiPage["kind"], string> = {
  overview: "总览",
  concept: "概念",
  architecture: "架构",
  workflow: "工作流",
  reference: "索引",
  practice: "实践",
};

function linesToArray(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPreview(text: string, length = 140) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length)}...` : normalized;
}

function getWikiDepth(page: WikiPage, pages: WikiPage[]) {
  let depth = 0;
  let parentId = page.parentId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = pages.find((candidate) => candidate.id === parentId)?.parentId ?? null;
  }

  return depth;
}

function AppLogo() {
  return <div className="app-logo" aria-label="AI Notes"><span className="logo-mark" aria-hidden="true">AN</span><span>AI Notes</span></div>;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warning" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state-block"><span className="empty-index" aria-hidden="true">01</span><div><h3>{title}</h3><p>{body}</p>{action ? <div className="empty-action">{action}</div> : null}</div></div>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewKey>("new-note");
  const [text, setText] = useState("");
  const [raws, setRaws] = useState<Raw[]>([]);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [wiki, setWiki] = useState<WikiData>({ pages: [], links: [] });
  const [selectedRawId, setSelectedRawId] = useState<string | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<Knowledge | null>(null);
  const [selectedWikiPageId, setSelectedWikiPageId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrganizeDraft | null>(null);
  const [draftRawId, setDraftRawId] = useState<string | null>(null);
  const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>([]);
  const [graphRefresh, setGraphRefresh] = useState(0);
  const [studyIndex, setStudyIndex] = useState(0);
  const [showStudyAnswer, setShowStudyAnswer] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organizingRawId, setOrganizingRawId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ raw: Raw; x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPageData() {
      try {
        const [rawResponse, knowledgeResponse, wikiResponse] = await Promise.all([
          fetch("/api/raw"),
          fetch("/api/knowledge"),
          fetch("/api/wiki"),
        ]);
        const rawPayload = (await rawResponse.json()) as { raws?: Raw[] };
        const knowledgePayload = (await knowledgeResponse.json()) as KnowledgeListPayload;
        const wikiPayload = (await wikiResponse.json()) as WikiPayload;

        if (!rawResponse.ok || !knowledgeResponse.ok || !wikiResponse.ok) throw new Error("读取失败");
        if (!active) return;

        const nextRaws = rawPayload.raws ?? [];
        const nextWikiPages = wikiPayload.pages ?? [];
        setRaws(nextRaws);
        setKnowledges(knowledgePayload.knowledges ?? []);
        setWiki({ pages: nextWikiPages, links: wikiPayload.links ?? [] });
        setSelectedRawId((current) => current ?? nextRaws[0]?.id ?? null);
        setSelectedWikiPageId((current) => current ?? nextWikiPages[0]?.id ?? null);
      } catch {
        if (active) setError("暂时无法读取已保存的内容。");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadPageData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadGraph() {
      try {
        const response = await fetch("/api/graph");
        const payload = (await response.json()) as GraphPayload;
        if (!response.ok) throw new Error("Graph 读取失败");
        if (active) setGraph({ nodes: payload.nodes ?? [], edges: payload.edges ?? [] });
      } catch {
        if (active) setError("知识网络暂时无法读取，其他学习流程仍可继续。");
      }
    }

    void loadGraph();
    return () => { active = false; };
  }, [graphRefresh]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("click", closeContextMenu);
    window.addEventListener("blur", closeContextMenu);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("blur", closeContextMenu);
    };
  }, [contextMenu]);

  const selectedRaw = raws.find((raw) => raw.id === selectedRawId) ?? raws[0] ?? null;
  const selectedWikiPage = wiki.pages.find((page) => page.id === selectedWikiPageId) ?? wiki.pages[0] ?? null;
  const pendingRaws = raws.filter((raw) => !knowledges.some((knowledge) => knowledge.rawId === raw.id));
  const studyTarget = selectedKnowledge ?? knowledges[0] ?? null;
  const studyPoints = studyTarget?.keyPoints.length ? studyTarget.keyPoints : studyTarget ? [studyTarget.summary] : [];
  const currentStudyPoint = studyPoints[studyIndex % Math.max(studyPoints.length, 1)] ?? "先确认一条知识，再开始复习。";

  const lintItems = useMemo(() => {
    const items: { title: string; body: string; tone: "warning" | "neutral" }[] = [];
    knowledges.forEach((knowledge) => {
      const hasRelation = graph.edges.some((edge) => edge.source === knowledge.id || edge.target === knowledge.id);
      if (!raws.some((raw) => raw.id === knowledge.rawId)) {
        items.push({ title: `${knowledge.title} 缺少原始来源`, body: "知识页引用的 Raw 当前无法读取。", tone: "warning" });
      } else if (!hasRelation && knowledges.length > 1) {
        items.push({ title: `${knowledge.title} 尚未连接`, body: "它还没有和其他 Knowledge 建立关系。", tone: "neutral" });
      }
    });
    if (items.length === 0) items.push({ title: "当前没有明显问题", body: "新增知识后，检查会根据真实来源和关系继续更新。", tone: "neutral" });
    return items;
  }, [graph.edges, knowledges, raws]);

  const linkedWikiPages = selectedWikiPage
    ? wiki.links
        .filter((link) => link.sourceId === selectedWikiPage.id || link.targetId === selectedWikiPage.id)
        .map((link) => link.sourceId === selectedWikiPage.id ? link.targetId : link.sourceId)
        .map((id) => wiki.pages.find((page) => page.id === id))
        .filter((page): page is WikiPage => Boolean(page))
    : [];

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function navigate(view: ViewKey) {
    setActiveView(view);
    setMobileNavOpen(false);
    clearFeedback();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!text.trim()) {
      setError("请先输入学习内容。");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as { raw?: Raw; error?: { message?: string } };
      if (!response.ok || !payload.raw) throw new Error(payload.error?.message ?? "保存失败");
      setRaws((current) => [payload.raw!, ...current]);
      setSelectedRawId(payload.raw.id);
      setText("");
      setNotice("原始笔记已保存。它仍然保持不变，下一步可以请求 AI 整理。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "暂时无法保存原始笔记。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteRaw(raw: Raw) {
    setContextMenu(null);
    if (!window.confirm(`确定删除这条原始笔记吗？\n\n${getPreview(raw.text, 100)}`)) return;

    clearFeedback();
    try {
      const response = await fetch("/api/raw", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawId: raw.id }),
      });
      const payload = (await response.json()) as { deleted?: Raw; error?: { message?: string } };
      if (!response.ok || !payload.deleted) throw new Error(payload.error?.message ?? "删除失败");
      setRaws((current) => current.filter((item) => item.id !== raw.id));
      setSelectedRawId((current) => current === raw.id ? null : current);
      setNotice("原始笔记已删除。");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "暂时无法删除原始笔记。");
    }
  }

  async function handleOrganize(rawId: string) {
    clearFeedback();
    setSelectedRawId(rawId);
    setDraft(null);
    setDraftRawId(rawId);
    setSelectedRelationIds([]);
    setOrganizingRawId(rawId);
    setActiveView("raw-notes");

    try {
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawId }),
      });
      const payload = (await response.json()) as { draft?: OrganizeDraft; error?: { message?: string } };
      if (!response.ok || !payload.draft) throw new Error(payload.error?.message ?? "整理失败");
      setDraft(payload.draft);
      setAiAction("concepts");
      setAiMessage("Draft 已生成。请逐项检查，再决定哪些内容进入知识库。");
      setNotice("Draft 已生成，请检查并编辑后再确认保存。");
    } catch (organizeError) {
      setDraftRawId(null);
      setError(organizeError instanceof Error ? organizeError.message : "暂时无法生成 Draft。");
    } finally {
      setOrganizingRawId(null);
    }
  }

  async function handleConfirm() {
    if (!draft || !draftRawId) return;
    clearFeedback();
    setIsConfirming(true);

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawId: draftRawId, draft }),
      });
      const payload = (await response.json()) as { knowledge?: Knowledge; created?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.knowledge) throw new Error(payload.error?.message ?? "确认保存失败");

      for (const suggestion of draft.relatedKnowledge) {
        if (!selectedRelationIds.includes(suggestion.knowledgeId)) continue;
        const relationResponse = await fetch("/api/relations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: payload.knowledge.id, targetId: suggestion.knowledgeId, type: "related", reason: suggestion.reason }),
        });
        const relationPayload = (await relationResponse.json()) as { error?: { message?: string } };
        if (!relationResponse.ok) throw new Error(relationPayload.error?.message ?? "关系保存失败");
      }

      if (payload.created) {
        setKnowledges((current) => [payload.knowledge!, ...current]);
        setSelectedKnowledge(payload.knowledge);
        setNotice("已确认并保存为 Knowledge。现在可以进入复习或查看关系。");
      } else {
        setNotice("这个 Raw 已经确认过，未创建重复 Knowledge。");
      }
      setDraft(null);
      setDraftRawId(null);
      setSelectedRelationIds([]);
      setGraphRefresh((current) => current + 1);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "暂时无法保存 Knowledge。");
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleGraphNodeClick(nodeId: string) {
    clearFeedback();
    try {
      const response = await fetch(`/api/knowledge/${nodeId}`);
      const payload = (await response.json()) as { knowledge?: Knowledge };
      if (!response.ok || !payload.knowledge) throw new Error("读取失败");
      setSelectedKnowledge(payload.knowledge);
      setActiveView("knowledge");
    } catch {
      setError("暂时无法读取该 Knowledge 详情。");
    }
  }

  function runAiAction(action: AiAction) {
    setAiAction(action);
    const targetTitle = selectedKnowledge?.title
      ? getPreview(selectedKnowledge.title, 42)
      : selectedRaw
        ? getPreview(selectedRaw.text, 42)
        : "当前页面";
    const messages: Record<AiAction, string> = {
      explain: `可以围绕「${targetTitle}」解释关键概念。当前版本会保留在右侧作为操作入口，具体回答需要接入 Tutor 服务。`,
      concepts: draft ? "Draft 已经准备好。请在中央区域审阅标题、摘要和概念，再确认写入。" : `已聚焦「${targetTitle}」。下一步可以从当前来源生成一个可审阅的 Draft。`,
      cards: "学习卡片会先进入待确认状态，不会直接写入知识库。当前版本保留生成入口和审核位置。",
      quiz: "小测验会围绕当前 Knowledge 生成，并在每个答案旁显示来源。当前版本保留学习流程骨架。",
      check: `已准备检查「${targetTitle}」的来源、关联和可能的孤立状态。请打开知识检查查看真实结果。`,
      ask: aiQuestion.trim() ? `已记录你的问题：「${aiQuestion.trim()}」。回答应以当前页面和来源为上下文。` : "先输入一个问题，再让 AI 围绕当前内容回答。",
    };
    setAiMessage(messages[action]);
    if (action === "check") navigate("lint");
  }

  function renderCaptureForm() {
    return <form className="capture-panel" onSubmit={handleSubmit}>
      <div className="section-topline"><span>新建笔记</span><StatusPill>Raw 不可变</StatusPill></div>
      <label htmlFor="raw-text">把还没有整理的内容放在这里</label>
      <textarea id="raw-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_RAW_LENGTH} placeholder="课堂笔记、阅读摘录或待整理的问题" rows={8} />
      <div className="capture-footer"><span>{text.length.toLocaleString()} / {MAX_RAW_LENGTH.toLocaleString()}</span><button className="button-dark" type="submit" disabled={isSaving}>{isSaving ? "保存中" : "保存笔记"}</button></div>
    </form>;
  }

  function renderNewNote() {
    return <>
      <header className="workspace-heading compact-heading"><div><p className="eyebrow">新建笔记</p><h1>把想法先留下。</h1><p>先保存原始笔记，再决定哪些内容值得进入知识库。</p></div><StatusPill tone="accent">目录 01</StatusPill></header>
      {renderCaptureForm()}
      <section className="content-section"><div className="section-heading-inline"><div><h2>最近原始笔记</h2><p>新建完成后，笔记会出现在原始笔记目录。</p></div><button className="text-button" type="button" onClick={() => navigate("raw-notes")}>查看全部 ↗</button></div>{raws.length === 0 ? <EmptyState title="还没有笔记" body="保存第一条学习内容，开始建立你的知识库。" /> : <div className="mini-note-list">{raws.slice(0, 3).map((raw) => <button className="mini-note-row" type="button" key={raw.id} onClick={() => { setSelectedRawId(raw.id); navigate("raw-notes"); }}><span>{getPreview(raw.text, 86)}</span><small>{formatDate(raw.createdAt)}</small></button>)}</div>}</section>
    </>;
  }

  function renderDraftReview() {
    if (!draft) return null;
    const draftRaw = raws.find((raw) => raw.id === draftRawId);

    return <section className="review-surface" aria-labelledby="draft-title">
      <div className="review-header"><div><p className="eyebrow">需要确认</p><h2 id="draft-title">Draft 编辑</h2><p>AI 已经提炼了一个版本。你的确认决定它是否进入 Knowledge。</p></div><StatusPill tone="warning">尚未写入</StatusPill></div>
      <div className="source-trace"><span>来源 Raw</span><strong>{draftRaw ? getPreview(draftRaw.text, 88) : "当前来源"}</strong></div>
      <div className="review-fields">
        <div className="field-block"><label htmlFor="draft-heading">标题</label><input id="draft-heading" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
        <div className="field-block"><label htmlFor="draft-summary">摘要</label><textarea id="draft-summary" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} rows={3} /></div>
        <div className="field-block"><label htmlFor="draft-content">正文</label><textarea id="draft-content" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={8} /></div>
      </div>
      <div className="review-columns">
        <div className="field-block"><label htmlFor="draft-key-points">关键点，每行一项</label><textarea id="draft-key-points" value={draft.keyPoints.join("\n")} onChange={(event) => setDraft({ ...draft, keyPoints: linesToArray(event.target.value) })} rows={5} /></div>
        <div className="field-block"><label htmlFor="draft-concepts">概念，每行一项</label><textarea id="draft-concepts" value={draft.concepts.join("\n")} onChange={(event) => setDraft({ ...draft, concepts: linesToArray(event.target.value) })} rows={5} /></div>
        <div className="field-block"><label htmlFor="draft-keywords">关键词，每行一项</label><textarea id="draft-keywords" value={draft.keywords.join("\n")} onChange={(event) => setDraft({ ...draft, keywords: linesToArray(event.target.value) })} rows={5} /></div>
      </div>
      {draft.relatedKnowledge.length > 0 ? <fieldset className="relation-suggestions"><legend>相关 Knowledge 建议</legend>{draft.relatedKnowledge.map((suggestion) => <label className="relation-option" key={suggestion.knowledgeId}><input type="checkbox" checked={selectedRelationIds.includes(suggestion.knowledgeId)} onChange={(event) => setSelectedRelationIds((current) => event.target.checked ? [...current, suggestion.knowledgeId] : current.filter((id) => id !== suggestion.knowledgeId))} /><span><strong>{suggestion.knowledgeId}</strong><small>{suggestion.reason}</small></span></label>)}</fieldset> : <p className="muted-note">当前没有可确认的 Knowledge 关联建议。关系可以在后续检查中单独处理。</p>}
      <div className="review-actions"><button className="button-dark" type="button" onClick={() => void handleConfirm()} disabled={isConfirming}>{isConfirming ? "确认中" : "确认并保存 Knowledge"}</button><button className="button-secondary" type="button" onClick={() => { setDraft(null); setDraftRawId(null); setSelectedRelationIds([]); setNotice("Draft 已取消，尚未创建 Knowledge。"); }} disabled={isConfirming}>取消</button></div>
    </section>;
  }

  function renderRawNotes() {
    return <>
      <header className="workspace-heading compact-heading"><div><p className="eyebrow">原始笔记</p><h1>保留每一次输入。</h1><p>原始笔记不会被 AI 覆盖，整理和确认都从这里开始。</p></div><button className="button-primary" type="button" onClick={() => navigate("new-note")}>新建笔记</button></header>
      {draft ? renderDraftReview() : null}
      <section className="content-section" aria-labelledby="raw-list-title">
        <div className="section-heading-inline"><div><h2 id="raw-list-title">全部原始笔记</h2><p>右键一条未进入 Knowledge 的笔记，可以将它删除。</p></div><span className="section-count">{raws.length}</span></div>
        {isLoading ? <div className="skeleton-list"><span /><span /><span /></div> : raws.length === 0 ? <EmptyState title="还没有原始笔记" body="从目录 01 新建第一条笔记。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} /> : <div className="source-list">{raws.map((raw) => {
          const knowledge = knowledges.find((item) => item.rawId === raw.id);
          return <article className={`source-row${selectedRaw?.id === raw.id ? " is-selected" : ""}`} key={raw.id} onClick={() => setSelectedRawId(raw.id)} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ raw, x: event.clientX, y: event.clientY }); }}>
            <div className="source-row-main"><div className="source-row-meta"><span>{formatDate(raw.createdAt)}</span>{knowledge ? <StatusPill tone="accent">已入库</StatusPill> : <StatusPill>待整理</StatusPill>}</div><h3>{getPreview(raw.text, 96)}</h3><p>{getPreview(raw.text, 190)}</p></div>
            <div className="source-row-action">{knowledge ? <button className="text-button" type="button" onClick={(event) => { event.stopPropagation(); setSelectedKnowledge(knowledge); navigate("knowledge"); }}>打开知识</button> : <button className="button-secondary" type="button" onClick={(event) => { event.stopPropagation(); void handleOrganize(raw.id); }} disabled={organizingRawId !== null}>{organizingRawId === raw.id ? "整理中" : "AI 整理"}</button>}</div>
          </article>;
        })}</div>}
      </section>
    </>;
  }

  function renderKnowledge() {
    const detail = selectedKnowledge ?? knowledges[0] ?? null;
    return <>
      <header className="workspace-heading compact-heading"><div><p className="eyebrow">知识库</p><h1>理解需要被重新找到。</h1><p>每条 Knowledge 都保留来源、概念和与其他知识的关系。</p></div><StatusPill tone="accent">{knowledges.length} 条已确认</StatusPill></header>
      <div className="knowledge-workspace"><aside className="knowledge-index" aria-label="Knowledge 列表"><div className="index-heading"><span>全部 Knowledge</span><span>{knowledges.length}</span></div>{knowledges.length === 0 ? <p className="muted-note">确认 Draft 后，知识会出现在这里。</p> : knowledges.map((knowledge) => <button className={`index-item${detail?.id === knowledge.id ? " is-selected" : ""}`} type="button" key={knowledge.id} onClick={() => setSelectedKnowledge(knowledge)}><span><strong>{knowledge.title}</strong><small>{getPreview(knowledge.summary, 70)}</small></span><span aria-hidden="true">↗</span></button>)}</aside><article className="knowledge-reading">{detail ? <><div className="reading-meta"><StatusPill tone="accent">已确认</StatusPill><span>更新于 {formatDate(detail.updatedAt)}</span></div><h2>{detail.title}</h2><p className="reading-summary">{detail.summary}</p><div className="reading-content">{detail.content}</div><div className="tag-row">{detail.concepts.map((concept) => <span className="tag" key={concept}>{concept}</span>)}</div><div className="source-reference"><span className="item-kicker">SOURCE</span><strong>{raws.find((raw) => raw.id === detail.rawId) ? getPreview(raws.find((raw) => raw.id === detail.rawId)!.text, 150) : "来源暂不可用"}</strong><button className="text-button" type="button" onClick={() => { setSelectedRawId(detail.rawId); navigate("raw-notes"); }}>回到原始笔记 ↗</button></div><div className="backlink-section"><div className="section-heading-inline"><h3>相关关系</h3><button className="text-button" type="button" onClick={() => navigate("graph")}>查看图谱</button></div>{graph.edges.filter((edge) => edge.source === detail.id || edge.target === detail.id).length > 0 ? <div className="relation-list">{graph.edges.filter((edge) => edge.source === detail.id || edge.target === detail.id).map((edge) => <div className="relation-row" key={edge.id}><span>{edge.source === detail.id ? edge.target : edge.source}</span><small>{edge.reason}</small></div>)}</div> : <p className="muted-note">这条知识还没有关联对象。</p>}</div></> : <EmptyState title="还没有知识页" body="去原始笔记确认一条 Draft，建立第一条 Knowledge。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} />}</article></div>
      <section className="content-section wiki-section" aria-labelledby="wiki-title"><div className="section-heading-inline"><div><h2 id="wiki-title">Wiki 结构</h2><p>来自原始文章的可导航知识层，保持与 Raw 的追溯关系。</p></div><StatusPill>{wiki.pages.length} 个页面</StatusPill></div>{wiki.pages.length === 0 ? <EmptyState title="还没有 Wiki 页面" body="先载入一份来源，再建立结构化页面。" /> : <div className="wiki-layout"><nav className="wiki-tree" aria-label="Wiki 页面目录">{wiki.pages.map((page) => <button className={`wiki-tree-item${selectedWikiPage?.id === page.id ? " is-selected" : ""}`} key={page.id} type="button" style={{ paddingLeft: `${12 + getWikiDepth(page, wiki.pages) * 16}px` }} onClick={() => setSelectedWikiPageId(page.id)}><span>{page.title}</span><small>{wikiKindLabels[page.kind]}</small></button>)}</nav>{selectedWikiPage ? <article className="wiki-reading"><div className="reading-meta"><StatusPill tone="accent">{wikiKindLabels[selectedWikiPage.kind]}</StatusPill><span>{selectedWikiPage.tags.join(" / ")}</span></div><h3>{selectedWikiPage.title}</h3><p className="reading-summary">{selectedWikiPage.summary}</p><div className="reading-content">{selectedWikiPage.content}</div>{linkedWikiPages.length > 0 ? <div className="backlink-section"><h4>关联页面</h4><div className="tag-row">{linkedWikiPages.map((page) => <button className="tag tag-button" type="button" key={page.id} onClick={() => setSelectedWikiPageId(page.id)}>{page.title}</button>)}</div></div> : null}</article> : null}</div>}</section>
    </>;
  }

  function renderToday() {
    const focusKnowledge = selectedKnowledge ?? knowledges[0] ?? null;
    return <>
      <header className="workspace-heading"><div><p className="eyebrow">插件 · 今日学习</p><h1>让下一步变得清楚。</h1><p>从一条原始笔记开始，逐步把理解沉淀成可以复习的知识。</p></div><button className="button-primary" type="button" onClick={() => navigate("new-note")}>新建笔记</button></header>
      <div className="today-grid"><section className="focus-card" aria-labelledby="focus-title"><div className="section-topline"><span>继续学习</span><StatusPill tone="accent">插件运行中</StatusPill></div><h2 id="focus-title">{selectedRaw ? "把一份笔记整理成 Draft" : "从第一份笔记开始"}</h2><p>{selectedRaw ? getPreview(selectedRaw.text, 220) : "保存课堂笔记、阅读摘录或待整理的问题，原始内容会被完整保留。"}</p><div className="focus-meta"><span>{selectedRaw ? formatDate(selectedRaw.createdAt) : "还没有 Raw"}</span><span>{pendingRaws.length} 份待整理</span></div><button className="button-dark" type="button" onClick={() => selectedRaw ? void handleOrganize(selectedRaw.id) : navigate("new-note")} disabled={Boolean(selectedRaw && organizingRawId)}>{selectedRaw && organizingRawId === selectedRaw.id ? "整理中" : selectedRaw ? "请求 AI 整理" : "新建第一条笔记"}</button></section><section className="review-card" aria-labelledby="review-title"><div className="section-topline"><span id="review-title">需要你的判断</span><strong>{pendingRaws.length}</strong></div>{pendingRaws.length > 0 ? <div className="compact-list">{pendingRaws.slice(0, 3).map((raw) => <button className="compact-list-item" type="button" key={raw.id} onClick={() => { setSelectedRawId(raw.id); navigate("raw-notes"); }}><span><strong>{getPreview(raw.text, 58)}</strong><small>{formatDate(raw.createdAt)}</small></span><span className="list-arrow" aria-hidden="true">↗</span></button>)}</div> : <EmptyState title="没有待处理内容" body="确认一条 Draft 后，它会成为可复用的 Knowledge。" />}</section></div>
      <section className="dashboard-shelf" aria-labelledby="shelf-title"><div className="section-heading-inline"><h2 id="shelf-title">最近建立的理解</h2><button className="text-button" type="button" onClick={() => navigate("knowledge")}>查看知识库</button></div><div className="shelf-grid"><div className="shelf-column">{focusKnowledge ? <button className="knowledge-preview" type="button" onClick={() => { setSelectedKnowledge(focusKnowledge); navigate("knowledge"); }}><span className="item-kicker">KNOWLEDGE</span><strong>{focusKnowledge.title}</strong><p>{getPreview(focusKnowledge.summary, 150)}</p><span className="preview-link">打开知识页 ↗</span></button> : <EmptyState title="知识库还很轻" body="确认第一条 Draft 后，这里会出现你的知识页。" action={<button className="button-secondary" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} />}</div><div className="shelf-column wiki-preview"><div className="item-kicker">WIKI STRUCTURE</div><strong>{wiki.pages.length} 个持续维护的页面</strong><p>{selectedWikiPage ? selectedWikiPage.summary : "Wiki 会把来源整理为可导航的页面结构。"}</p><button className="text-button" type="button" onClick={() => navigate("knowledge")}>浏览知识结构</button></div></div></section>
    </>;
  }

  function renderStudy() {
    return <><header className="workspace-heading compact-heading"><div><p className="eyebrow">插件 · 复习</p><h1>把知识说给自己听。</h1><p>从已经确认的 Knowledge 开始，用主动回忆检查理解。</p></div><StatusPill tone="accent">插件运行中</StatusPill></header>{!studyTarget ? <EmptyState title="还没有可复习的知识" body="先在原始笔记中确认一条 Draft，再回到这里练习。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} /> : <div className="study-layout"><section className="study-card"><div className="study-card-top"><span>主动回忆</span><span>{studyIndex + 1} / {studyPoints.length}</span></div><p className="study-context">来自 {studyTarget.title}</p><h2>请用自己的话解释：</h2><h3>{currentStudyPoint}</h3>{showStudyAnswer ? <div className="study-answer"><span className="item-kicker">参考理解</span><p>{studyTarget.summary}</p><button className="text-button" type="button" onClick={() => { setSelectedKnowledge(studyTarget); navigate("knowledge"); }}>查看完整知识页 ↗</button></div> : <button className="button-dark" type="button" onClick={() => setShowStudyAnswer(true)}>显示参考理解</button>}<div className="study-actions"><button className="button-secondary" type="button" onClick={() => { setStudyIndex((current) => (current + 1) % Math.max(studyPoints.length, 1)); setShowStudyAnswer(false); }}>换一个概念</button><button className="text-button" type="button" onClick={() => runAiAction("quiz")}>生成小测验</button></div></section><aside className="study-side"><div className="item-kicker">当前知识</div><h3>{studyTarget.title}</h3><p>{getPreview(studyTarget.content, 210)}</p><div className="study-side-row"><span>概念</span><strong>{studyTarget.concepts.length}</strong></div><div className="study-side-row"><span>来源</span><button className="text-button" type="button" onClick={() => { setSelectedRawId(studyTarget.rawId); navigate("raw-notes"); }}>查看原始笔记</button></div></aside></div>}</>;
  }

  function renderGraph() {
    return <><header className="workspace-heading compact-heading"><div><p className="eyebrow">关系图谱</p><h1>看见知识如何连接。</h1><p>图谱只使用真实 Knowledge 和 Relation，不生成装饰性节点。</p></div><button className="button-secondary" type="button" onClick={() => setGraphRefresh((current) => current + 1)}>刷新网络</button></header>{graph.nodes.length === 0 ? <EmptyState title="关系图谱还没有节点" body="确认 Knowledge 后，真实节点会从这里开始生长。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} /> : <div className="graph-workspace"><section className="network-map" aria-label="Knowledge 节点地图">{graph.nodes.map((node, index) => <button className={`network-node node-position-${index % 6}`} type="button" key={node.id} onClick={() => void handleGraphNodeClick(node.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{node.title}</strong><small>打开知识页</small></button>)}</section><section className="edge-list"><div className="section-heading-inline"><h2>关系</h2><span className="section-count">{graph.edges.length}</span></div>{graph.edges.length === 0 ? <p className="muted-note">当前没有 related 关系。可以在 Draft 审阅时接受关系建议。</p> : graph.edges.map((edge) => <div className="edge-row" key={edge.id}><div><strong>{edge.source.slice(-8)}</strong><span>↔</span><strong>{edge.target.slice(-8)}</strong></div><p>{edge.reason}</p></div>)}</section></div>}</>;
  }

  function renderLint() {
    return <><header className="workspace-heading compact-heading"><div><p className="eyebrow">插件 · 知识检查</p><h1>让知识库保持可解释。</h1><p>检查来源、连接和可继续处理的问题，所有结果都来自当前真实数据。</p></div><StatusPill tone={lintItems.some((item) => item.tone === "warning") ? "warning" : "accent"}>插件运行中</StatusPill></header><section className="lint-list">{lintItems.map((item, index) => <article className={`lint-row lint-${item.tone}`} key={`${item.title}-${index}`}><span className="lint-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{item.title}</h2><p>{item.body}</p></div><button className="text-button" type="button" onClick={() => item.tone === "warning" ? navigate("knowledge") : navigate("graph")}>{item.tone === "warning" ? "查看知识" : "查看关系"} ↗</button></article>)}</section><section className="lint-note"><div className="item-kicker">检查边界</div><p>Lint 当前只读真实来源和关系。它不会自动修改任何 Raw 或 Knowledge。</p></section></>;
  }

  function renderMainContent() {
    switch (activeView) {
      case "new-note": return renderNewNote();
      case "raw-notes": return renderRawNotes();
      case "knowledge": return renderKnowledge();
      case "graph": return renderGraph();
      case "today": return renderToday();
      case "study": return renderStudy();
      case "lint": return renderLint();
    }
  }

  const focusLabel = selectedKnowledge?.title
    ? getPreview(selectedKnowledge.title, 62)
    : selectedRaw
      ? getPreview(selectedRaw.text, 62)
      : viewMeta[activeView].label;

  return <main className="app-shell">
    <div className="mobile-topbar"><button className="mobile-menu-button" type="button" onClick={() => setMobileNavOpen((current) => !current)} aria-expanded={mobileNavOpen} aria-controls="workspace-nav">菜单</button><AppLogo /><button className="mobile-new-button" type="button" onClick={() => navigate("new-note")}>新建</button></div>
    <aside id="workspace-nav" className={`workspace-sidebar${mobileNavOpen ? " is-open" : ""}`}>
      <div className="sidebar-top"><AppLogo /><button className="workspace-switcher" type="button"><span className="workspace-avatar">G</span><span><strong>个人学习空间</strong><small>本地工作区</small></span><span aria-hidden="true">⌄</span></button><button className="new-source-button" type="button" onClick={() => navigate("new-note")}><span aria-hidden="true">+</span> 新建笔记</button></div>
      <nav className="primary-nav" aria-label="主目录">{directNavViews.map((view, index) => <button className={`nav-item${activeView === view ? " is-active" : ""}`} key={view} type="button" onClick={() => navigate(view)} aria-current={activeView === view ? "page" : undefined}><span className="nav-label"><span className="nav-index">{String(index + 1).padStart(2, "0")}</span>{viewMeta[view].label}</span>{view === "raw-notes" && pendingRaws.length > 0 ? <span className="nav-count">{pendingRaws.length}</span> : view === "knowledge" ? <span className="nav-count">{knowledges.length}</span> : null}</button>)}</nav>
      <div className="sidebar-section plugin-section"><div className="plugin-heading"><span className="sidebar-label">插件</span><span className="plugin-count">{pluginViews.length}</span></div>{pluginViews.map((view) => <button className={`plugin-item${activeView === view ? " is-active" : ""}`} key={view} type="button" onClick={() => navigate(view)}><span className="plugin-symbol" aria-hidden="true">{view === "today" ? "T" : view === "study" ? "R" : "L"}</span><span>{viewMeta[view].label}</span><span className="plugin-arrow" aria-hidden="true">↗</span></button>)}</div>
      <div className="sidebar-section"><span className="sidebar-label">最近访问</span>{selectedKnowledge ? <button className="recent-link" type="button" onClick={() => navigate("knowledge")}>{getPreview(selectedKnowledge.title, 26)}</button> : null}{selectedWikiPage ? <button className="recent-link" type="button" onClick={() => { setSelectedWikiPageId(selectedWikiPage.id); navigate("knowledge"); }}>{getPreview(selectedWikiPage.title, 26)}</button> : null}{!selectedKnowledge && !selectedWikiPage ? <p className="sidebar-empty">处理一条笔记后，这里会出现最近访问。</p> : null}</div>
      <div className="sidebar-bottom"><div className="data-status"><span className="status-dot" aria-hidden="true" /><span><strong>本地数据正常</strong><small>Raw 与 Knowledge 已连接</small></span></div><span className="sidebar-version">AI Notes</span></div>
    </aside>
    <section className="workspace-main"><div className="workspace-topbar"><div className="breadcrumb"><span>AI Notes</span><span aria-hidden="true">/</span><strong>{viewMeta[activeView].label}</strong></div><div className="topbar-actions"><span className="topbar-status"><span className="status-dot" aria-hidden="true" />本地工作区</span><button className="avatar-button" type="button" aria-label="打开个人菜单">G</button></div></div><div className="workspace-content"><div className="main-column">{error ? <div className="feedback-banner error-message" role="alert">{error}</div> : null}{notice ? <div className="feedback-banner notice-message" aria-live="polite">{notice}</div> : null}{renderMainContent()}</div></div></section>
    <aside className="ai-rail" aria-label="上下文 AI 面板"><div className="ai-rail-header"><div><span className="item-kicker">CONTEXT AI</span><h2>上下文 AI</h2></div><span className="ai-signal">辅助</span></div><div className="ai-context"><span className="item-kicker">当前焦点</span><strong>{focusLabel}</strong><p>建议会围绕当前资料和知识页展开。</p></div><div className="ai-actions"><button type="button" onClick={() => runAiAction("explain")}>解释当前内容</button><button type="button" onClick={() => runAiAction("concepts")}>提炼关键概念</button><button type="button" onClick={() => runAiAction("cards")}>生成学习卡片</button><button type="button" onClick={() => runAiAction("quiz")}>生成小测验</button><button type="button" onClick={() => runAiAction("check")}>检查知识状态</button></div><div className={`ai-result${aiMessage ? " has-result" : ""}`} aria-live="polite"><div className="ai-result-label"><span>AI 提议</span>{aiAction ? <StatusPill>{aiAction === "ask" ? "问题" : "待确认"}</StatusPill> : null}</div><p>{aiMessage || "选择一个操作，AI 会在这里提出下一步。结果不会自动写入知识库。"}</p>{aiMessage ? <div className="ai-result-actions"><button className="text-button" type="button" onClick={() => setAiMessage("")}>清除</button><button className="text-button" type="button" onClick={() => navigate("raw-notes")}>去审阅 ↗</button></div> : null}</div><form className="ai-ask" onSubmit={(event) => { event.preventDefault(); runAiAction("ask"); }}><label htmlFor="ai-question">问当前内容</label><div className="ai-input-row"><input id="ai-question" value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="例如：它和什么有关" /><button type="submit" aria-label="提交问题">↗</button></div></form><div className="ai-trace"><span className="status-dot" aria-hidden="true" />AI 输出需要你的确认</div></aside>
    <nav className="mobile-bottom-nav" aria-label="移动端导航">{directNavViews.map((view) => <button className={activeView === view ? "is-active" : ""} type="button" key={view} onClick={() => navigate(view)}><span>{viewMeta[view].shortLabel}</span>{view === "raw-notes" && pendingRaws.length > 0 ? <small>{pendingRaws.length}</small> : null}</button>)}<button className={pluginViews.includes(activeView) ? "is-active" : ""} type="button" onClick={() => setMobileNavOpen(true)}><span>插件</span></button></nav>
    {contextMenu ? <div className="raw-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><div className="context-menu-label">原始笔记操作</div><div className="context-menu-title">{getPreview(contextMenu.raw.text, 62)}</div><button type="button" onClick={() => void handleDeleteRaw(contextMenu.raw)}>删除原始笔记</button></div> : null}
  </main>;
}
