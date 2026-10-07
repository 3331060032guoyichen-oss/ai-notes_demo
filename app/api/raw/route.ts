import { NextResponse } from "next/server";

import { createRaw, deleteRaw, listRaw } from "../../../lib/raw-storage";
import { listKnowledge } from "../../../lib/knowledge-storage";

const MAX_RAW_LENGTH = 50_000;

export const runtime = "nodejs";

type RawRequestBody = { text?: unknown; rawId?: unknown };

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ raws: await listRaw() });
  } catch {
    return errorResponse(
      "暂时无法读取原始内容，请稍后重试。",
      500,
      "RAW_STORAGE_READ_FAILED",
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

  const body = parsed as RawRequestBody;

  if (typeof body.text !== "string") {
    return errorResponse("请提供 text 字段。", 400, "TEXT_REQUIRED");
  }

  if (!body.text.trim()) {
    return errorResponse("原始内容不能为空。", 400, "TEXT_EMPTY");
  }

  if (body.text.length > MAX_RAW_LENGTH) {
    return errorResponse(
      `原始内容不能超过 ${MAX_RAW_LENGTH} 个字符。`,
      400,
      "TEXT_TOO_LONG",
    );
  }

  try {
    return NextResponse.json(
      { raw: await createRaw(body.text) },
      { status: 201 },
    );
  } catch {
    return errorResponse(
      "暂时无法保存原始内容，请稍后重试。",
      500,
      "RAW_STORAGE_WRITE_FAILED",
    );
  }
}

export async function DELETE(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return errorResponse("请求内容必须是有效的 JSON。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求内容必须是 JSON 对象。", 400, "INVALID_BODY");
  }

  const body = parsed as RawRequestBody;

  if (typeof body.rawId !== "string" || !body.rawId.trim()) {
    return errorResponse("请提供 rawId 字段。", 400, "RAW_ID_REQUIRED");
  }

  try {
    const knowledges = await listKnowledge();
    if (knowledges.some((knowledge) => knowledge.rawId === body.rawId)) {
      return errorResponse(
        "这条原始笔记已经进入 Knowledge，暂时不能直接删除。请先处理关联知识。",
        409,
        "RAW_REFERENCED_BY_KNOWLEDGE",
      );
    }

    const deleted = await deleteRaw(body.rawId);
    if (!deleted) return errorResponse("找不到对应的原始笔记。", 404, "RAW_NOT_FOUND");

    return NextResponse.json({ deleted });
  } catch {
    return errorResponse(
      "暂时无法删除原始笔记，请稍后重试。",
      500,
      "RAW_STORAGE_DELETE_FAILED",
    );
  }
}
