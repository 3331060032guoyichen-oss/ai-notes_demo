import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Raw } from "../types/raw";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const RAW_FILE = path.join(DATA_DIRECTORY, "raw.json");

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

function isRaw(value: unknown): value is Raw {
  if (!value || typeof value !== "object") return false;

  const raw = value as Record<string, unknown>;
  return (
    typeof raw.id === "string" &&
    typeof raw.text === "string" &&
    typeof raw.createdAt === "string"
  );
}

async function readAll(): Promise<Raw[]> {
  try {
    const content = await readFile(RAW_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);

    if (!Array.isArray(parsed) || !parsed.every(isRaw)) {
      throw new Error("Raw storage has an invalid shape.");
    }

    return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persist(raws: Raw[]): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(RAW_FILE, JSON.stringify(raws, null, 2) + "\n", "utf8");
}

export async function listRaw(): Promise<Raw[]> {
  return readAll();
}

export async function getRaw(id: string): Promise<Raw | null> {
  const raws = await readAll();
  return raws.find((raw) => raw.id === id) ?? null;
}

export async function createRaw(text: string): Promise<Raw> {
  return withWriteLock(async () => {
    const raws = await readAll();
    const raw: Raw = {
      id: `raw_${randomUUID()}`,
      text,
      createdAt: new Date().toISOString(),
    };

    await persist([...raws, raw]);
    return raw;
  });
}
