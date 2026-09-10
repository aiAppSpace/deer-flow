/*
  【文件职责】     项目（project workspace）的线上数据形状。
  【架构位置】     L3 领域类型
  【主要导出】     Project · ProjectStatus · ProjectPresentation ·
                   ProjectCreateInput · ProjectPatchInput · ProjectThread
  【依赖关系】     无
  【边界与注意】   字段名照抄 Gateway 的 `ProjectResponse` / `ProjectThreadResponse`
                   （`backend/app/gateway/routers/projects.py`），**不在这一层改名**：
                   线上形状与本仓的驼峰约定冲突时，转换发生在消费方，
                   而不是让这份类型与真实报文对不上。
*/

export type ProjectStatus = "active" | "archived";

export interface ProjectPresentation {
  icon?: string;
  color?: string;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  presentation: ProjectPresentation;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  name: string;
  instructions?: string;
  presentation?: ProjectPresentation;
}

export interface ProjectPatchInput {
  name?: string;
  instructions?: string;
  presentation?: ProjectPresentation;
}

/**
 * `GET /api/projects/{id}/threads` 返回的会话行：线程元数据存储的搜索形状。
 * `metadata` 里带 `deerflow_project_id`，`display_name` 是线上标题字段。
 */
export interface ProjectThread {
  thread_id: string;
  display_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}
