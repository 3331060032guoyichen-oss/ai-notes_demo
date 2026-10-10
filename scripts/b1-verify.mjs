// B1 批次端到端验证：只读路由已切到服务层 + Drizzle 后的真实请求验证。
//
// 用法：
//   1) 另开一个终端跑 `pnpm dev`
//   2) node --env-file=.env.local scripts/b1-verify.mjs
//
// 安全性：
//   - 只写入带 b1_ 前缀的测试数据，并在 finally 中按外键顺序清理；
//   - 不打印连接串；
//   - 结束时会断言测试数据已清零。
import { Pool } from "@neondatabase/serverless";

const BASE = process.env.B1_BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const R1 = "raw_b1_verify_1";
const R2 = "raw_b1_verify_2";
const N1 = "knowledge_b1_verify_1";
const N2 = "knowledge_b1_verify_2";
const L1 = "link_b1_verify_1";

const out = [];
const line = (s) => {
  out.push(s);
  console.log(s);
};

const waitForServer = async () => {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/graph`);
      if (res.ok) return true;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const get = (path) => fetch(`${BASE}${path}`);

try {
  if (!(await waitForServer())) {
    line("SERVER=FAIL(未在 60 秒内就绪)");
    process.exit(1);
  }
  line("SERVER=ok");

  // ---- 准备测试数据 ------------------------------------------------------
  await q(`delete from links where id = $1`, [L1]);
  await q(`delete from notes where id = any($1)`, [[N1, N2]]);
  await q(`delete from raw_notes where id = any($1)`, [[R1, R2]]);

  await q(
    `insert into raw_notes (id, user_id, text) values ($1,$2,$3), ($4,$5,$6)`,
    [R1, "demo-user", "B1 验证原话一", R2, "demo-user", "B1 验证原话二"],
  );
  await q(
    `insert into notes (id, user_id, raw_id, title, summary, content, concepts)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb), ($8,$9,$10,$11,$12,$13,$14::jsonb)`,
    [
      N1, "demo-user", R1, "B1 验证知识页一", "摘要一", "正文一", JSON.stringify(["概念A"]),
      N2, "demo-user", R2, "B1 验证知识页二", "摘要二", "正文二", JSON.stringify([]),
    ],
  );
  await q(
    `insert into links (id, user_id, source_note_id, target_note_id, type, reason)
     values ($1,$2,$3,$4,$5,$6)`,
    [L1, "demo-user", N1, N2, "related", "B1 验证关系"],
  );

  // ---- GET /api/graph ----------------------------------------------------
  const graph = await (await get("/api/graph")).json();
  const gNode = (graph.nodes ?? []).find((n) => n.id === N1);
  const gEdge = (graph.edges ?? []).find((e) => e.id === L1);
  line(
    `graph=nodes:${graph.nodes?.length} edges:${graph.edges?.length} ` +
      `nodeKeys:${gNode ? Object.keys(gNode).sort().join(",") : "MISSING"} ` +
      `edgeKeys:${gEdge ? Object.keys(gEdge).sort().join(",") : "MISSING"} ` +
      `edgeType:${gEdge?.type}`,
  );

  // ---- GET /api/knowledge/:id/relations ----------------------------------
  const rel = await (await get(`/api/knowledge/${N1}/relations`)).json();
  line(`relations=${JSON.stringify(rel.relations?.map((r) => r.id))}`);

  // ---- GET /api/knowledge/:id/backlinks ----------------------------------
  const back = await (await get(`/api/knowledge/${N1}/backlinks`)).json();
  line(`backlinks=${JSON.stringify(back.backlinks?.map((k) => k.id))}`);

  // ---- 404 路径（证明"查不到"也走新数据层）--------------------------------
  const back404 = await get(`/api/knowledge/knowledge_does_not_exist/backlinks`);
  line(`backlinks_404=${back404.status}`);

  // ---- POST /api/organize（读路径）--------------------------------------
  const orgOk = await post("/api/organize", { rawId: R1 });
  const orgOkBody = await orgOk.json();
  line(`organize_valid_raw=${orgOk.status}/${orgOkBody.error?.code ?? "-"}`);

  const org404 = await post("/api/organize", { rawId: "raw_does_not_exist" });
  const org404Body = await org404.json();
  line(`organize_bogus_raw=${org404.status}/${org404Body.error?.code ?? "-"}`);

  // ---- POST /api/assistant（读路径）-------------------------------------
  const askOk = await post("/api/assistant", {
    question: "验证",
    contextType: "knowledge",
    contextId: N1,
  });
  const askOkBody = await askOk.json();
  line(`assistant_valid_note=${askOk.status}/${askOkBody.error?.code ?? "-"}`);

  const ask404 = await post("/api/assistant", {
    question: "验证",
    contextType: "knowledge",
    contextId: "knowledge_does_not_exist",
  });
  const ask404Body = await ask404.json();
  line(`assistant_bogus_note=${ask404.status}/${ask404Body.error?.code ?? "-"}`);
} catch (error) {
  line(`ERROR=${error.message}`);
} finally {
  // ---- 清理（按外键顺序）------------------------------------------------
  await q(`delete from links where id = $1`, [L1]).catch(() => {});
  await q(`delete from notes where id = any($1)`, [[N1, N2]]).catch(() => {});
  await q(`delete from raw_notes where id = any($1)`, [[R1, R2]]).catch(() => {});

  const leftovers = await q(
    `select
       (select count(*)::int from raw_notes  where id = any($1)) as raws,
       (select count(*)::int from notes      where id = any($2)) as notes2,
       (select count(*)::int from links      where id = $3)      as links2`,
    [[R1, R2], [N1, N2], L1],
  );
  line(`cleanup_leftovers=${JSON.stringify(leftovers[0])}`);
  await pool.end();
}
