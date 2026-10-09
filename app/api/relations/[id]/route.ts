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
        { error: { code: "RELATION_NOT_FOUND", message: "这条交叉引用已不存在，请刷新知识网络。" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: { code: "RELATION_STORAGE_WRITE_FAILED", message: "这条交叉引用暂时无法移除。知识页没有受到影响，请稍后重试。" } },
      { status: 500 },
    );
  }
}
