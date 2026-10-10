import { NextResponse } from "next/server";

import { softDeleteLink } from "../../../../lib/services/links";

export const runtime = "nodejs";

/**
 * 移除交叉引用 = 软删除（写 `deleted_at`），不做物理删除。
 * 关系被误删后仍可恢复，也保留了"曾经建立过这条关系"的痕迹。
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const deleted = await softDeleteLink(id);

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
