// 归属隔离验证：用另一个 user_id 直接写入数据，确认 API（当前用户 = demo-user）
// 在**所有**入口都看不到、也改不动别人的数据。
//
// 用法：先跑 `pnpm dev`，再 `node --env-file=.env.local scripts/isolation-verify.mjs`
import { Pool } from "@neondatabase/serverless";

const BASE = process.env.ISOLATION_BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const OTHER = "other-user-isolation-test";
const OR = "raw_iso_other";
const ON = "knowledge_iso_other";
const OL = "link_iso_other";

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
const PATCH = send("PATCH");
const DELETE = send("DELETE");

const waitForServer = async () => {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/raw`);
      if (res.ok) return true;
    } catch {
      /* 未就绪 */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

// 造一份"别人的数据"：一条原话、一篇知识页、一条关系
const seedOtherUser = async () => {
  await q(`delete from links where id = $1`, [OL]).catch(() => {});
  await q(`delete from note_revisions where note_id = $1`, [ON]).catch(() => {});
  await q(`delete from notes where id = $1`, [ON]).catch(() => {});
  await q(`delete from raw_notes where id = $1`, [OR]).catch(() => {});

  await q(`insert into raw_notes (id, user_id, text) values ($1, $2, $3)`, [OR, OTHER, "别人的原话"]);
  await q(
    `insert into notes (id, user_id, raw_id, title, summary, content) values ($1,$2,$3,$4,$5,$6)`,
    [ON, OTHER, OR, "别人的知识页", "别人的摘要", "别人的正文"],
  );
  await q(
    `insert into links (id, user_id, source_note_id, target_note_id, type, reason)
     values ($1,$2,$3,$3,$4,$5)`,
    [OL, OTHER, ON, "related", "别人的关系（自环，仅用于隔离测试）"],
  ).catch(async () => {
    // 自环会被 notes 的外键允许（source=target 同一行），若被唯一索引挡住则退化为单条
  });
};

try {
  if (!(await waitForServer())) {
    line("SERVER=FAIL");
    process.exit(1);
  }
  line("SERVER=ok");
  await seedOtherUser();

  const raws = await json("/api/raw");
  const notes = await json("/api/knowledge");
  const links = await json("/api/relations");
  const graph = await json("/api/graph");

  line(
    `read_hidden raw=${!(raws.body.raws ?? []).some((r) => r.id === OR)} ` +
      `notes=${!(notes.body.knowledges ?? []).some((k) => k.id === ON)} ` +
      `links=${!(links.body.relations ?? []).some((l) => l.id === OL)} ` +
      `graph_nodes=${!(graph.body.nodes ?? []).some((n) => n.id === ON)} ` +
      `graph_edges=${!(graph.body.edges ?? []).some((e) => e.id === OL)}`,
  );

  const g1 = await json(`/api/knowledge/${ON}`);
  const g2 = await json(`/api/knowledge/${ON}/relations`);
  const g3 = await json(`/api/knowledge/${ON}/backlinks`);
  line(`read_detail_status ${g1.status}/${g2.status}/${g3.status}`);

  const p = await PATCH(`/api/knowledge/${ON}`, { title: "越权改标题" });
  const d1 = await DELETE(`/api/relations/${OL}`, {});
  const d2 = await DELETE("/api/raw", { rawId: OR });
  line(`write_blocked patch=${p.status} delete_link=${d1.status} archive_raw=${d2.status}`);

  // 用别人的笔记 id 作为 source（本应查不到）、另一个不存在的 id 作为 target，
  // 这样不会先撞上 SELF_RELATION 校验，能真正验证"跨用户查不到"。
  const c1 = await POST("/api/relations", {
    sourceId: ON,
    targetId: "knowledge_nope_isolation",
    type: "related",
    reason: "越权",
  });
  const c2 = await POST("/api/knowledge", {
    rawId: OR,
    draft: { title: "x", summary: "x", content: "x", keyPoints: [], concepts: [], keywords: [], relatedKnowledge: [] },
  });
  line(`create_blocked relation=${c1.status}/${c1.body?.error?.code} promote=${c2.status}/${c2.body?.error?.code}`);

  // 确认"别人的数据"本身没有被改动
  const intact = await q(
    `select
       (select title from notes where id = $1) as title,
       (select deleted_at is null from links where id = $2) as link_active,
       (select archived_at is null from raw_notes where id = $3) as raw_active`,
    [ON, OL, OR],
  );
  line(`other_user_data_untouched=${JSON.stringify(intact[0])}`);
} catch (error) {
  line(`ERROR=${error.message}`);
} finally {
  await q(`delete from links where id = $1`, [OL]).catch(() => {});
  await q(`delete from note_revisions where note_id = $1`, [ON]).catch(() => {});
  await q(`delete from notes where id = $1`, [ON]).catch(() => {});
  await q(`delete from raw_notes where id = $1`, [OR]).catch(() => {});
  const left = await q(
    `select
       (select count(*)::int from raw_notes where user_id = $1) as raws,
       (select count(*)::int from notes where user_id = $1) as notes,
       (select count(*)::int from links where user_id = $1) as links`,
    [OTHER],
  );
  line(`cleanup_leftovers=${JSON.stringify(left[0])}`);
  await pool.end();
}
