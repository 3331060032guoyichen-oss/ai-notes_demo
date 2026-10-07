import { NextResponse } from "next/server";

import { listKnowledge } from "../../../lib/knowledge-storage";
import { listRelations } from "../../../lib/relation-storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [knowledges, relations] = await Promise.all([
      listKnowledge(),
      listRelations(),
    ]);
    const knowledgeIds = new Set(knowledges.map((knowledge) => knowledge.id));

    return NextResponse.json({
      nodes: knowledges.map((knowledge) => ({
        id: knowledge.id,
        title: knowledge.title,
        rawId: knowledge.rawId,
      })),
      edges: relations
        .filter(
          (relation) =>
            knowledgeIds.has(relation.sourceId) &&
            knowledgeIds.has(relation.targetId),
        )
        .map((relation) => ({
          id: relation.id,
          source: relation.sourceId,
          target: relation.targetId,
          type: relation.type,
          reason: relation.reason,
        })),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "GRAPH_READ_FAILED", message: "暂时无法读取知识网络，请稍后重试。" } },
      { status: 500 },
    );
  }
}
