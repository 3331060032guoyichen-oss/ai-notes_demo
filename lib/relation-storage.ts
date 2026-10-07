import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { KnowledgeRelation } from "../types/relation";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const RELATION_FILE = path.join(DATA_DIRECTORY, "relations.json");

let writeChain: Promise<void> = Promise.resolve();

async function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = writeChain;
  let release!: () => void;

  writeChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();
  }
}

function isRelation(value: unknown): value is KnowledgeRelation {
  if (!value || typeof value !== "object") return false;

  const relation = value as Record<string, unknown>;
  return (
    typeof relation.id === "string" &&
    typeof relation.sourceId === "string" &&
    typeof relation.targetId === "string" &&
    relation.type === "related" &&
    typeof relation.reason === "string" &&
    typeof relation.createdAt === "string"
  );
}

async function readAll(): Promise<KnowledgeRelation[]> {
  try {
    const content = await readFile(RELATION_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);

    if (!Array.isArray(parsed) || !parsed.every(isRelation)) {
      throw new Error("Relation storage has an invalid shape.");
    }

    return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persist(relations: KnowledgeRelation[]): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(RELATION_FILE, JSON.stringify(relations, null, 2) + "\n", "utf8");
}

function relationKey(sourceId: string, targetId: string) {
  return [sourceId, targetId].sort().join("\u0000");
}

export async function listRelations(): Promise<KnowledgeRelation[]> {
  return readAll();
}

export async function listRelationsForKnowledge(
  knowledgeId: string,
): Promise<KnowledgeRelation[]> {
  const relations = await readAll();
  return relations.filter(
    (relation) =>
      relation.sourceId === knowledgeId || relation.targetId === knowledgeId,
  );
}

type RelationInput = Omit<KnowledgeRelation, "id" | "createdAt">;

export async function createRelation(
  input: RelationInput,
): Promise<{ relation: KnowledgeRelation; created: boolean }> {
  return withWriteLock(async () => {
    const relations = await readAll();
    const key = relationKey(input.sourceId, input.targetId);
    const existing = relations.find(
      (relation) => relationKey(relation.sourceId, relation.targetId) === key,
    );

    if (existing) return { relation: existing, created: false };

    const relation: KnowledgeRelation = {
      ...input,
      id: `relation_${randomUUID()}`,
      createdAt: new Date().toISOString(),
    };

    await persist([...relations, relation]);
    return { relation, created: true };
  });
}

export async function deleteRelation(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const relations = await readAll();
    const nextRelations = relations.filter((relation) => relation.id !== id);

    if (nextRelations.length === relations.length) return false;

    await persist(nextRelations);
    return true;
  });
}
