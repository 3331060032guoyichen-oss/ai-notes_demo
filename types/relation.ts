export type KnowledgeRelation = {
  id: string;
  sourceId: string;
  targetId: string;
  type: "related";
  reason: string;
  createdAt: string;
};
