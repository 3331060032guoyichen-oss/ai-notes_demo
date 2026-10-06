"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type { Knowledge } from "../types/knowledge";
import type { OrganizeDraft } from "../types/organize";
import type { Raw } from "../types/raw";

const MAX_RAW_LENGTH = 10_000;

type KnowledgeListPayload = { knowledges?: Knowledge[] };

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function Home() {
  const [text, setText] = useState("");
  const [raws, setRaws] = useState<Raw[]>([]);
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [draft, setDraft] = useState<OrganizeDraft | null>(null);
  const [draftRawId, setDraftRawId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organizingRawId, setOrganizingRawId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPageData() {
      try {
        const [rawResponse, knowledgeResponse] = await Promise.all([
          fetch("/api/raw"),
          fetch("/api/knowledge"),
        ]);
        const rawPayload = (await rawResponse.json()) as { raws?: Raw[] };
        const knowledgePayload =
          (await knowledgeResponse.json()) as KnowledgeListPayload;

        if (!rawResponse.ok || !knowledgeResponse.ok) throw new Error("读取失败");
        if (active) {
          setRaws(rawPayload.raws ?? []);
          setKnowledges(knowledgePayload.knowledges ?? []);
        }
      } catch {
        if (active) setError("暂时无法读取已保存的内容。");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadPageData();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

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
      const payload = (await response.json()) as {
        raw?: Raw;
        error?: { message?: string };
      };

      if (!response.ok || !payload.raw) {
        throw new Error(payload.error?.message ?? "保存失败");
      }

      setRaws((current) => [payload.raw!, ...current]);
      setText("");
      setNotice("原始内容已保存，可以继续请求 AI 整理。");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "暂时无法保存原始内容。",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOrganize(rawId: string) {
    setError("");
    setNotice("");
    setDraft(null);
    setDraftRawId(rawId);
    setOrganizingRawId(rawId);

    try {
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawId }),
      });
      const payload = (await response.json()) as {
        draft?: OrganizeDraft;
        error?: { message?: string };
      };

      if (!response.ok || !payload.draft) {
        throw new Error(payload.error?.message ?? "整理失败");
      }

      setDraft(payload.draft);
      setNotice("Draft 已生成，请检查并编辑后再确认保存。");
    } catch (organizeError) {
      setDraftRawId(null);
      setError(
        organizeError instanceof Error
          ? organizeError.message
          : "暂时无法生成 Draft。",
      );
    } finally {
      setOrganizingRawId(null);
    }
  }

  async function handleConfirm() {
    if (!draft || !draftRawId) return;

    setError("");
    setNotice("");
    setIsConfirming(true);

    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawId: draftRawId, draft }),
      });
      const payload = (await response.json()) as {
        knowledge?: Knowledge;
        created?: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.knowledge) {
        throw new Error(payload.error?.message ?? "确认保存失败");
      }

      if (payload.created) {
        setKnowledges((current) => [payload.knowledge!, ...current]);
        setNotice("已确认并保存为 Knowledge。");
      } else {
        setNotice("这个 Raw 已经确认过，未创建重复 Knowledge。");
      }
      setDraft(null);
      setDraftRawId(null);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "暂时无法保存 Knowledge。",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="content-column" aria-labelledby="page-title">
        <p className="eyebrow">AI NOTES / BRANDKIT</p>
        <h1 id="page-title">先保存，再确认知识</h1>
        <p className="intro">
          保留你的原始内容，AI 只提出 Draft。你编辑并确认之后，内容才会进入 Knowledge。
        </p>

        <form className="brand-card raw-form" onSubmit={handleSubmit}>
          <label htmlFor="raw-text">原始学习内容</label>
          <textarea
            id="raw-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_RAW_LENGTH}
            placeholder="可以输入课堂笔记、阅读摘录或待整理的问题……"
            rows={9}
          />
          <div className="form-footer">
            <span>
              {text.length.toLocaleString()} / {MAX_RAW_LENGTH.toLocaleString()}
            </span>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "保存中…" : "保存原始内容"}
            </button>
          </div>
        </form>

        <div className="feedback" aria-live="polite">
          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="notice-message">{notice}</p> : null}
        </div>

        {draft ? (
          <section className="brand-card draft-panel" aria-labelledby="draft-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">待确认</p>
                <h2 id="draft-title">Draft 编辑</h2>
              </div>
              <span>尚未写入 Knowledge</span>
            </div>
            <label htmlFor="draft-heading">标题</label>
            <input
              id="draft-heading"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
            <label htmlFor="draft-summary">摘要</label>
            <textarea
              id="draft-summary"
              value={draft.summary}
              onChange={(event) =>
                setDraft({ ...draft, summary: event.target.value })
              }
              rows={3}
            />
            <label htmlFor="draft-content">正文</label>
            <textarea
              id="draft-content"
              value={draft.content}
              onChange={(event) =>
                setDraft({ ...draft, content: event.target.value })
              }
              rows={7}
            />
            <label htmlFor="draft-key-points">关键点（每行一项）</label>
            <textarea
              id="draft-key-points"
              value={draft.keyPoints.join("\n")}
              onChange={(event) =>
                setDraft({ ...draft, keyPoints: linesToArray(event.target.value) })
              }
              rows={4}
            />
            <label htmlFor="draft-concepts">概念（每行一项）</label>
            <textarea
              id="draft-concepts"
              value={draft.concepts.join("\n")}
              onChange={(event) =>
                setDraft({ ...draft, concepts: linesToArray(event.target.value) })
              }
              rows={3}
            />
            <label htmlFor="draft-keywords">关键词（每行一项）</label>
            <textarea
              id="draft-keywords"
              value={draft.keywords.join("\n")}
              onChange={(event) =>
                setDraft({ ...draft, keywords: linesToArray(event.target.value) })
              }
              rows={3}
            />
            <p className="draft-note">
              当前没有可确认的 Knowledge 关联建议。Relation 会在后续 Step 单独处理。
            </p>
            <div className="draft-actions">
              <button type="button" onClick={handleConfirm} disabled={isConfirming}>
                {isConfirming ? "确认中…" : "确认并保存 Knowledge"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDraft(null);
                  setDraftRawId(null);
                  setNotice("Draft 已取消，尚未创建 Knowledge。");
                }}
                disabled={isConfirming}
              >
                取消
              </button>
            </div>
          </section>
        ) : null}

        <section className="brand-card raw-list" aria-labelledby="saved-raw-title">
          <div className="section-heading">
            <h2 id="saved-raw-title">已保存的原始内容</h2>
            <span>{raws.length}</span>
          </div>
          {isLoading ? <p className="empty-state">正在读取…</p> : null}
          {!isLoading && raws.length === 0 ? (
            <p className="empty-state">还没有保存的内容。</p>
          ) : null}
          {raws.length > 0 ? (
            <ul>
              {raws.map((raw) => (
                <li className="raw-item" key={raw.id}>
                  <time dateTime={raw.createdAt}>
                    {new Date(raw.createdAt).toLocaleString("zh-CN")}
                  </time>
                  <p>{raw.text}</p>
                  <button
                    className="secondary-button organize-button"
                    type="button"
                    onClick={() => void handleOrganize(raw.id)}
                    disabled={organizingRawId !== null}
                  >
                    {organizingRawId === raw.id ? "整理中…" : "AI 整理为 Draft"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="brand-card knowledge-list" aria-labelledby="knowledge-title">
          <div className="section-heading">
            <h2 id="knowledge-title">已确认的 Knowledge</h2>
            <span>{knowledges.length}</span>
          </div>
          {knowledges.length === 0 ? (
            <p className="empty-state">确认 Draft 后，Knowledge 会显示在这里。</p>
          ) : (
            <ul>
              {knowledges.map((knowledge) => (
                <li className="knowledge-item" key={knowledge.id}>
                  <strong>{knowledge.title}</strong>
                  <p>{knowledge.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
