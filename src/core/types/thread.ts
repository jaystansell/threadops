import type { CompanyId } from "./company";
import type { ThemeId } from "./theme";

export type ThreadId = string & { readonly __brand: "ThreadId" };

export type ThreadStatus = "open" | "closed" | "archived";

export interface Thread {
  id: ThreadId;
  company_id: CompanyId;
  theme_id: ThemeId | null;
  title: string;
  status: ThreadStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}
