import { NextResponse } from "next/server";

import { getNoteByRawId } from "../../../lib/services/notes";
import {
  archiveSource,
  createSource,
  listSources,
} from "../../../lib/services/sources";

const MAX_RAW_LENGTH = 50_000;

export const runtime = "nodejs";

type RawRequestBody = { text?: unknown; rawId?: unknown };

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ raws: await listSources() });
  } catch {
    return errorResponse(
      "原始记录暂时没有载入。已保存的数据没有改变，请稍后重试。",
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
    return errorResponse("请求内容无法识别，请重新提交。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求格式无法识别，请重新提交。", 400, "INVALID_BODY");
  }

  const body = parsed as RawRequestBody;

  if (typeof body.text !== "string") {
    return errorResponse("没有收到要留下的内容，请重新填写。", 400, "TEXT_REQUIRED");
  }

  if (!body.text.trim()) {
    return errorResponse("先写下一段原话，再尝试保存。", 400, "TEXT_EMPTY");
  }

  if (body.text.length > MAX_RAW_LENGTH) {
    return errorResponse(
      `这段原话不能超过 ${MAX_RAW_LENGTH} 个字符，请删减后再保存。`,
      400,
      "TEXT_TOO_LONG",
    );
  }

  try {
    return NextResponse.json({ raw: await createSource(body.text) }, { status: 201 });
  } catch {
    return errorResponse(
      "这段原话暂时没有留下。内容没有写入，请稍后重试。",
      500,
      "RAW_STORAGE_WRITE_FAILED",
    );
  }
}

/**
 * 普通"移除"路径 = 归档，不做物理删除。
 *
 * 为什么归档而不是删除：原始记录是知识页的出处（`notes.raw_id` 是 RESTRICT 外键），
 * 物理删除会让知识页失去来源；永久清除必须走独立的高风险流程（见 outputs/10）。
 *
 * 响应仍保留 `deleted` 字段以保持前端契约不变，并额外返回 `archived: true` 说明真实语义。
 */
export async function DELETE(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return errorResponse("请求内容无法识别，请重新提交。", 400, "INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errorResponse("请求格式无法识别，请重新提交。", 400, "INVALID_BODY");
  }

  const body = parsed as RawRequestBody;

  if (typeof body.rawId !== "string" || !body.rawId.trim()) {
    return errorResponse("没有找到要移除的原始记录，请重新选择。", 400, "RAW_ID_REQUIRED");
  }

  try {
    const knowledge = await getNoteByRawId(body.rawId);
    if (knowledge) {
      return errorResponse(
        "这条原始记录已有知识页引用，暂时不能移除。请先处理对应的知识页。",
        409,
        "RAW_REFERENCED_BY_KNOWLEDGE",
      );
    }

    const archived = await archiveSource(body.rawId);
    if (!archived) {
      return errorResponse("这条原始记录已不存在，请刷新目录。", 404, "RAW_NOT_FOUND");
    }

    return NextResponse.json({ deleted: archived, archived: true });
  } catch {
    return errorResponse(
      "这条原始记录暂时无法移除。其他内容没有受到影响，请稍后重试。",
      500,
      "RAW_STORAGE_DELETE_FAILED",
    );
  }
}
