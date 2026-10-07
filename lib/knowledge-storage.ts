import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Knowledge } from "../types/knowledge";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const KNOWLEDGE_FILE = path.join(DATA_DIRECTORY, "knowledge.json");

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

function isKnowledge(value: unknown): value is Knowledge {
  if (!value || typeof value !== "object") return false;

  const knowledge = value as Record<string, unknown>;
  const isStringArray = (items: unknown): items is string[] =>
    Array.isArray(items) && items.every((item) => typeof item === "string");

  return (
    typeof knowledge.id === "string" &&
    typeof knowledge.rawId === "string" &&
    typeof knowledge.title === "string" &&
    typeof knowledge.summary === "string" &&
    typeof knowledge.content === "string" &&
    isStringArray(knowledge.keyPoints) &&
    isStringArray(knowledge.concepts) &&
    isStringArray(knowledge.keywords) &&
    typeof knowledge.createdAt === "string" &&
    typeof knowledge.updatedAt === "string"
  );
}

async function readAll(): Promise<Knowledge[]> {
  try {
    const content = await readFile(KNOWLEDGE_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);

    if (!Array.isArray(parsed) || !parsed.every(isKnowledge)) {
      throw new Error("Knowledge storage has an invalid shape.");
    }

    return parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persist(knowledges: Knowledge[]): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledges, null, 2) + "\n", "utf8");
}

export async function listKnowledge(): Promise<Knowledge[]> {
  return readAll();
}

export async function getKnowledge(id: string): Promise<Knowledge | null> {
  const knowledges = await readAll();
  return knowledges.find((knowledge) => knowledge.id === id) ?? null;
}

export async function getKnowledgeByRawId(
  rawId: string,
): Promise<Knowledge | null> {
  const knowledges = await readAll();
  return knowledges.find((knowledge) => knowledge.rawId === rawId) ?? null;
}

type KnowledgeInput = Omit<Knowledge, "id" | "createdAt" | "updatedAt">;

export async function createKnowledge(
  input: KnowledgeInput,
): Promise<{ knowledge: Knowledge; created: boolean }> {
  return withWriteLock(async () => {
    const knowledges = await readAll();
    const existing = knowledges.find((knowledge) => knowledge.rawId === input.rawId);

    if (existing) return { knowledge: existing, created: false };

    const now = new Date().toISOString();
    const knowledge: Knowledge = {
      ...input,
      id: `knowledge_${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    };

    await persist([...knowledges, knowledge]);
    return { knowledge, created: true };
  });
}

type KnowledgeUpdateInput = Partial<
  Pick<Knowledge, "title" | "summary" | "content" | "keyPoints" | "concepts" | "keywords">
>;

export async function updateKnowledge(
  id: string,
  input: KnowledgeUpdateInput,
): Promise<Knowledge | null> {
  return withWriteLock(async () => {
    const knowledges = await readAll();
    const index = knowledges.findIndex((item) => item.id === id);

    if (index === -1) return null;

    const updated: Knowledge = {
      ...knowledges[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    const next = [...knowledges];
    next[index] = updated;

    await persist(next);
    return updated;
  });
}
