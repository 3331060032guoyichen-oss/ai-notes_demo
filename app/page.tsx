"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { GraphEdge, GraphNode } from "../types/graph";
import type { Knowledge } from "../types/knowledge";
import type { OrganizeDraft } from "../types/organize";
import type { Raw } from "../types/raw";
import type { WikiData, WikiPage } from "../types/wiki";

const MAX_RAW_LENGTH = 50_000;

type ViewKey = "new-note" | "graph";

type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };
type KnowledgeListPayload = { knowledges?: Knowledge[] };
type GraphPayload = { nodes?: GraphNode[]; edges?: GraphEdge[] };
type WikiPayload = Partial<WikiData>;

type MentionItem = { kind: "raw" | "knowledge" | "wiki"; id: string; label: string };

type Tab =
  | { id: string; kind: "view"; viewKey: ViewKey; label: string }
  | { id: string; kind: "raw"; rawId: string; label: string }
  | { id: string; kind: "knowledge"; knowledgeId: string; label: string }
  | { id: string; kind: "wiki"; wikiPageId: string; label: string }
  | { id: string; kind: "draft"; rawId: string; label: string };

const viewMeta: Record<ViewKey, { label: string; shortLabel: string }> = {
  "new-note": { label: "新建笔记", shortLabel: "新建" },
  graph: { label: "关系图谱", shortLabel: "图谱" },
};

const directNavViews: ViewKey[] = ["new-note", "graph"];

