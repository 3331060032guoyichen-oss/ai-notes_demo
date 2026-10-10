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
        { error: { code: "KNOWLEDGE_NOT_FOUND", message: "这张知识页已不存在，请刷新目录。" } },
        { status: 404 },
      );
    }

    const raw = await getRaw(knowledge.rawId);
    return NextResponse.json({ knowledge, raw });
  } catch {
    return NextResponse.json(
      { error: { code: "KNOWLEDGE_STORAGE_READ_FAILED", message: "知识页暂时没有载入。已收录的内容没有改变，请稍后重试。" } },
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
    return errorResponse("请求内容无法识别，请重新提交。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求格式无法识别，请重新提交。", 400, "INVALID_BODY");
  }

  const body = parsed as KnowledgePatchBody;
  const patch: Parameters<typeof updateKnowledge>[1] = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return errorResponse("标题不能为空。请补充后再保存。", 400, "INVALID_TITLE");
    }
    patch.title = body.title;
  }

  if (body.summary !== undefined) {
    if (typeof body.summary !== "string" || !body.summary.trim()) {
      return errorResponse("摘要不能为空。请补充后再保存。", 400, "INVALID_SUMMARY");
    }
    patch.summary = body.summary;
  }

  if (body.content !== undefined) {
    if (typeof body.content !== "string" || !body.content.trim()) {
      return errorResponse("正文不能为空。请补充后再保存。", 400, "INVALID_CONTENT");
    }
    patch.content = body.content;
  }

  if (body.keyPoints !== undefined) {
    if (!isStringArray(body.keyPoints)) {
      return errorResponse("关键点的格式无法识别，请重新整理后再保存。", 400, "INVALID_KEY_POINTS");
    }
    patch.keyPoints = body.keyPoints;
  }

  if (body.concepts !== undefined) {
    if (!isStringArray(body.concepts)) {
      return errorResponse("概念的格式无法识别，请重新整理后再保存。", 400, "INVALID_CONCEPTS");
    }
    patch.concepts = body.concepts;
  }

  if (body.keywords !== undefined) {
    if (!isStringArray(body.keywords)) {
      return errorResponse("关键词的格式无法识别，请重新整理后再保存。", 400, "INVALID_KEYWORDS");
    }
    patch.keywords = body.keywords;
  }

  if (Object.keys(patch).length === 0) {
    return errorResponse("没有收到需要修订的内容。", 400, "EMPTY_PATCH");
  }

  try {
    const knowledge = await updateKnowledge(id, patch);

    if (!knowledge) {
      return errorResponse("这张知识页已不存在，请刷新目录。", 404, "KNOWLEDGE_NOT_FOUND");
    }

    return NextResponse.json({ knowledge });
  } catch {
    return errorResponse(
      "这次修订暂时没有保存。原有知识页没有改变，请稍后重试。",
      500,
      "KNOWLEDGE_STORAGE_WRITE_FAILED",
    );
  }
}
