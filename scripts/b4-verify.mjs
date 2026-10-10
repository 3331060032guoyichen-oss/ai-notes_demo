// B4 批次端到端验证：links 写路径（建立 / 无序去重 / 软删除 / 复活）。
//
// 用法：先跑 `pnpm dev`，再 `node --env-file=.env.local scripts/b4-verify.mjs`
import { Pool } from "@neondatabase/serverless";

const BASE = process.env.B4_BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const line = (s) => console.log(s);
const json = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const send = (method) => (path, payload) =>
  json(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
const POST = send("POST");
const DELETE = send("DELETE");

const makeDraft = (title) => ({
  title,
  summary: `${title} 摘要`,
  content: `${title} 正文`,
  keyPoints: [],
  concepts: [],
  keywords: [],
  relatedKnowledge: [],
});

const waitForServer = async () => {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/relations`);
      if (res.ok) return true;
    } catch {
      /* 未就绪 */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

const created = { raws: [], notes: [], links: [] };

try {
  if (!(await waitForServer())) {
    line("SERVER=FAIL");
    process.exit(1);
  }
  line("SERVER=ok");

  // 1) 两条原话 + 两篇知识页
  const ids = [];
  for (const tag of ["A", "B"]) {
    const raw = await POST("/api/raw", { text: `B4 验证原话 ${tag}` });
    created.raws.push(raw.body.raw.id);
    const note = await POST("/api/knowledge", {
      rawId: raw.body.raw.id,
      draft: makeDraft(`B4 验证知识页 ${tag}`),
      origin: "user",
    });
    created.notes.push(note.body.knowledge.id);
    ids.push(note.body.knowledge.id);
  }
  const [na, nb] = ids;

  // 2) 建立关系（正方向）
  const c1 = await POST("/api/relations", { sourceId: na, targetId: nb, type: "related", reason: "B4 理由" });
  const linkId = c1.body?.relation?.id ?? null;
  if (linkId) created.links.push(linkId);
  line(`create=${c1.status} created=${c1.body?.created} orientation=${c1.body?.relation?.sourceId === na ? "A→B" : "B→A"}`);

  // 3) 重复提交（同方向）
  const c2 = await POST("/api/relations", { sourceId: na, targetId: nb, type: "related", reason: "B4 理由" });
  line(`create_again=${c2.status} created=${c2.body?.created} sameId=${c2.body?.relation?.id === linkId}`);

  // 4) 反方向提交 —— 旧实现按"无序对"去重，应返回同一条
  const c3 = await POST("/api/relations", { sourceId: nb, targetId: na, type: "related", reason: "B4 理由" });
  line(`create_reversed=${c3.status} created=${c3.body?.created} sameId=${c3.body?.relation?.id === linkId}`);

  // 5) 读路径
  const list = await json("/api/relations");
  const detail = await json(`/api/knowledge/${na}/relations`);
  const back = await json(`/api/knowledge/${na}/backlinks`);
  line(
    `read list_has=${(list.body.relations ?? []).some((r) => r.id === linkId)} ` +
      `note_relations=${detail.body.relations?.length} ` +
      `backlinks_has_other=${(back.body.backlinks ?? []).some((k) => k.id === nb)}`,
  );

  // 6) 软删除
  const del = await DELETE(`/api/relations/${linkId}`, {});
  line(`soft_delete=${del.status}`);

  const listAfter = await json("/api/relations");
  const detailAfter = await json(`/api/knowledge/${na}/relations`);
  const row = (
    await q(`select deleted_at is not null as deleted from links where id = $1`, [linkId])
  )[0];
  line(
    `after_delete hidden_from_list=${!(listAfter.body.relations ?? []).some((r) => r.id === linkId)} ` +
      `hidden_from_note=${detailAfter.body.relations?.length === 0} ` +
      `row_kept=${Boolean(row)} soft_deleted_flag=${row?.deleted}`,
  );

  // 7) 重新建立同一关系 → 复活（不插新行）
  const revived = await POST("/api/relations", { sourceId: na, targetId: nb, type: "related", reason: "B4 复活理由" });
  const countRows = await q(`select count(*)::int as n from links`);
  line(
    `revive=${revived.status} created=${revived.body?.created} sameId=${revived.body?.relation?.id === linkId} ` +
      `total_link_rows=${countRows[0].n}`,
  );

  const listRevived = await json("/api/relations");
  line(`visible_again=${(listRevived.body.relations ?? []).some((r) => r.id === linkId)}`);

  // 8) 校验与 404
  const self = await POST("/api/relations", { sourceId: na, targetId: na, type: "related", reason: "x" });
  const badType = await POST("/api/relations", { sourceId: na, targetId: nb, type: "supports", reason: "x" });
  const noReason = await POST("/api/relations", { sourceId: na, targetId: nb, type: "related", reason: "  " });
  const missing = await POST("/api/relations", { sourceId: na, targetId: "knowledge_nope", type: "related", reason: "x" });
  line(
    `validation self=${self.status}/${self.body?.error?.code} type=${badType.status}/${badType.body?.error?.code} ` +
      `reason=${noReason.status}/${noReason.body?.error?.code} missing=${missing.status}/${missing.body?.error?.code}`,
  );
  const delAgain = await DELETE(`/api/relations/${linkId}`, {});
  const delBogus = await DELETE(`/api/relations/link_does_not_exist`, {});
  line(`delete_again=${delAgain.status} delete_bogus=${delBogus.status}`);
} catch (error) {
  line(`ERROR=${error.message}`);
} finally {
  // 删除顺序：links → revisions → notes → raws（revisions/links 对 notes 是 RESTRICT）
  if (created.notes.length) {
    await q(`delete from links where source_note_id = any($1) or target_note_id = any($1)`, [created.notes]).catch(() => {});
    await q(`delete from note_revisions where note_id = any($1)`, [created.notes]).catch(() => {});
    await q(`delete from notes where id = any($1)`, [created.notes]).catch(() => {});
  }
  if (created.raws.length) {
    await q(`delete from raw_notes where id = any($1)`, [created.raws]).catch(() => {});
  }
  const left = await q(
    `select
       (select count(*)::int from notes where id = any($1)) as notes,
       (select count(*)::int from raw_notes where id = any($2)) as raws,
       (select count(*)::int from links where id = any($3)) as links,
       (select count(*)::int from note_revisions where note_id = any($1)) as revisions`,
    [created.notes.length ? created.notes : ["none"], created.raws.length ? created.raws : ["none"], created.links.length ? created.links : ["none"]],
  );
  line(`cleanup_leftovers=${JSON.stringify(left[0])}`);
  await pool.end();
}
