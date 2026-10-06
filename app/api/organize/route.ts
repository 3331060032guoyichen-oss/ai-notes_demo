import { NextResponse } from "next/server";

import { createOrganizeDraft, DeepSeekError } from "../../../lib/deepseek";
import { getRaw } from "../../../lib/raw-storage";

export const runtime = "nodejs";

type OrganizeRequestBody = {
  rawId?: unknown;
};

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
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

  const body = parsed as OrganizeRequestBody;

  if (typeof body.rawId !== "string" || !body.rawId.trim()) {
    return errorResponse("请提供 rawId 字段。", 400, "RAW_ID_REQUIRED");
  }

  let raw;

  try {
    raw = await getRaw(body.rawId);
  } catch {
    return errorResponse(
      "暂时无法读取原始内容，请稍后重试。",
      500,
      "RAW_STORAGE_READ_FAILED",
    );
  }

  if (!raw) {
    return errorResponse("找不到对应的原始内容。", 404, "RAW_NOT_FOUND");
  }

  try {
    const draft = await createOrganizeDraft({
      rawText: raw.text,
      existingKnowledge: [],
    });

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof DeepSeekError) {
      if (error.code === "CONFIG_MISSING") {
        return errorResponse(
          "服务端尚未配置 DeepSeek API Key。",
          503,
          "DEEPSEEK_CONFIG_MISSING",
        );
      }

      if (error.code === "TIMEOUT") {
        return errorResponse(
          "DeepSeek 请求超时，请稍后使用同一个 rawId 重试。",
          504,
          "DEEPSEEK_TIMEOUT",
        );
      }

      if (error.code === "UPSTREAM_INVALID_JSON") {
        return errorResponse(
          "DeepSeek 返回的 Draft 无法通过结构化校验。",
          502,
          "INVALID_DRAFT",
        );
      }

      return errorResponse(
        "DeepSeek 暂时不可用，请稍后使用同一个 rawId 重试。",
        502,
        "DEEPSEEK_UPSTREAM_ERROR",
      );
    }

    return errorResponse("整理失败，请稍后重试。", 500, "ORGANIZE_FAILED");
  }
}
