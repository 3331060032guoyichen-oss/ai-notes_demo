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
      "暂时无法读取知识内容，请稍后重试。",
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
    return errorResponse("请求内容必须是有效的 JSON。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求内容必须是 JSON 对象。", 400, "INVALID_BODY");
  }

  const body = parsed as KnowledgeRequestBody;

  if (typeof body.rawId !== "string" || !body.rawId.trim()) {
    return errorResponse("请提供 rawId 字段。", 400, "RAW_ID_REQUIRED");
  }

  if (!isOrganizeDraft(body.draft)) {
    return errorResponse("Draft 结构无效，请重新整理。", 400, "INVALID_DRAFT");
  }

  try {
    const raw = await getRaw(body.rawId);

    if (!raw) {
      return errorResponse("找不到对应的原始内容。", 404, "RAW_NOT_FOUND");
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
      "暂时无法保存知识内容，请稍后重试。",
      500,
      "KNOWLEDGE_STORAGE_WRITE_FAILED",
    );
  }
}
