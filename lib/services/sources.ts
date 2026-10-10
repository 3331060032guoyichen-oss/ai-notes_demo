import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import type { Raw } from "../../types/raw";
import { getUserContext } from "../auth/context";
import { getDb } from "../db/client";
import { rawNotes } from "../db/schema";

// 原始记录（raw_notes）服务层。
// 读路径默认只返回"未归档"的行；按 id 单条读取不过滤（保持与旧存储一致的行为）。
//
// 注意：raw_notes 目前**只有 archived_at，没有 deleted_at**——raw 的墓碑机制
// 尚未设计（按决策随存储层重写的写路径一起做）。因此这里只过滤归档。
//
// 写路径：
//   - createSource  —— 新建原始记录，user_id 取自服务端用户上下文
//   - archiveSource —— 归档（普通"移除"走这里，不做物理删除）

type SourceRow = typeof rawNotes.$inferSelect;

function toSource(row: SourceRow): Raw {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSources(): Promise<Raw[]> {
  const { db } = await getDb();
  const { userId } = getUserContext();
  const rows = await db
    .select()
    .from(rawNotes)
    .where(and(eq(rawNotes.userId, userId), isNull(rawNotes.archivedAt)))
    .orderBy(desc(rawNotes.createdAt));

  return rows.map(toSource);
}

export async function getSource(id: string): Promise<Raw | null> {
  const { db } = await getDb();
  const { userId } = getUserContext();
  const rows = await db
    .select()
    .from(rawNotes)
    .where(and(eq(rawNotes.id, id), eq(rawNotes.userId, userId)))
    .limit(1);
  const [row] = rows;

  return row ? toSource(row) : null;
}

export async function createSource(text: string): Promise<Raw> {
  const { db } = await getDb();
  const { userId } = getUserContext();
  const rows = await db
    .insert(rawNotes)
    .values({ id: `raw_${randomUUID()}`, userId, text })
    .returning();

  return toSource(rows[0]);
}

/**
 * 归档原始记录（普通"移除"路径）。
 * 只对"尚未归档"的行生效：影响 0 行时返回 null（不存在或已归档），调用方据此返回 404。
 * 不做物理删除——原始记录一旦删除，引用它的知识页会失去出处。
 */
export async function archiveSource(id: string): Promise<Raw | null> {
  const { db } = await getDb();
  const { userId } = getUserContext();
  const now = new Date();
  const rows = await db
    .update(rawNotes)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(rawNotes.id, id), eq(rawNotes.userId, userId), isNull(rawNotes.archivedAt)))
    .returning();
  const [row] = rows;

  return row ? toSource(row) : null;
}
