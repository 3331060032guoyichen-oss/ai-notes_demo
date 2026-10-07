import { NextResponse } from "next/server";

import { askAssistant, DeepSeekError } from "../../../lib/deepseek";
import { getKnowledge } from "../../../lib/knowledge-storage";
import { getRaw } from "../../../lib/raw-storage";
import { getWiki } from "../../../lib/wiki-storage";

export const runtime = "nodejs";

type ContextType = "knowledge" | "raw" | "wiki" | "draft" | "none";

type AssistantRequestBody = {
  question?: unknown;
  contextType?: unknown;
  contextId?: unknown;
  draftContext?: unknown;
};

const CONTEXT_TYPES: ContextType[] = ["knowledge", "raw", "wiki", "draft", "none"];

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isContextType(value: unknown): value is ContextType {
  return typeof value === "string" && CONTEXT_TYPES.includes(value as ContextType);
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

  const body = parsed as AssistantRequestBody;

  if (typeof body.question !== "string" || !body.question.trim()) {
    return errorResponse("请提供 question 字段。", 400, "QUESTION_REQUIRED");
  }

  if (!isContextType(body.contextType)) {
    return errorResponse("contextType 无效。", 400, "INVALID_CONTEXT_TYPE");
  }

  let context = "";

  try {
    if (body.contextType === "knowledge") {
      if (typeof body.contextId !== "string" || !body.contextId.trim()) {
        return errorResponse("缺少 contextId。", 400, "CONTEXT_ID_REQUIRED");
      }
      const knowledge = await getKnowledge(body.contextId);
      if (!knowledge) {
        return errorResponse("找不到对应的知识内容。", 404, "KNOWLEDGE_NOT_FOUND");
      }
      context = [knowledge.title, knowledge.summary, knowledge.content].join("\n\n");
    } else if (body.contextType === "raw") {
      if (typeof body.contextId !== "string" || !body.contextId.trim()) {
        return errorResponse("缺少 contextId。", 400, "CONTEXT_ID_REQUIRED");
      }
      const raw = await getRaw(body.contextId);
      if (!raw) {
        return errorResponse("找不到对应的原始内容。", 404, "RAW_NOT_FOUND");
      }
      context = raw.text;
    } else if (body.contextType === "wiki") {
      if (typeof body.contextId !== "string" || !body.contextId.trim()) {
        return errorResponse("缺少 contextId。", 400, "CONTEXT_ID_REQUIRED");
      }
      const wiki = await getWiki();
      const page = wiki.pages.find((item) => item.id === body.contextId);
      if (!page) {
        return errorResponse("找不到对应的 Wiki 页面。", 404, "WIKI_PAGE_NOT_FOUND");
      }
      context = [page.title, page.summary, page.content].join("\n\n");
    } else if (body.contextType === "draft") {
      context = typeof body.draftContext === "string" ? body.draftContext : "";
    }
  } catch {
    return errorResponse(
      "暂时无法读取上下文内容，请稍后重试。",
      500,
      "CONTEXT_READ_FAILED",
    );
  }

  try {
    const answer = await askAssistant({ question: body.question, context });
    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof DeepSeekError) {
      const status = error.code === "CONFIG_MISSING" ? 503 : 502;
      return errorResponse(error.message, status, error.code);
    }
    return errorResponse("暂时无法获取回答，请稍后重试。", 500, "ASSISTANT_FAILED");
  }
}
