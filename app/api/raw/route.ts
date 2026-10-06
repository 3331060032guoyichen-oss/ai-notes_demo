import { NextResponse } from "next/server";

import { createRaw, listRaw } from "../../../lib/raw-storage";

const MAX_RAW_LENGTH = 10_000;

export const runtime = "nodejs";

type RawRequestBody = { text?: unknown };

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
