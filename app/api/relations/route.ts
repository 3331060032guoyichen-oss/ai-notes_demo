import { NextResponse } from "next/server";

import { getKnowledge } from "../../../lib/knowledge-storage";
import {
  createRelation,
  listRelations,
} from "../../../lib/relation-storage";

export const runtime = "nodejs";

type RelationRequestBody = {
  sourceId?: unknown;
  targetId?: unknown;
  type?: unknown;
  reason?: unknown;
};

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ relations: await listRelations() });
  } catch {
    return errorResponse(
      "暂时无法读取知识关系，请稍后重试。",
      500,
      "RELATION_STORAGE_READ_FAILED",
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

  const body = parsed as RelationRequestBody;

  if (typeof body.sourceId !== "string" || !body.sourceId.trim()) {
    return errorResponse("请提供 sourceId 字段。", 400, "SOURCE_ID_REQUIRED");
  }

  if (typeof body.targetId !== "string" || !body.targetId.trim()) {
    return errorResponse("请提供 targetId 字段。", 400, "TARGET_ID_REQUIRED");
  }

  if (body.sourceId === body.targetId) {
    return errorResponse("不能创建 Knowledge 自连接。", 400, "SELF_RELATION");
  }

  if (body.type !== "related") {
    return errorResponse("当前只支持 related 关系。", 400, "RELATION_TYPE_INVALID");
  }

  if (typeof body.reason !== "string" || !body.reason.trim()) {
    return errorResponse("请提供关系原因。", 400, "RELATION_REASON_REQUIRED");
  }

  try {
    const [source, target] = await Promise.all([
      getKnowledge(body.sourceId),
      getKnowledge(body.targetId),
    ]);

    if (!source || !target) {
      return errorResponse(
        "sourceId 和 targetId 都必须引用已存在的 Knowledge。",
        404,
        "KNOWLEDGE_NOT_FOUND",
      );
    }

    const result = await createRelation({
      sourceId: source.id,
      targetId: target.id,
      type: "related",
      reason: body.reason.trim(),
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch {
    return errorResponse(
      "暂时无法保存知识关系，请稍后重试。",
      500,
      "RELATION_STORAGE_WRITE_FAILED",
    );
  }
}
