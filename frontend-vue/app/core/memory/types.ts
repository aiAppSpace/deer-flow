/*
  【文件职责】     描述 Gateway Memory document、fact metadata 与 CRUD payload。
  【架构位置】     L3 HTTP contract types
  【主要导出】     UserMemory · MemoryFact · create/PATCH inputs
  【依赖关系】     generated OpenAPI components
  【边界与注意】   fact/section 保留 forward fields；PATCH optional 与显式 0 必须可区分。
*/

import type { components } from "@/core/api/types.gen";

export interface MemorySection extends Record<string, unknown> {
  summary: string;
  updatedAt: string;
}

export interface MemoryFact
  extends Omit<components["schemas"]["Fact"], never>, Record<string, unknown> {
  id: string;
  content: string;
  category: string;
  confidence: number;
  createdAt: string;
  source: string;
}

export interface MemoryFactInput {
  content: string;
  category: string;
  confidence: number;
}

export interface MemoryFactPatchInput {
  content?: string;
  category?: string;
  confidence?: number;
}

export interface UserMemory extends Record<string, unknown> {
  version: string;
  revision?: number | null;
  lastUpdated: string;
  user: {
    workContext: MemorySection;
    personalContext: MemorySection;
    topOfMind: MemorySection;
    cognitiveStyle: MemorySection;
  } & Record<string, unknown>;
  history: {
    recentMonths: MemorySection;
    earlierContext: MemorySection;
    longTermBackground: MemorySection;
  } & Record<string, unknown>;
  facts: MemoryFact[];
}
