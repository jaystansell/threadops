import type { CompanyId } from "./company";

export type ThemeId = string & { readonly __brand: "ThemeId" };

export interface Theme {
  id: ThemeId;
  company_id: CompanyId;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}
