import { NextResponse } from "next/server";

import { getKnowledge } from "../../../../../lib/knowledge-storage";
import { listRelationsForKnowledge } from "../../../../../lib/relation-storage";

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

    const relations = await listRelationsForKnowledge(id);
    const backlinks = (
      await Promise.all(
        relations.map((relation) =>
          getKnowledge(
            relation.sourceId === id ? relation.targetId : relation.sourceId,
          ),
        ),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ backlinks });
  } catch {
    return NextResponse.json(
      { error: { code: "BACKLINK_READ_FAILED", message: "暂时无法读取 Backlink，请稍后重试。" } },
      { status: 500 },
    );
  }
}
