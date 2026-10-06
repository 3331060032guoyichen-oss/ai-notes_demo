import { NextResponse } from "next/server";

import { getKnowledge } from "../../../../lib/knowledge-storage";
import { getRaw } from "../../../../lib/raw-storage";

export const runtime = "nodejs";

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
