import type { Thread, ThreadId, ThreadStatus } from "../types";
import type { CompanyId } from "../types";
import type { ThemeId } from "../types";

export interface ThreadRepo {
  list(companyId: CompanyId, filters?: ThreadFilters): Promise<Thread[]>;
  getById(companyId: CompanyId, threadId: ThreadId): Promise<Thread | null>;
  create(input: ThreadCreateInput): Promise<Thread>;
  updateStatus(
    companyId: CompanyId,
    threadId: ThreadId,
    status: ThreadStatus,
  ): Promise<Thread>;
}

export interface ThreadFilters {
  theme_id?: ThemeId;
  status?: ThreadStatus;
}

export interface ThreadCreateInput {
  company_id: CompanyId;
  theme_id?: ThemeId;
  title: string;
  created_by: string;
  agent_api_key_id?: string;
}