const NEW_NOTE_TAB: Tab = { id: "view:new-note", kind: "view", viewKey: "new-note", label: "新建笔记" };

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
  const [openTabs, setOpenTabs] = useState<Tab[]>([NEW_NOTE_TAB]);
  const [activeTabId, setActiveTabId] = useState(NEW_NOTE_TAB.id);
  const [text, setText] = useState("");
  const [raws, setRaws] = useState<Raw[]>([]);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [wiki, setWiki] = useState<WikiData>({ pages: [], links: [] });
  const [selectedRawId, setSelectedRawId] = useState<string | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<Knowledge | null>(null);
  const [, setSelectedWikiPageId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrganizeDraft | null>(null);
  const [draftRawId, setDraftRawId] = useState<string | null>(null);
  const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>([]);
  const [graphRefresh, setGraphRefresh] = useState(0);
  const [aiMessage, setAiMessage] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionTarget, setMentionTarget] = useState<MentionItem | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<"raw" | "knowledge" | "wiki", boolean>>({
    raw: true,
    knowledge: true,
    wiki: true,
  });
  const [, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organizingRawId, setOrganizingRawId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<
    | { type: "raw"; raw: Raw; x: number; y: number }
    | { type: "knowledge-title"; knowledge: Knowledge; x: number; y: number }
    | null
  >(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingField, setEditingField] = useState<{ knowledgeId: string; field: "summary" | "content" | "concepts" } | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");

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
  

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const items: MentionItem[] = [
      ...raws.map((r) => ({ kind: "raw" as const, id: r.id, label: getPreview(r.text, 24) })),
      ...knowledges.map((k) => ({ kind: "knowledge" as const, id: k.id, label: k.title })),
      ...wiki.pages.map((p) => ({ kind: "wiki" as const, id: p.id, label: p.title })),
    ];
    return (q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items).slice(0, 8);
  }, [mentionQuery, raws, knowledges, wiki.pages]);

  const nodeTitleById = useMemo(() => {
    const map = new Map<string, string>();
    graph.nodes.forEach((node) => map.set(node.id, node.title));
    knowledges.forEach((knowledge) => {
      if (!map.has(knowledge.id)) map.set(knowledge.id, knowledge.title);
    });
    return map;
  }, [graph.nodes, knowledges]);

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function openTab(tab: Tab) {
    setOpenTabs((current) => current.some((item) => item.id === tab.id) ? current : [...current, tab]);
    setActiveTabId(tab.id);
    setMobileNavOpen(false);
    clearFeedback();
  }

  function closeTab(id: string) {
    setOpenTabs((current) => {
      const next = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) {
        const closedIndex = current.findIndex((tab) => tab.id === id);
        const fallback = next[closedIndex - 1] ?? next[0] ?? NEW_NOTE_TAB;
        setActiveTabId(fallback.id);
      }
      return next.length > 0 ? next : [NEW_NOTE_TAB];
    });
  }

  function navigate(view: ViewKey) {
    openTab({ id: `view:${view}`, kind: "view", viewKey: view, label: viewMeta[view].label });
  }

  function openRawTab(raw: Raw) {
    setSelectedRawId(raw.id);
    openTab({ id: `raw:${raw.id}`, kind: "raw", rawId: raw.id, label: getPreview(raw.text, 18) });
  }

  function openKnowledgeTab(knowledge: Knowledge) {
    setSelectedKnowledge(knowledge);
    openTab({ id: `knowledge:${knowledge.id}`, kind: "knowledge", knowledgeId: knowledge.id, label: getPreview(knowledge.title, 18) });
  }

  function openWikiTab(page: WikiPage) {
    setSelectedWikiPageId(page.id);
    openTab({ id: `wiki:${page.id}`, kind: "wiki", wikiPageId: page.id, label: getPreview(page.title, 18) });
  }

  function openDraftTab(rawId: string) {
    openTab({ id: `draft:${rawId}`, kind: "draft", rawId, label: "Draft 审阅" });
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

    try {
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawId }),
      });
      const payload = (await response.json()) as { draft?: OrganizeDraft; error?: { message?: string } };
      if (!response.ok || !payload.draft) throw new Error(payload.error?.message ?? "整理失败");
      setDraft(payload.draft);
      setAiMessage("Draft 已生成。请逐项检查，再决定哪些内容进入知识库。");
      setNotice("Draft 已生成，请检查并编辑后再确认保存。");
      openDraftTab(rawId);
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

      if (draftRawId) closeTab(`draft:${draftRawId}`);
      if (payload.created) {
        setKnowledges((current) => [payload.knowledge!, ...current]);
        setNotice("已确认并保存为 Knowledge。现在可以进入复习或查看关系。");
        openKnowledgeTab(payload.knowledge);
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

  async function handleUpdateKnowledge(id: string, patch: Partial<Pick<Knowledge, "title" | "summary" | "content" | "concepts">>) {
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json()) as { knowledge?: Knowledge; error?: { message?: string } };
      if (!response.ok || !payload.knowledge) throw new Error(payload.error?.message ?? "保存失败");
      const updated = payload.knowledge;
      setKnowledges((current) => current.map((item) => item.id === id ? updated : item));
      if (patch.title) {
        setOpenTabs((current) => current.map((tab) => tab.id === `knowledge:${id}` ? { ...tab, label: getPreview(updated.title, 18) } : tab));
      }
      setNotice("已保存修改。");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "暂时无法保存修改。");
    } finally {
      setEditingTitleId(null);
      setEditingField(null);
    }
  }

  async function handleGraphNodeClick(nodeId: string) {
    clearFeedback();
    try {
      const response = await fetch(`/api/knowledge/${nodeId}`);
      const payload = (await response.json()) as { knowledge?: Knowledge };
      if (!response.ok || !payload.knowledge) throw new Error("读取失败");
      openKnowledgeTab(payload.knowledge);
    } catch {
      setError("暂时无法读取该 Knowledge 详情。");
    }
  }

  async function handleAskAssistant(question: string) {
    if (!question.trim()) {
      setAiMessage("先输入一个问题，再让 AI 回答。");
      return;
    }

    setIsAsking(true);
    setAiMessage("");

    const body = mentionTarget
      ? { question, contextType: mentionTarget.kind, contextId: mentionTarget.id }
      : selectedKnowledge
        ? { question, contextType: "knowledge" as const, contextId: selectedKnowledge.id }
        : draft
          ? { question, contextType: "draft" as const, draftContext: `${draft.title}\n\n${draft.summary}\n\n${draft.content}` }
          : selectedRaw
            ? { question, contextType: "raw" as const, contextId: selectedRaw.id }
            : { question, contextType: "none" as const };

    setMentionTarget(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { answer?: string; error?: { message?: string } };
      if (!response.ok || typeof payload.answer !== "string") throw new Error(payload.error?.message ?? "暂时无法获取回答。");
      setAiMessage(payload.answer);
    } catch (askError) {
      setAiMessage(askError instanceof Error ? askError.message : "暂时无法获取回答。");
    } finally {
      setIsAsking(false);
    }
  }

  function handleQuestionChange(value: string) {
    setAiQuestion(value);
    const match = value.match(/@([^@\s]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function pickMention(item: MentionItem) {
    setAiQuestion((current) => current.replace(/@([^@\s]*)$/, `@${item.label} `));
    setMentionTarget(item);
    setMentionQuery(null);
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
      <div className="review-actions"><button className="button-dark" type="button" onClick={() => void handleConfirm()} disabled={isConfirming}>{isConfirming ? "确认中" : "确认并保存 Knowledge"}</button><button className="button-secondary" type="button" onClick={() => { if (draftRawId) closeTab(`draft:${draftRawId}`); setDraft(null); setDraftRawId(null); setSelectedRelationIds([]); setNotice("Draft 已取消，尚未创建 Knowledge。"); }} disabled={isConfirming}>取消</button></div>
    </section>;
  }

  function renderRawTab(rawId: string) {
    const raw = raws.find((item) => item.id === rawId);
    if (!raw) return <EmptyState title="这条原始笔记已不存在" body="它可能已经被删除。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} />;

    const knowledge = knowledges.find((item) => item.rawId === raw.id);

    return <>
      <header className="workspace-heading compact-heading">
        <div><p className="eyebrow">Raw · {formatDate(raw.createdAt)}</p><h1>原始笔记</h1><p>原始笔记不会被 AI 覆盖，整理和确认都从这里开始。</p></div>
        {knowledge ? <StatusPill tone="accent">已入库</StatusPill> : <StatusPill>待整理</StatusPill>}
      </header>
      <section className="content-section">
        <div className="reading-content">{raw.text}</div>
        <div className="review-actions">
          {knowledge
            ? <button className="button-dark" type="button" onClick={() => openKnowledgeTab(knowledge)}>打开知识 ↗</button>
            : <button className="button-dark" type="button" onClick={() => void handleOrganize(raw.id)} disabled={organizingRawId !== null}>{organizingRawId === raw.id ? "整理中" : "AI 整理"}</button>}
          {!knowledge ? <button className="button-secondary" type="button" onClick={() => void handleDeleteRaw(raw)}>删除</button> : null}
        </div>
      </section>
    </>;
  }

  function renderKnowledgeTab(knowledgeId: string) {
    const detail = knowledges.find((item) => item.id === knowledgeId);
    if (!detail) return <EmptyState title="这条知识已不存在" body="它可能已经被删除。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} />;

    const sourceRaw = raws.find((raw) => raw.id === detail.rawId);
    const relatedEdges = graph.edges.filter((edge) => edge.source === detail.id || edge.target === detail.id);
    const isEditingTitle = editingTitleId === detail.id;
    const editing = editingField?.knowledgeId === detail.id ? editingField.field : null;

    function startFieldEdit(field: "summary" | "content" | "concepts") {
      setEditingField({ knowledgeId: detail!.id, field });
      setFieldDraft(field === "concepts" ? detail!.concepts.join("\n") : detail![field]);
    }

    function saveFieldEdit() {
      if (!editing) return;
      if (editing === "concepts") {
        void handleUpdateKnowledge(detail!.id, { concepts: linesToArray(fieldDraft) });
      } else {
        void handleUpdateKnowledge(detail!.id, { [editing]: fieldDraft });
      }
    }

    return <>
      <header className="workspace-heading compact-heading">
        <div>
          <p className="eyebrow">Knowledge</p>
          {isEditingTitle
            ? <input className="title-edit-input" value={titleDraft} autoFocus onChange={(event) => setTitleDraft(event.target.value)} onBlur={() => void handleUpdateKnowledge(detail.id, { title: titleDraft })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleUpdateKnowledge(detail.id, { title: titleDraft }); } if (event.key === "Escape") setEditingTitleId(null); }} />
            : <h1 onContextMenu={(event) => { event.preventDefault(); setContextMenu({ type: "knowledge-title", knowledge: detail, x: event.clientX, y: event.clientY }); }}>{detail.title}</h1>}
          <p>更新于 {formatDate(detail.updatedAt)}</p>
        </div>
        <StatusPill tone="accent">已确认</StatusPill>
      </header>
      <section className="content-section">
        {editing === "summary"
          ? <textarea className="inline-edit-field" value={fieldDraft} autoFocus rows={3} onChange={(event) => setFieldDraft(event.target.value)} onBlur={saveFieldEdit} onKeyDown={(event) => { if (event.key === "Escape") setEditingField(null); if (event.key === "Enter" && event.ctrlKey) saveFieldEdit(); }} />
          : <p className="reading-summary editable-field" onClick={() => startFieldEdit("summary")}>{detail.summary}</p>}
        {editing === "content"
          ? <textarea className="inline-edit-field" value={fieldDraft} autoFocus rows={10} onChange={(event) => setFieldDraft(event.target.value)} onBlur={saveFieldEdit} onKeyDown={(event) => { if (event.key === "Escape") setEditingField(null); if (event.key === "Enter" && event.ctrlKey) saveFieldEdit(); }} />
          : <div className="reading-content editable-field" onClick={() => startFieldEdit("content")}>{detail.content}</div>}
        {editing === "concepts"
          ? <textarea className="inline-edit-field" value={fieldDraft} autoFocus rows={4} placeholder="每行一个概念" onChange={(event) => setFieldDraft(event.target.value)} onBlur={saveFieldEdit} onKeyDown={(event) => { if (event.key === "Escape") setEditingField(null); if (event.key === "Enter" && event.ctrlKey) saveFieldEdit(); }} />
          : <div className="tag-row editable-field" onClick={() => startFieldEdit("concepts")}>{detail.concepts.length > 0 ? detail.concepts.map((concept) => <span className="tag" key={concept}>{concept}</span>) : <span className="muted-note">点击添加概念</span>}</div>}
        <div className="source-reference"><span className="item-kicker">SOURCE</span><strong>{sourceRaw ? getPreview(sourceRaw.text, 150) : "来源暂不可用"}</strong>{sourceRaw ? <button className="text-button" type="button" onClick={() => openRawTab(sourceRaw)}>回到原始笔记 ↗</button> : null}</div>
        <div className="backlink-section">
          <div className="section-heading-inline"><h3>相关关系</h3><button className="text-button" type="button" onClick={() => navigate("graph")}>查看图谱</button></div>
          {relatedEdges.length > 0 ? <div className="relation-list">{relatedEdges.map((edge) => {
            const otherId = edge.source === detail.id ? edge.target : edge.source;
            const other = knowledges.find((item) => item.id === otherId);
            return <div className="relation-row" key={edge.id}>{other ? <button className="text-button" type="button" onClick={() => openKnowledgeTab(other)}>{other.title}</button> : <span>{otherId}</span>}<small>{edge.reason}</small></div>;
          })}</div> : <p className="muted-note">这条知识还没有关联对象。</p>}
        </div>
      </section>
    </>;
  }

  function renderWikiTab(wikiPageId: string) {
    const page = wiki.pages.find((item) => item.id === wikiPageId);
    if (!page) return <EmptyState title="这个 Wiki 页面已不存在" body="请从左侧目录重新选择。" />;

    const linked = wiki.links
      .filter((link) => link.sourceId === page.id || link.targetId === page.id)
      .map((link) => link.sourceId === page.id ? link.targetId : link.sourceId)
      .map((id) => wiki.pages.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is WikiPage => Boolean(candidate));

    return <>
      <header className="workspace-heading compact-heading"><div><p className="eyebrow">Wiki · {wikiKindLabels[page.kind]}</p><h1>{page.title}</h1><p>{page.tags.join(" / ")}</p></div></header>
      <section className="content-section">
        <p className="reading-summary">{page.summary}</p>
        <div className="reading-content">{page.content}</div>
        {linked.length > 0 ? <div className="backlink-section"><h4>关联页面</h4><div className="tag-row">{linked.map((linkedPage) => <button className="tag tag-button" type="button" key={linkedPage.id} onClick={() => openWikiTab(linkedPage)}>{linkedPage.title}</button>)}</div></div> : null}
      </section>
    </>;
  }

  function renderGraph() {
    return <><header className="workspace-heading compact-heading"><div><p className="eyebrow">关系图谱</p><h1>看见知识如何连接。</h1><p>图谱只使用真实 Knowledge 和 Relation，不生成装饰性节点。</p></div><button className="button-secondary" type="button" onClick={() => setGraphRefresh((current) => current + 1)}>刷新网络</button></header>{graph.nodes.length === 0 ? <EmptyState title="关系图谱还没有节点" body="确认 Knowledge 后，真实节点会从这里开始生长。" action={<button className="button-dark" type="button" onClick={() => navigate("new-note")}>新建笔记</button>} /> : <div className="graph-workspace"><section className="network-map" aria-label="Knowledge 节点地图">{graph.nodes.map((node, index) => <button className={`network-node node-position-${index % 6}`} type="button" key={node.id} onClick={() => void handleGraphNodeClick(node.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{node.title}</strong><small>打开知识页</small></button>)}</section><section className="edge-list"><div className="section-heading-inline"><h2>关系</h2><span className="section-count">{graph.edges.length}</span></div>{graph.edges.length === 0 ? <p className="muted-note">当前没有 related 关系。可以在 Draft 审阅时接受关系建议。</p> : graph.edges.map((edge) => <div className="edge-row" key={edge.id}><div><strong>{nodeTitleById.get(edge.source) ?? edge.source}</strong><span>↔</span><strong>{nodeTitleById.get(edge.target) ?? edge.target}</strong></div><p>{edge.reason}</p></div>)}</section></div>}</>;
  }

  function renderMainContent() {
    switch (activeTab.kind) {
      case "raw": return renderRawTab(activeTab.rawId);
      case "knowledge": return renderKnowledgeTab(activeTab.knowledgeId);
      case "wiki": return renderWikiTab(activeTab.wikiPageId);
      case "draft": return renderDraftReview();
      case "view":
        switch (activeTab.viewKey) {
          case "new-note": return renderNewNote();
          case "graph": return renderGraph();
        }
    }
  }

  const activeTab = openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0] ?? NEW_NOTE_TAB;

  return <main className="app-shell">
    <div className="mobile-topbar"><button className="mobile-menu-button" type="button" onClick={() => setMobileNavOpen((current) => !current)} aria-expanded={mobileNavOpen} aria-controls="workspace-nav">菜单</button><AppLogo /><button className="mobile-new-button" type="button" onClick={() => navigate("new-note")}>新建</button></div>
    <aside id="workspace-nav" className={`workspace-sidebar${mobileNavOpen ? " is-open" : ""}`}>
      <div className="sidebar-top"><AppLogo /><button className="workspace-switcher" type="button"><span className="workspace-avatar">G</span><span><strong>个人学习空间</strong><small>本地工作区</small></span><span aria-hidden="true">⌄</span></button><button className="new-source-button" type="button" onClick={() => navigate("new-note")}><span aria-hidden="true">+</span> 新建笔记</button></div>
      <nav className="file-tree" aria-label="数据目录">
        <div className="tree-section">
          <button className="tree-section-header" type="button" onClick={() => setExpandedSections((current) => ({ ...current, raw: !current.raw }))} aria-expanded={expandedSections.raw}>
            <span className={`tree-caret${expandedSections.raw ? " is-open" : ""}`} aria-hidden="true">▾</span>
            <span>Raw</span>
            <span className="tree-count">{raws.length}</span>
          </button>
          {expandedSections.raw ? <div className="tree-items">{raws.length === 0 ? <p className="tree-empty">还没有笔记</p> : raws.map((raw) => <button className={`tree-item${activeTabId === `raw:${raw.id}` ? " is-selected" : ""}`} type="button" key={raw.id} onClick={() => openRawTab(raw)}>{getPreview(raw.text, 32)}</button>)}</div> : null}
        </div>
        <div className="tree-section">
          <button className="tree-section-header" type="button" onClick={() => setExpandedSections((current) => ({ ...current, knowledge: !current.knowledge }))} aria-expanded={expandedSections.knowledge}>
            <span className={`tree-caret${expandedSections.knowledge ? " is-open" : ""}`} aria-hidden="true">▾</span>
            <span>Knowledge</span>
            <span className="tree-count">{knowledges.length}</span>
          </button>
          {expandedSections.knowledge ? <div className="tree-items">{knowledges.length === 0 ? <p className="tree-empty">还没有知识</p> : knowledges.map((knowledge) => <button className={`tree-item${activeTabId === `knowledge:${knowledge.id}` ? " is-selected" : ""}`} type="button" key={knowledge.id} onClick={() => openKnowledgeTab(knowledge)}>{getPreview(knowledge.title, 32)}</button>)}</div> : null}
        </div>
        <div className="tree-section">
          <button className="tree-section-header" type="button" onClick={() => setExpandedSections((current) => ({ ...current, wiki: !current.wiki }))} aria-expanded={expandedSections.wiki}>
            <span className={`tree-caret${expandedSections.wiki ? " is-open" : ""}`} aria-hidden="true">▾</span>
            <span>Wiki</span>
            <span className="tree-count">{wiki.pages.length}</span>
          </button>
          {expandedSections.wiki ? <div className="tree-items">{wiki.pages.length === 0 ? <p className="tree-empty">还没有 Wiki 页面</p> : wiki.pages.map((page) => <button className={`tree-item${activeTabId === `wiki:${page.id}` ? " is-selected" : ""}`} type="button" key={page.id} style={{ paddingLeft: `${10 + getWikiDepth(page, wiki.pages) * 14}px` }} onClick={() => openWikiTab(page)}>{getPreview(page.title, 28)}</button>)}</div> : null}
        </div>
        <div className="tree-tools"><button className={`tree-tool-item${activeTabId === "view:graph" ? " is-active" : ""}`} type="button" onClick={() => navigate("graph")}>{viewMeta.graph.label}</button></div>
      </nav>
      <div className="sidebar-bottom"><div className="data-status"><span className="status-dot" aria-hidden="true" /><span><strong>本地数据正常</strong><small>Raw 与 Knowledge 已连接</small></span></div><span className="sidebar-version">AI Notes</span></div>
    </aside>
    <section className="workspace-main">
      <div className="workspace-topbar"><div className="breadcrumb"><span>AI Notes</span><span aria-hidden="true">/</span><strong>{activeTab.label}</strong></div><div className="topbar-actions"><span className="topbar-status"><span className="status-dot" aria-hidden="true" />本地工作区</span><button className="avatar-button" type="button" aria-label="打开个人菜单">G</button></div></div>
      <div className="tab-bar" role="tablist">{openTabs.map((tab) => <div key={tab.id} className={`tab-chip${activeTabId === tab.id ? " is-active" : ""}`} role="tab" aria-selected={activeTabId === tab.id} onClick={() => setActiveTabId(tab.id)}><span>{tab.label}</span><button type="button" aria-label="关闭标签" onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}>×</button></div>)}</div>
      <div className="workspace-content"><div className="main-column">{error ? <div className="feedback-banner error-message" role="alert">{error}</div> : null}{notice ? <div className="feedback-banner notice-message" aria-live="polite">{notice}</div> : null}{renderMainContent()}</div></div>
    </section>
    <aside className="ai-rail" aria-label="上下文 AI 面板">
      <div className="ai-rail-header"><div><span className="item-kicker">CONTEXT AI</span><h2>上下文 AI</h2></div><span className="ai-signal">辅助</span></div>
      <div className={`ai-result${aiMessage ? " has-result" : ""}`} aria-live="polite">
        <div className="ai-result-label"><span>AI 回答</span></div>
        <p>{isAsking ? "思考中…" : aiMessage || "在下方提问，输入 @ 可以引用一条已有的笔记作为上下文。"}</p>
        {aiMessage && !isAsking ? <div className="ai-result-actions"><button className="text-button" type="button" onClick={() => setAiMessage("")}>清除</button></div> : null}
      </div>
      <form className="ai-ask" onSubmit={(event) => { event.preventDefault(); void handleAskAssistant(aiQuestion); }}>
        <label htmlFor="ai-question">问笔记</label>
        <div className="ai-input-wrap">
          {mentionCandidates.length > 0 ? <div className="mention-popup" role="listbox">{mentionCandidates.map((item) => <button type="button" key={`${item.kind}:${item.id}`} className="mention-row" onClick={() => pickMention(item)}><span className="mention-kind">{item.kind === "raw" ? "Raw" : item.kind === "knowledge" ? "Knowledge" : "Wiki"}</span><span>{item.label}</span></button>)}</div> : null}
          <div className="ai-input-row"><input id="ai-question" value={aiQuestion} onChange={(event) => handleQuestionChange(event.target.value)} placeholder="输入问题，@ 可以引用已有笔记" disabled={isAsking} /><button type="submit" aria-label="提交问题" disabled={isAsking}>↗</button></div>
        </div>
      </form>
      <div className="ai-trace"><span className="status-dot" aria-hidden="true" />AI 回答基于当前真实内容，不会自动写入知识库</div>
    </aside>
    <nav className="mobile-bottom-nav" aria-label="移动端导航">{directNavViews.map((view) => <button className={activeTab.kind === "view" && activeTab.viewKey === view ? "is-active" : ""} type="button" key={view} onClick={() => navigate(view)}><span>{viewMeta[view].shortLabel}</span></button>)}<button type="button" onClick={() => setMobileNavOpen(true)}><span>更多</span></button></nav>
    {contextMenu?.type === "raw" ? <div className="raw-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><div className="context-menu-label">原始笔记操作</div><div className="context-menu-title">{getPreview(contextMenu.raw.text, 62)}</div><button type="button" onClick={() => void handleDeleteRaw(contextMenu.raw)}>删除原始笔记</button></div> : null}
    {contextMenu?.type === "knowledge-title" ? <div className="raw-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><div className="context-menu-label">标题操作</div><div className="context-menu-title">{getPreview(contextMenu.knowledge.title, 62)}</div><button type="button" onClick={() => { setEditingTitleId(contextMenu.knowledge.id); setTitleDraft(contextMenu.knowledge.title); setContextMenu(null); }}>重命名</button></div> : null}
  </main>;
}
