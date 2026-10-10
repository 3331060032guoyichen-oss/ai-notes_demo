// B3 批次端到端验证：notes 写路径（手动提升 + 版本检查 + 修订历史）。
//
// 用法：先跑 `pnpm dev`，再 `node --env-file=.env.local scripts/b3-verify.mjs`
// 安全性：测试数据在 finally 中清理，结束断言清零；不打印连接串。
import { Pool } from "@neondatabase/serverless";

const BASE = process.env.B3_BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const out = [];
const line = (s) => {
  out.push(s);
  console.log(s);
};

const json = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const send = (method) => (path, payload) =>
  json(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
const POST = send("POST");
const PATCH = send("PATCH");
const DELETE = send("DELETE");

const waitForServer = async () => {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/knowledge`);
      if (res.ok) return true;
    } catch {
      /* 未就绪 */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

const draft = {
  title: "B3 验证知识页",
  summary: "摘要",
  content: "正文",
  keyPoints: ["点一"],
  concepts: ["概念A"],
  keywords: ["关键词A"],
  relatedKnowledge: [],
};

let rawId = null;
let noteId = null;

try {
  if (!(await waitForServer())) {
    line("SERVER=FAIL");
    process.exit(1);
  }
  line("SERVER=ok");

  const raw = await POST("/api/raw", { text: "B3 验证原话" });
  rawId = raw.body?.raw?.id ?? null;
  line(`raw_created=${raw.status} id=${rawId ? "yes" : "no"}`);

  // 1) 手动提升（draft 形状由调用方组装，不依赖 AI）
  const promote = await POST("/api/knowledge", { rawId, draft, origin: "user" });
  noteId = promote.body?.knowledge?.id ?? null;
  const v1 = promote.body?.knowledge?.version;
  line(
    `promote=${promote.status} created=${promote.body?.created} version=${v1} ` +
      `keys=${promote.body?.knowledge ? Object.keys(promote.body.knowledge).sort().join(",") : "-"}`,
  );

  // 2) 幂等：同一 rawId 再提升一次
  const again = await POST("/api/knowledge", { rawId, draft, origin: "user" });
  line(`promote_again=${again.status} created=${again.body?.created} sameId=${again.body?.knowledge?.id === noteId}`);

  // 3) 列表与详情
  const list = await json("/api/knowledge");
  line(`list_contains=${(list.body?.knowledges ?? []).some((k) => k.id === noteId)}`);
  const detail = await json(`/api/knowledge/${noteId}`);
  line(`detail=${detail.status} rawTextMatches=${detail.body?.raw?.text === "B3 验证原话"}`);

  // 4) 更新（不带 version → last-write-wins，version 自增）
  const up1 = await PATCH(`/api/knowledge/${noteId}`, { title: "B3 改过的标题" });
  const v2 = up1.body?.knowledge?.version;
  line(`patch_no_version=${up1.status} version=${v2} title=${up1.body?.knowledge?.title}`);

  // 5) 修订历史应有 2 条
  const revs = await q(
    `select version, author_type from note_revisions where note_id = $1 order by version`,
    [noteId],
  );
  line(`revisions=${JSON.stringify(revs.map((r) => `${r.version}:${r.author_type}`))}`);

  // 6) 版本冲突
  // 用"客户端可见的旧版本号"触发冲突（乐观并发的真实用法）
  const conflict = await PATCH(`/api/knowledge/${noteId}`, { summary: "过期写入", version: v1 });
  line(`patch_stale=${conflict.status}/${conflict.body?.error?.code ?? "-"}`);

  // 7) 正确版本可写
  const up2 = await PATCH(`/api/knowledge/${noteId}`, { summary: "正确版本写入", version: v2 });
  line(`patch_current=${up2.status} version=${up2.body?.knowledge?.version}`);

  // 8) 参数校验
  const badVersion = await PATCH(`/api/knowledge/${noteId}`, { summary: "x", version: "1" });
  line(`patch_bad_version=${badVersion.status}/${badVersion.body?.error?.code ?? "-"}`);
  const emptyPatch = await PATCH(`/api/knowledge/${noteId}`, { version: 1 });
  line(`patch_empty=${emptyPatch.status}/${emptyPatch.body?.error?.code ?? "-"}`);

  // 9) 被引用的原始记录仍不能移除（跨批次一致性）
  const blocked = await DELETE("/api/raw", { rawId });
  line(`delete_raw_referenced=${blocked.status}/${blocked.body?.error?.code ?? "-"}`);

  // 10) 修订总数应为 3（v1 提升 + v1 无版本更新 + v2 正确版本更新）
  const total = await q(`select count(*)::int as n from note_revisions where note_id = $1`, [noteId]);
  line(`revisions_total=${total[0].n}`);
} catch (error) {
  line(`ERROR=${error.message}`);
} finally {
  // 删除顺序：修订必须先删——note_revisions.note_id 是 RESTRICT，直接删 notes 会被外键挡住
  if (noteId) {
    await q(`delete from note_revisions where note_id = $1`, [noteId]).catch(() => {});
    await q(`delete from links where source_note_id = $1 or target_note_id = $1`, [noteId]).catch(() => {});
    await q(`delete from notes where id = $1`, [noteId]).catch(() => {});
  }
  if (rawId) await q(`delete from raw_notes where id = $1`, [rawId]).catch(() => {});
  const leftovers = await q(
    `select
       (select count(*)::int from notes where id = $1) as notes,
       (select count(*)::int from raw_notes where id = $2) as raws,
       (select count(*)::int from note_revisions where note_id = $1) as revisions`,
    [noteId ?? "none", rawId ?? "none"],
  );
  line(`cleanup_leftovers=${JSON.stringify(leftovers[0])}`);
  await pool.end();
}
