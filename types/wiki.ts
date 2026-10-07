export type WikiPageKind =
  | "overview"
  | "concept"
  | "architecture"
  | "workflow"
  | "reference"
  | "practice";

export type WikiLinkType =
  | "contains"
  | "supports"
  | "operates_on"
  | "maintains"
  | "indexes"
  | "records"
  | "extends";

export type WikiPage = {
  id: string;
  title: string;
  kind: WikiPageKind;
  summary: string;
  content: string;
  tags: string[];
  parentId: string | null;
  sourceRawId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type WikiLink = {
  id: string;
  sourceId: string;
  targetId: string;
  type: WikiLinkType;
  reason: string;
};

export type WikiData = {
  pages: WikiPage[];
  links: WikiLink[];
};
