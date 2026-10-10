import { NextResponse } from "next/server";

import { getNote } from "../../../../../lib/services/notes";
import { listLinksForNote } from "../../../../../lib/services/links";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const knowledge = await getNote(id);

    if (!knowledge) {
      return NextResponse.json(
        { error: { code: "KNOWLEDGE_NOT_FOUND", message: "这张知识页已不存在，请刷新目录。" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ relations: await listLinksForNote(id) });
  } catch {
    return NextResponse.json(
      { error: { code: "RELATION_STORAGE_READ_FAILED", message: "交叉引用暂时没有载入。知识页没有受到影响，请稍后重试。" } },
      { status: 500 },
    );
  }
}
