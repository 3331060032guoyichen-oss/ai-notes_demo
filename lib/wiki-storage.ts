import { readFile } from "node:fs/promises";
import path from "node:path";

import type { WikiData, WikiLink, WikiPage } from "../types/wiki";

const WIKI_FILE = path.join(process.cwd(), "data", "wiki.json");

const WIKI_LINK_TYPES = new Set<WikiLink["type"]>([
  "contains",
  "supports",
  "operates_on",
  "maintains",
  "indexes",
  "records",
  "extends",
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isWikiPage(value: unknown): value is WikiPage {
  if (!value || typeof value !== "object") return false;

  const page = value as Record<string, unknown>;
  return (
    typeof page.id === "string" &&
    typeof page.title === "string" &&
    typeof page.kind === "string" &&
    typeof page.summary === "string" &&
    typeof page.content === "string" &&
    isStringArray(page.tags) &&
    (typeof page.parentId === "string" || page.parentId === null) &&
    typeof page.sourceRawId === "string" &&
    typeof page.order === "number" &&
    typeof page.createdAt === "string" &&
    typeof page.updatedAt === "string"
  );
}

function isWikiLink(value: unknown): value is WikiLink {
  if (!value || typeof value !== "object") return false;

  const link = value as Record<string, unknown>;
  return (
    typeof link.id === "string" &&
    typeof link.sourceId === "string" &&
    typeof link.targetId === "string" &&
    typeof link.type === "string" &&
    WIKI_LINK_TYPES.has(link.type as WikiLink["type"]) &&
    typeof link.reason === "string"
  );
}

export async function getWiki(): Promise<WikiData> {
  try {
    const content = await readFile(WIKI_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Wiki storage has an invalid shape.");
    }

    const data = parsed as Record<string, unknown>;
    if (
      !Array.isArray(data.pages) ||
      !data.pages.every(isWikiPage) ||
      !Array.isArray(data.links) ||
      !data.links.every(isWikiLink)
    ) {
      throw new Error("Wiki storage has an invalid shape.");
    }

    return {
      pages: [...data.pages].sort((a, b) => a.order - b.order),
      links: data.links,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { pages: [], links: [] };
    }

    throw error;
  }
}
