import { NextResponse } from "next/server";

import { deleteRelation } from "../../../../lib/relation-storage";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const deleted = await deleteRelation(id);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: "RELATION_NOT_FOUND", message: "找不到对应的知识关系。" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: { code: "RELATION_STORAGE_WRITE_FAILED", message: "暂时无法删除知识关系，请稍后重试。" } },
      { status: 500 },
    );
  }
}
