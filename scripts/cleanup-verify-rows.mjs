// 安全网：清理 B1/B2/B3 验证脚本可能遗留的测试数据。
//
// 用法：node --env-file=.env.local scripts/cleanup-verify-rows.mjs
//
// 注意删除顺序：note_revisions / links / note_tags / note_ai_metadata 必须先于 notes
// 删除——它们的删除策略是 RESTRICT，直接删 notes 会被外键挡住（这是设计使然）。
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const RAW_TEXT_PREFIXES = ["B1 验证", "B2 验证", "B3 验证"];
const NOTE_TITLE_PREFIXES = ["B1 验证", "B2 验证", "B3 验证"];
const EXTRA_NOTE_TITLES = ["B3 改过的标题"];

const raws = await q(`select id, text from raw_notes`);
const rawIds = raws
  .filter((r) => RAW_TEXT_PREFIXES.some((p) => r.text.startsWith(p)))
  .map((r) => r.id);

const noteRows = await q(`select id, title, raw_id from notes`);
const noteIds = noteRows
  .filter(
    (n) =>
      NOTE_TITLE_PREFIXES.some((p) => n.title.startsWith(p)) ||
      EXTRA_NOTE_TITLES.includes(n.title) ||
      rawIds.includes(n.raw_id),
  )
  .map((n) => n.id);

let revisionCount = 0;

if (noteIds.length > 0) {
  revisionCount = (
    await q(`select count(*)::int as n from note_revisions where note_id = any($1)`, [noteIds])
  )[0].n;
  await q(`delete from links where source_note_id = any($1) or target_note_id = any($1)`, [noteIds]);
  await q(`delete from note_tags where note_id = any($1)`, [noteIds]);
  await q(`delete from note_ai_metadata where note_id = any($1)`, [noteIds]);
  await q(`delete from note_revisions where note_id = any($1)`, [noteIds]);
  await q(`delete from notes where id = any($1)`, [noteIds]);
}

if (rawIds.length > 0) {
  await q(`delete from raw_notes where id = any($1)`, [rawIds]);
}

console.log(
  JSON.stringify({
    deletedRaws: rawIds.length,
    deletedNotes: noteIds.length,
    deletedRevisions: revisionCount,
  }),
);

const remaining = await q(
  `select
     (select count(*)::int from raw_notes)      as raws,
     (select count(*)::int from notes)          as notes,
     (select count(*)::int from note_revisions) as revisions,
     (select count(*)::int from links)          as links`,
);
console.log("remaining=" + JSON.stringify(remaining[0]));

await pool.end();
