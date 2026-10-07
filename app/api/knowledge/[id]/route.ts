import { NextResponse } from "next/server";

import { getKnowledge, updateKnowledge } from "../../../../lib/knowledge-storage";
import { getRaw } from "../../../../lib/raw-storage";

export const runtime = "nodejs";

type KnowledgePatchBody = {
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  keyPoints?: unknown;
  concepts?: unknown;
  keywords?: unknown;
};

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const knowledge = await getKnowledge(id);

    if (!knowledge) {
      return NextResponse.json(
        { error: { code: "KNOWLEDGE_NOT_FOUND", message: "找不到对应的知识内容。" } },
        { status: 404 },
      );
    }

    const raw = await getRaw(knowledge.rawId);
    return NextResponse.json({ knowledge, raw });
  } catch {
    return NextResponse.json(
      { error: { code: "KNOWLEDGE_STORAGE_READ_FAILED", message: "暂时无法读取知识内容，请稍后重试。" } },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return errorResponse("请求内容必须是有效的 JSON。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求内容必须是 JSON 对象。", 400, "INVALID_BODY");
  }

  const body = parsed as KnowledgePatchBody;
  const patch: Parameters<typeof updateKnowledge>[1] = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return errorResponse("title 必须是非空字符串。", 400, "INVALID_TITLE");
    }
    patch.title = body.title;
  }

  if (body.summary !== undefined) {
    if (typeof body.summary !== "string" || !body.summary.trim()) {
      return errorResponse("summary 必须是非空字符串。", 400, "INVALID_SUMMARY");
    }
    patch.summary = body.summary;
  }

  if (body.content !== undefined) {
    if (typeof body.content !== "string" || !body.content.trim()) {
      return errorResponse("content 必须是非空字符串。", 400, "INVALID_CONTENT");
    }
    patch.content = body.content;
  }

  if (body.keyPoints !== undefined) {
    if (!isStringArray(body.keyPoints)) {
      return errorResponse("keyPoints 必须是字符串数组。", 400, "INVALID_KEY_POINTS");
    }
    patch.keyPoints = body.keyPoints;
  }

  if (body.concepts !== undefined) {
    if (!isStringArray(body.concepts)) {
      return errorResponse("concepts 必须是字符串数组。", 400, "INVALID_CONCEPTS");
    }
    patch.concepts = body.concepts;
  }

  if (body.keywords !== undefined) {
    if (!isStringArray(body.keywords)) {
      return errorResponse("keywords 必须是字符串数组。", 400, "INVALID_KEYWORDS");
    }
    patch.keywords = body.keywords;
  }

  if (Object.keys(patch).length === 0) {
    return errorResponse("请提供至少一个要更新的字段。", 400, "EMPTY_PATCH");
  }

  try {
    const knowledge = await updateKnowledge(id, patch);

    if (!knowledge) {
      return errorResponse("找不到对应的知识内容。", 404, "KNOWLEDGE_NOT_FOUND");
    }

    return NextResponse.json({ knowledge });
  } catch {
    return errorResponse(
      "暂时无法保存知识内容，请稍后重试。",
      500,
      "KNOWLEDGE_STORAGE_WRITE_FAILED",
    );
  }
}
