import { NextResponse } from "next/server";

import { getWiki } from "../../../lib/wiki-storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getWiki());
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "WIKI_READ_FAILED",
          message: "参考库暂时没有载入。其他内容没有受到影响，请稍后重试。",
        },
      },
      { status: 500 },
    );
  }
}
