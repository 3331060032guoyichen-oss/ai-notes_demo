export type RelatedKnowledgeSuggestion = {
  knowledgeId: string;
  reason: string;
};

export type OrganizeDraft = {
  title: string;
  summary: string;
  content: string;
  keyPoints: string[];
  concepts: string[];
  keywords: string[];
  relatedKnowledge: RelatedKnowledgeSuggestion[];
};
