// B2 批次端到端验证：raw_notes 写路径（创建 + 归档）切到服务层后的真实行为。
//
// 用法：
//   1) 另开一个终端跑 `pnpm dev`
//   2) node --env-file=.env.local scripts/b2-verify.mjs
//
// 安全性：所有测试数据在 finally 中清理，结束断言清零；不打印连接串。
import { Pool } from "@neondatabase/serverless";

const BASE = process.env.B2_BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const NOTE_ID = "knowledge_b2_verify_1";
const USER_ID = "demo-user";

const out = [];
const line = (s) => {
  out.push(s);
  console.log(s);
};

const json = async (path, init) => {
  const res = await fetch(`${BASE}${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
};

const postJson = (path, payload) =>
  json(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const delJson = (path, payload) =>
  json(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const waitForServer = async () => {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/raw`);
      if (res.ok) return true;
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

let rawA = null;
let rawB = null;
let rawC = null;

try {
  if (!(await waitForServer())) {
    line("SERVER=FAIL(未在 60 秒内就绪)");
    process.exit(1);
  }
  line("SERVER=ok");

  // 1) 创建两条原始记录
  const a = await postJson("/api/raw", { text: "B2 验证原话 A（可归档）" });
  rawA = a.body?.raw?.id ?? null;
  line(`create_a=${a.status} id=${rawA} keys=${a.body?.raw ? Object.keys(a.body.raw).sort().join(",") : "-"}`);

  const b = await postJson("/api/raw", { text: "B2 验证原话 B（会被知识页引用）" });
  rawB = b.body?.raw?.id ?? null;
  line(`create_b=${b.status} id=${rawB}`);

  // 2) 列表里能看到
  const list1 = await json("/api/raw");
  const ids1 = (list1.body?.raws ?? []).map((r) => r.id);
  line(`list_contains_a=${ids1.includes(rawA)} contains_b=${ids1.includes(rawB)}`);

  // 3) 校验分支
  const empty = await postJson("/api/raw", { text: "   " });
  line(`create_empty=${empty.status}/${empty.body?.error?.code ?? "-"}`);

  const tooLong = await postJson("/api/raw", { text: "x".repeat(50_001) });
  line(`create_too_long=${tooLong.status}/${tooLong.body?.error?.code ?? "-"}`);

  // 4) 建一条知识页引用 raw B（直接用 SQL，模拟"已收录"状态）
  await q(`delete from notes where id = $1`, [NOTE_ID]);
  await q(
    `insert into notes (id, user_id, raw_id, title, summary, content)
     values ($1, $2, $3, $4, $5, $6)`,
    [NOTE_ID, USER_ID, rawB, "B2 验证知识页", "摘要", "正文"],
  );

  const blocked = await delJson("/api/raw", { rawId: rawB });
  line(`delete_referenced=${blocked.status}/${blocked.body?.error?.code ?? "-"}`);

  // 5) 未被引用的归档成功
  const archived = await delJson("/api/raw", { rawId: rawA });
  line(
    `delete_free=${archived.status} archived=${archived.body?.archived} ` +
      `deletedIdMatches=${archived.body?.deleted?.id === rawA}`,
  );

  // 6) 归档后从列表消失，但另一条仍在
  const list2 = await json("/api/raw");
  const ids2 = (list2.body?.raws ?? []).map((r) => r.id);
  line(`after_archive_hidden_a=${!ids2.includes(rawA)} still_has_b=${ids2.includes(rawB)}`);

  // 7) 再删一次 → 已归档，影响 0 行
  const again = await delJson("/api/raw", { rawId: rawA });
  line(`delete_again=${again.status}/${again.body?.error?.code ?? "-"}`);

  const bogus = await delJson("/api/raw", { rawId: "raw_does_not_exist" });
  line(`delete_bogus=${bogus.status}/${bogus.body?.error?.code ?? "-"}`);

  // 8) 归档行仍在数据库里（不是物理删除）
  const rows = await q(`select id, archived_at is not null as archived from raw_notes where id = $1`, [rawA]);
  line(`db_row_kept=${rows.length === 1} archived_flag=${rows[0]?.archived}`);
} catch (error) {
  line(`ERROR=${error.message}`);
} finally {
  await q(`delete from notes where id = $1`, [NOTE_ID]).catch(() => {});
  const ids = [rawA, rawB, rawC].filter(Boolean);
  if (ids.length) {
    await q(`delete from raw_notes where id = any($1)`, [ids]).catch(() => {});
  }
  const leftovers = await q(
    `select
       (select count(*)::int from raw_notes where id = any($1)) as raws,
       (select count(*)::int from notes where id = $2) as notes`,
    [ids.length ? ids : ["none"], NOTE_ID],
  );
  line(`cleanup_leftovers=${JSON.stringify(leftovers[0])}`);
  await pool.end();
}
