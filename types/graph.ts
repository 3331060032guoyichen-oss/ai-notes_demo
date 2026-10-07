export type GraphNode = {
  id: string;
  title: string;
  rawId: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "related";
  reason: string;
};
