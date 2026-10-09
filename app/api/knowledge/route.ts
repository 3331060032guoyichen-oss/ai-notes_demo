import { NextResponse } from "next/server";

import { isOrganizeDraft } from "../../../lib/deepseek";
import { createKnowledge, listKnowledge } from "../../../lib/knowledge-storage";
import { getRaw } from "../../../lib/raw-storage";

export const runtime = "nodejs";

type KnowledgeRequestBody = {
  rawId?: unknown;
  draft?: unknown;
};

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ knowledges: await listKnowledge() });
  } catch {
    return errorResponse(
      "知识页暂时没有载入。已收录的内容没有改变，请稍后重试。",
      500,
      "KNOWLEDGE_STORAGE_READ_FAILED",
    );
  }
}

export async function POST(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return errorResponse("请求内容无法识别，请重新提交。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求格式无法识别，请重新提交。", 400, "INVALID_BODY");
  }

  const body = parsed as KnowledgeRequestBody;

  if (typeof body.rawId !== "string" || !body.rawId.trim()) {
    return errorResponse("没有找到整理稿对应的原始记录，请重新整理。", 400, "RAW_ID_REQUIRED");
  }

  if (!isOrganizeDraft(body.draft)) {
    return errorResponse("整理稿的内容不完整，暂时无法收录。请重新整理。", 400, "INVALID_DRAFT");
  }

  try {
    const raw = await getRaw(body.rawId);

    if (!raw) {
      return errorResponse("整理稿对应的原始记录已不存在，暂时无法收录。", 404, "RAW_NOT_FOUND");
    }

    const result = await createKnowledge({
      rawId: raw.id,
      title: body.draft.title,
      summary: body.draft.summary,
      content: body.draft.content,
      keyPoints: body.draft.keyPoints,
      concepts: body.draft.concepts,
      keywords: body.draft.keywords,
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch {
    return errorResponse(
      "整理稿暂时无法收录。原始记录仍然安全，请稍后重试。",
      500,
      "KNOWLEDGE_STORAGE_WRITE_FAILED",
    );
  }
}
