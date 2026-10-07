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
          message: "暂时无法读取 Wiki 结构，请稍后重试。",
        },
      },
      { status: 500 },
    );
  }
}
