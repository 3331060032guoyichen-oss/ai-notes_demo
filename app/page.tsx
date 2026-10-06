"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type { Raw } from "../types/raw";

const MAX_RAW_LENGTH = 10_000;

export default function Home() {
  const [text, setText] = useState("");
  const [raws, setRaws] = useState<Raw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRaws() {
      try {
        const response = await fetch("/api/raw");
        const payload = (await response.json()) as { raws?: Raw[] };

        if (!response.ok) throw new Error("读取失败");
        if (active) setRaws(payload.raws ?? []);
      } catch {
        if (active) setError("暂时无法读取已保存的原始内容。");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadRaws();
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
      setNotice("原始内容已保存，后续可以基于它重新整理。");
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

  return (
    <main className="page-shell">
      <section className="content-column" aria-labelledby="page-title">
        <p className="eyebrow">AI NOTES / RAW</p>
        <h1 id="page-title">先保存你的学习内容</h1>
        <p className="intro">
          先保留原始内容，再进行后续整理。当前阶段不会修改你的原文。
        </p>

        <form className="raw-form" onSubmit={handleSubmit}>
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

        <section className="raw-list" aria-labelledby="saved-raw-title">
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
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>
    </main>
  );
}
