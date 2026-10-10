// 最基本的回归测试：覆盖全部 10 个 API 路由 + 跨用户归属隔离。
// 与 b1–b4-verify.mjs 的区别：这批是**断言**，有 pass/fail 与退出码，可直接当门禁用。
//
// 用法：
//   1) 另开终端 `pnpm dev`
//   2) `pnpm test:regression`
//
// 安全性：所有写入都在 finally 中清理；不打印连接串。
import { Pool } from "@neondatabase/serverless";

const BASE = process.env.REGRESSION_BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const OTHER_USER = "other-user-regression";
const OR = "raw_reg_other";
const ON = "knowledge_reg_other";
const LINK_OTHER = "link_reg_other";

const results = [];
const check = (label, ok, detail = "") => results.push({ label, ok: Boolean(ok), detail });

const call = async (method, path, payload) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    ...(payload === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const GET = (p) => call("GET", p);
const POST = (p, b) => call("POST", p, b ?? {});
const PATCH = (p, b) => call("PATCH", p, b ?? {});
const DELETE = (p, b) => call("DELETE", p, b ?? {});

const draft = (title) => ({
  title,
  summary: `${title} 摘要`,
  content: `${title} 正文`,
  keyPoints: ["点"],
  concepts: ["概念"],
  keywords: ["关键词"],
  relatedKnowledge: [],
});

const created = { raws: [], notes: [], links: [] };

try {
  // 前置：服务必须可用
  let up = false;
  for (let i = 0; i < 15 && !up; i += 1) {
    try {
      up = (await GET("/api/raw")).status === 200;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!up) {
    console.log("FAIL  服务不可用：请先在另一个终端运行 `pnpm dev`，然后重跑本测试。");
    process.exitCode = 1;
    await pool.end();
    process.exit(1);
  }

  // ---- raw --------------------------------------------------------------
  const rawA = await POST("/api/raw", { text: "回归测试原话 A" });
  const rawB = await POST("/api/raw", { text: "回归测试原话 B" });
  const rawAId = rawA.body?.raw?.id;
  const rawBId = rawB.body?.raw?.id;
  created.raws.push(rawAId, rawBId);
  check("POST /api/raw 创建 201", rawA.status === 201 && Boolean(rawAId));
  check(
    "POST /api/raw 响应形状",
    JSON.stringify(Object.keys(rawA.body?.raw ?? {}).sort()) === '["createdAt","id","text"]',
  );

  const empty = await POST("/api/raw", { text: "   " });
  const tooLong = await POST("/api/raw", { text: "x".repeat(50_001) });
  check("POST /api/raw 空文本 400", empty.status === 400 && empty.body?.error?.code === "TEXT_EMPTY");
  check("POST /api/raw 超长 400", tooLong.status === 400 && tooLong.body?.error?.code === "TEXT_TOO_LONG");

  const rawList = await GET("/api/raw");
  const rawIds = (rawList.body?.raws ?? []).map((r) => r.id);
  check("GET /api/raw 包含新建项", rawIds.includes(rawAId) && rawIds.includes(rawBId));

  // ---- knowledge --------------------------------------------------------
  const p1 = await POST("/api/knowledge", { rawId: rawAId, draft: draft("回归知识页 A"), origin: "user" });
  const noteA = p1.body?.knowledge?.id;
  created.notes.push(noteA);
  check("POST /api/knowledge 提升 201", p1.status === 201 && p1.body?.created === true);
  check("POST /api/knowledge 初始 version=1", p1.body?.knowledge?.version === 1);

  const p2 = await POST("/api/knowledge", { rawId: rawAId, draft: draft("回归知识页 A"), origin: "user" });
  check("POST /api/knowledge 幂等（200 同 id）", p2.status === 200 && p2.body?.created === false && p2.body?.knowledge?.id === noteA);

  const p3 = await POST("/api/knowledge", { rawId: rawBId, draft: draft("回归知识页 B"), origin: "user" });
  const noteB = p3.body?.knowledge?.id;
  created.notes.push(noteB);
  check("POST /api/knowledge 第二篇 201", p3.status === 201);

  const kList = await GET("/api/knowledge");
  check("GET /api/knowledge 包含新建项", (kList.body?.knowledges ?? []).some((k) => k.id === noteA));

  const detail = await GET(`/api/knowledge/${noteA}`);
  check("GET /api/knowledge/:id 返回知识页与原始出处", detail.status === 200 && detail.body?.raw?.text === "回归测试原话 A");

  const up1 = await PATCH(`/api/knowledge/${noteA}`, { title: "回归改过的标题" });
  const v2 = up1.body?.knowledge?.version;
  check("PATCH 不带 version 可写且版本 +1", up1.status === 200 && v2 === 2);

  const stale = await PATCH(`/api/knowledge/${noteA}`, { summary: "过期写入", version: 1 });
  check("PATCH 过期 version → 409 且不写入", stale.status === 409 && stale.body?.error?.code === "VERSION_CONFLICT");

  const up2 = await PATCH(`/api/knowledge/${noteA}`, { summary: "正确版本写入", version: v2 });
  check("PATCH 正确 version → 200 且版本 +1", up2.status === 200 && up2.body?.knowledge?.version === 3);

  const emptyPatch = await PATCH(`/api/knowledge/${noteA}`, { version: 3 });
  const badVersion = await PATCH(`/api/knowledge/${noteA}`, { summary: "x", version: "3" });
  check("PATCH 空改动 400", emptyPatch.status === 400 && emptyPatch.body?.error?.code === "EMPTY_PATCH");
  check("PATCH 非法 version 400", badVersion.status === 400 && badVersion.body?.error?.code === "INVALID_VERSION");

  const revisions = await q(`select count(*)::int as n from note_revisions where note_id = $1`, [noteA]);
  check("修订历史随每次写入增长（3 条）", revisions[0].n === 3, `实际 ${revisions[0].n}`);

  const jsonbShapes = await q(
    `select jsonb_typeof(concepts) as concepts, jsonb_typeof(key_points) as key_points
       from notes where id = $1`,
    [noteA],
  );
  check(
    "jsonb 列存的是真数组（不是被二次编码的字符串）",
    jsonbShapes[0].concepts === "array" && jsonbShapes[0].key_points === "array",
    JSON.stringify(jsonbShapes[0]),
  );

  // ---- raw 修改（user_edit：用户可改，且必须留修订记录）------------------
  const editedText = "回归测试原话 B（已修改）";
  const rawEdit = await PATCH(`/api/raw/${rawBId}`, { text: editedText });
  check("PATCH /api/raw/:id 修改 200", rawEdit.status === 200 && rawEdit.body?.changed === true);
  check(
    "PATCH /api/raw/:id 响应形状不变",
    JSON.stringify(Object.keys(rawEdit.body?.raw ?? {}).sort()) === '["createdAt","id","text"]',
  );

  const rawAfterEdit = await GET("/api/raw");
  check(
    "PATCH 后列表读到新正文",
    (rawAfterEdit.body?.raws ?? []).some((r) => r.id === rawBId && r.text === editedText),
  );

  const detailAfterEdit = await GET(`/api/knowledge/${noteB}`);
  check("PATCH 后知识页出处同步为新正文", detailAfterEdit.body?.raw?.text === editedText);

  const rawNoop = await PATCH(`/api/raw/${rawBId}`, { text: editedText });
  check("PATCH 相同内容 → 200 且标记未改动", rawNoop.status === 200 && rawNoop.body?.changed === false);

  const rawEmpty = await PATCH(`/api/raw/${rawBId}`, { text: "   " });
  const rawLong = await PATCH(`/api/raw/${rawBId}`, { text: "x".repeat(50_001) });
  const rawNoText = await PATCH(`/api/raw/${rawBId}`, {});
  const rawMissing = await PATCH("/api/raw/raw_does_not_exist", { text: "x" });
  check("PATCH 空文本 400", rawEmpty.status === 400 && rawEmpty.body?.error?.code === "TEXT_EMPTY");
  check("PATCH 超长 400", rawLong.status === 400 && rawLong.body?.error?.code === "TEXT_TOO_LONG");
  check("PATCH 缺 text 400", rawNoText.status === 400 && rawNoText.body?.error?.code === "TEXT_REQUIRED");
  check(
    "PATCH 不存在的 raw → 404",
    rawMissing.status === 404 && rawMissing.body?.error?.code === "RAW_NOT_FOUND",
  );

  const rawRevisions = await q(
    `select count(*)::int as n,
            max(detail->>'before') as before,
            max(detail->>'after') as after
       from audit_log
      where operation = 'raw.update' and target_id = $1`,
    [rawBId],
  );
  check(
    "PATCH 留下修订记录（含改前原文）",
    rawRevisions[0].n === 1 &&
      rawRevisions[0].before === "回归测试原话 B" &&
      rawRevisions[0].after === editedText,
    JSON.stringify(rawRevisions[0]),
  );

  // ---- links ------------------------------------------------------------
  const r1 = await POST("/api/relations", { sourceId: noteA, targetId: noteB, type: "related", reason: "回归理由" });
  const linkId = r1.body?.relation?.id;
  created.links.push(linkId);
  check("POST /api/relations 建立 201", r1.status === 201 && r1.body?.created === true);

  const r2 = await POST("/api/relations", { sourceId: noteA, targetId: noteB, type: "related", reason: "回归理由" });
  const r3 = await POST("/api/relations", { sourceId: noteB, targetId: noteA, type: "related", reason: "回归理由" });
  check("POST /api/relations 重复去重（200 同 id）", r2.status === 200 && r2.body?.relation?.id === linkId);
  check("POST /api/relations 反向视为同一条", r3.status === 200 && r3.body?.relation?.id === linkId);

  const selfRel = await POST("/api/relations", { sourceId: noteA, targetId: noteA, type: "related", reason: "x" });
  const badRel = await POST("/api/relations", { sourceId: noteA, targetId: noteB, type: "supports", reason: "x" });
  check("POST /api/relations 自环 400", selfRel.body?.error?.code === "SELF_RELATION");
  check("POST /api/relations 非法类型 400", badRel.body?.error?.code === "RELATION_TYPE_INVALID");

  const relList = await GET("/api/relations");
  const noteRels = await GET(`/api/knowledge/${noteA}/relations`);
  const backlinks = await GET(`/api/knowledge/${noteA}/backlinks`);
  check("GET /api/relations 命中", (relList.body?.relations ?? []).some((r) => r.id === linkId));
  check("GET .../relations 命中 1 条", noteRels.body?.relations?.length === 1);
  check("GET .../backlinks 返回对端", (backlinks.body?.backlinks ?? []).some((k) => k.id === noteB));

  const graph = await GET("/api/graph");
  check("GET /api/graph 节点=2 边=1", graph.body?.nodes?.length === 2 && graph.body?.edges?.length === 1);
  check(
    "GET /api/graph 形状不变",
    JSON.stringify(Object.keys(graph.body?.nodes?.[0] ?? {}).sort()) === '["id","rawId","title"]' &&
      JSON.stringify(Object.keys(graph.body?.edges?.[0] ?? {}).sort()) === '["id","reason","source","target","type"]',
  );

  const delLink = await DELETE(`/api/relations/${linkId}`);
  const relListAfter = await GET("/api/relations");
  const linkRow = (await q(`select deleted_at is not null as d from links where id = $1`, [linkId]))[0];
  check("DELETE /api/relations/:id → 204", delLink.status === 204);
  check("软删后列表隐藏", !(relListAfter.body?.relations ?? []).some((r) => r.id === linkId));
  check("软删后数据库行仍在", Boolean(linkRow) && linkRow.d === true);

  const revived = await POST("/api/relations", { sourceId: noteA, targetId: noteB, type: "related", reason: "复活" });
  const linkCount = await q(`select count(*)::int as n from links where user_id = $1`, ["demo-user"]);
  check("重建关系 = 复活（同 id，未新增行）", revived.status === 201 && revived.body?.relation?.id === linkId && linkCount[0].n === 1, `行数 ${linkCount[0].n}`);

  const delAgain = await DELETE(`/api/relations/${linkId}`);
  check("DELETE /api/relations/:id 再次 → 204", delAgain.status === 204);

  // ---- 引用守卫 / AI 端点读路径 -----------------------------------------
  const blocked = await DELETE("/api/raw", { rawId: rawBId });
  check("DELETE /api/raw 被引用 → 409", blocked.status === 409 && blocked.body?.error?.code === "RAW_REFERENCED_BY_KNOWLEDGE");

  const orgBogus = await POST("/api/organize", { rawId: "raw_reg_nope" });
  const askBogus = await POST("/api/assistant", { question: "q", contextType: "knowledge", contextId: "knowledge_reg_nope" });
  check("POST /api/organize 无效 id → 404", orgBogus.status === 404 && orgBogus.body?.error?.code === "RAW_NOT_FOUND");
  check("POST /api/assistant 无效 id → 404", askBogus.status === 404 && askBogus.body?.error?.code === "KNOWLEDGE_NOT_FOUND");

  const orgOk = await POST("/api/organize", { rawId: rawAId });
  const askOk = await POST("/api/assistant", { question: "q", contextType: "knowledge", contextId: noteA });
  // 无 DEEPSEEK_API_KEY 时为 503；配了 key 则为 200。两者都说明"读路径通了"，只有 500 算失败。
  check("POST /api/organize 读路径可用（非 500）", orgOk.status !== 500, `status=${orgOk.status}`);
  check("POST /api/assistant 读路径可用（非 500）", askOk.status !== 500, `status=${askOk.status}`);

  // ---- 归属隔离 ---------------------------------------------------------
  await q(`delete from links where id = $1`, [LINK_OTHER]).catch(() => {});
  await q(`delete from notes where id = $1`, [ON]).catch(() => {});
  await q(`delete from raw_notes where id = $1`, [OR]).catch(() => {});
  await q(`insert into raw_notes (id, user_id, text) values ($1,$2,$3)`, [OR, OTHER_USER, "他人原话"]);
  await q(
    `insert into notes (id, user_id, raw_id, title, summary, content) values ($1,$2,$3,$4,$5,$6)`,
    [ON, OTHER_USER, OR, "他人知识页", "s", "c"],
  );

  const isoRaws = await GET("/api/raw");
  const isoNotes = await GET("/api/knowledge");
  const isoGraph = await GET("/api/graph");
  check("隔离：GET /api/raw 不含他人数据", !(isoRaws.body?.raws ?? []).some((r) => r.id === OR));
  check("隔离：GET /api/knowledge 不含他人数据", !(isoNotes.body?.knowledges ?? []).some((k) => k.id === ON));
  check("隔离：GET /api/graph 不含他人节点", !(isoGraph.body?.nodes ?? []).some((n) => n.id === ON));

  const isoDetail = await GET(`/api/knowledge/${ON}`);
  const isoPatch = await PATCH(`/api/knowledge/${ON}`, { title: "越权" });
  const isoArchive = await DELETE("/api/raw", { rawId: OR });
  const isoPromote = await POST("/api/knowledge", { rawId: OR, draft: draft("越权") });
  const isoRel = await POST("/api/relations", { sourceId: ON, targetId: noteA, type: "related", reason: "越权" });
  const isoRawPatch = await PATCH(`/api/raw/${OR}`, { text: "越权修改" });
  check("隔离：详情 404", isoDetail.status === 404);
  check("隔离：PATCH 他人笔记 404", isoPatch.status === 404);
  check("隔离：归档他人原话 404", isoArchive.status === 404);
  check("隔离：提升他人原话 404", isoPromote.status === 404);
  check(
    "隔离：修改他人原话 404",
    isoRawPatch.status === 404 && isoRawPatch.body?.error?.code === "RAW_NOT_FOUND",
  );
  check("隔离：用他人笔记建关系 404", isoRel.status === 404);

  const untouched = (
    await q(`select title, (select count(*)::int from notes where user_id = $1) as n from notes where id = $2`, [OTHER_USER, ON])
  )[0];
  const otherRaw = (await q(`select text from raw_notes where id = $1`, [OR]))[0];
  check("隔离：他人数据未被改动", untouched?.title === "他人知识页" && untouched?.n === 1);
  check("隔离：他人原话未被改动", otherRaw?.text === "他人原话");
} catch (error) {
  check("测试执行未抛异常", false, error.message);
} finally {
  // 清理：links → note_revisions → notes → raw_notes（RESTRICT 外键要求这个顺序）
  for (const id of created.notes.filter(Boolean)) {
    await q(`delete from links where source_note_id = $1 or target_note_id = $1`, [id]).catch(() => {});
    await q(`delete from note_revisions where note_id = $1`, [id]).catch(() => {});
    await q(`delete from notes where id = $1`, [id]).catch(() => {});
  }
  for (const id of created.raws.filter(Boolean)) {
    await q(`delete from audit_log where target_id = $1`, [id]).catch(() => {});
    await q(`delete from raw_notes where id = $1`, [id]).catch(() => {});
  }
  await q(`delete from audit_log where target_id = $1`, [OR]).catch(() => {});
  await q(`delete from links where id = $1`, [LINK_OTHER]).catch(() => {});
  await q(`delete from notes where id = $1`, [ON]).catch(() => {});
  await q(`delete from raw_notes where id = $1`, [OR]).catch(() => {});

  const left = await q(
    `select
       (select count(*)::int from raw_notes) as raws,
       (select count(*)::int from notes) as notes,
       (select count(*)::int from links) as links,
       (select count(*)::int from note_revisions) as revisions,
       (select count(*)::int from audit_log) as audit`,
  );
  check(
    "清理后库内为 0",
    JSON.stringify(left[0]) === '{"raws":0,"notes":0,"links":0,"revisions":0,"audit":0}',
    JSON.stringify(left[0]),
  );

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail ? `  → ${r.detail}` : ""}`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\nSUMMARY pass=${results.length - failed.length} fail=${failed.length}`);
  process.exitCode = failed.length > 0 ? 1 : 0;
  await pool.end();
}
