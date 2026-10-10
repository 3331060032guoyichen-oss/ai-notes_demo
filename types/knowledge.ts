export type Knowledge = {
  id: string;
  rawId: string;
  title: string;
  summary: string;
  content: string;
  keyPoints: string[];
  concepts: string[];
  keywords: string[];
  /**
   * 版本号：数据库实现里每次更新 +1，用于乐观并发检查（PATCH 时回传即可）。
   * 旧 JSON 存储没有这个字段，因此是可选的。
   */
  version?: number;
  createdAt: string;
  updatedAt: string;
};
