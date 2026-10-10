// 数据库结构与约束验证脚本（可重复运行，安全）
//
// 用法：
//   node --env-file=.env.local scripts/db-verify.mjs
//
// 安全性：
//   - 只做结构与约束检查；
//   - 所有写入测试都在事务内执行，最后统一 ROLLBACK，不会留下任何数据；
//   - 不打印连接串等敏感信息。
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const out = [];
const line = (s) => out.push(s);
const q = async (sql, params) => (await pool.query(sql, params)).rows;

// 1) 目标分支（只读环境变量，非连接串）
line(`NEON_BRANCH=${process.env.NEON_BRANCH ?? "(未设置)"}`);

// 2) public 表数量
const tables = await q(
  `select count(*)::int as n from pg_catalog.pg_tables where schemaname = current_schema()`,
);
line(`public_tables=${tables[0].n}`);

// 3) Drizzle 迁移记录
try {
  const rows = await q(`select count(*)::int as n from drizzle.__drizzle_migrations`);
  line(`drizzle_migrations=${rows[0].n}`);
} catch (error) {
  line(`drizzle_migrations=ERR(${error.message})`);
}

// 4) 每个 schema 的表数量（用于区分我们建的 public 表与 Neon Auth 自带的表）
const perSchema = await q(
  `select schemaname, count(*)::int as n from pg_catalog.pg_tables group by schemaname order by schemaname`,
);
line(`tables_per_schema=${perSchema.map((r) => `${r.schemaname}:${r.n}`).join(" ")}`);

// 4b) 只看当前(public) schema 的约束计数（c=check, f=foreign key, p=primary key, u=unique）
const cons = await q(
  `select contype::text as t, count(*)::int as n
     from pg_constraint
    where connamespace = (select oid from pg_namespace where nspname = current_schema())
    group by contype order by contype`,
);
line(`constraints_in_current_schema=${cons.map((r) => `${r.t}:${r.n}`).join(" ")}`);

// 5) 外键的删除行为（a=no action, r=restrict, c=cascade, n=set null, d=set default）
const fks = await q(
  `select conname, confdeltype::text as d
     from pg_constraint
    where contype = 'f'
      and connamespace = (select oid from pg_namespace where nspname = current_schema())
    order by conname`,
);
line("foreign_keys:");
for (const r of fks) line(`  ${r.conname} = ${r.d}`);

// 6) 三个新增列是否存在且可空
const cols = await q(
  `select table_name, column_name, is_nullable
     from information_schema.columns
    where (table_name, column_name) in
          (('raw_notes','archived_at'), ('notes','archived_at'), ('notes','deleted_at'), ('links','deleted_at'))
    order by table_name, column_name`,
);
line("new_columns:");
for (const c of cols) line(`  ${c.table_name}.${c.column_name} nullable=${c.is_nullable}`);

// 7) 枚举 CHECK 与 RESTRICT 是否真的生效（事务 + savepoint，最后回滚）
//    注意：PostgreSQL 里一条语句失败会让整个事务进入中止态，
//    因此每次"预期失败"的测试都必须用 savepoint 隔离，否则后续命令会被忽略。
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query(`insert into raw_notes (id, user_id, text) values ($1, $2, $3)`, [
    "rv_verify",
    "demo-user",
    "verify",
  ]);

  // 7a) 非法 notes.origin 必须被 CHECK 拒绝
  await client.query("savepoint sp_check");
  try {
    await client.query(
      `insert into notes (id, user_id, raw_id, title, summary, content, origin)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      ["n_bad", "demo-user", "rv_verify", "t", "s", "c", "bogus"],
    );
    line(`check_notes_origin=FAIL(未被拒绝)`);
  } catch (error) {
    line(`check_notes_origin=ok(${error.code ?? error.message})`);
  }
  await client.query("rollback to savepoint sp_check");

  // 7b) 合法笔记 + 一条修订
  await client.query(
    `insert into notes (id, user_id, raw_id, title, summary, content, origin)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    ["n_ok", "demo-user", "rv_verify", "t", "s", "c", "user"],
  );
  await client.query(
    `insert into note_revisions
       (id, user_id, note_id, version, title, summary, content, key_points, concepts, keywords, author_type, author_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12)`,
    ["nr_ok", "demo-user", "n_ok", 1, "t", "s", "c", "[]", "[]", "[]", "user", "demo-user"],
  );

  // 7c) 有修订时删除笔记必须被 RESTRICT 阻止
  await client.query("savepoint sp_restrict");
  try {
    await client.query(`delete from notes where id = $1`, ["n_ok"]);
    line(`restrict_note_delete=FAIL(删除未被阻止)`);
  } catch (error) {
    line(`restrict_note_delete=ok(${error.code ?? error.message})`);
  }
  await client.query("rollback to savepoint sp_restrict");

  await client.query("rollback");
} catch (error) {
  await client.query("rollback").catch(() => {});
  line(`write_tests=ERR(${error.message})`);
} finally {
  client.release();
}

// 8) 非法 proposals.status 必须被 CHECK 拒绝（事务内，回滚）
const client2 = await pool.connect();
try {
  await client2.query("begin");
  await client2.query(
    `insert into proposals (id, user_id, kind, status, origin) values ($1, $2, $3, $4, $5)`,
    ["pv_verify", "demo-user", "note_update", "bogus", "ai"],
  );
  line(`check_proposals_status=FAIL(未被拒绝)`);
  await client2.query("rollback");
} catch (error) {
  await client2.query("rollback").catch(() => {});
  line(`check_proposals_status=ok(${error.code ?? error.message})`);
} finally {
  client2.release();
}

// 9) 确认测试没有留下数据
const leftovers = await q(
  `select
     (select count(*)::int from raw_notes)  as raw_notes,
     (select count(*)::int from notes)      as notes,
     (select count(*)::int from note_revisions) as revisions,
     (select count(*)::int from proposals)  as proposals`,
);
line(`rows_after_verify=${JSON.stringify(leftovers[0])}`);

await pool.end();
console.log(out.join("\n"));
